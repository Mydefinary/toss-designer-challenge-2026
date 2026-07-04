/**
 * 실시간 WebSocket 협업 레이어.
 * 같은 오리진의 백엔드(/api/meetsync/meetings/:id/ws)에 연결하고
 * 편집 내용을 브로드캐스트한다. 연결 실패·오프라인 환경에서는 조용히 no-op 처리하여
 * 앱이 WS 서버 없이도 정상 동작할 수 있도록 방어적으로 설계한다.
 * 재연결 지수 백오프: 1s → 2s → 4s → … → 최대 15s.
 */
import type { MeetingData } from './meetingsApi';
import { uuid } from './meetingsApi';

// ===== 클라이언트 ID (탭/세션 단위) =====

/** sessionStorage 키 — ownerToken(localStorage)과 분리된 탭 단위 식별자 */
const CLIENT_ID_KEY = 'meetsync.clientId';

/** 저장소 접근이 막혀 있을 때 사용하는 모듈 인메모리 폴백 */
let _cachedClientId: string | null = null;

/**
 * 현재 탭/세션의 클라이언트 ID를 반환한다.
 * sessionStorage에 저장하여 페이지 새로고침 시에도 동일 ID를 유지한다.
 * 저장소 접근이 불가한 경우(프라이빗 브라우저 등) 모듈 변수로 폴백한다.
 */
export function getClientId(): string {
  // 모듈 변수에 캐싱된 경우 즉시 반환 (반복 호출 안정성)
  if (_cachedClientId !== null) return _cachedClientId;

  // sessionStorage에서 기존 ID 조회
  try {
    const saved = sessionStorage.getItem(CLIENT_ID_KEY);
    if (saved) {
      _cachedClientId = saved;
      return saved;
    }
  } catch {
    // 저장소 접근 불가 — 신규 생성으로 진행
  }

  // 새 ID 생성: crypto.randomUUID 우선, 미지원 시 uuid() 폴백
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : uuid();

  // 생성한 ID를 sessionStorage에 저장 (실패해도 무시)
  try {
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  } catch {
    // 저장 실패는 무시 — 인메모리 폴백으로 세션 중 안정적으로 사용
  }

  _cachedClientId = id;
  return id;
}

// ===== 소켓 핸들 인터페이스 =====

/** connectMeetingSocket 반환 핸들 — 편집 전송·연결 종료·상태 확인 */
export interface MeetingSocketHandle {
  /** MeetingData를 서버로 전송 (연결 중일 때만 동작, 그 외 no-op) */
  sendEdit(data: MeetingData): void;
  /** WebSocket 연결을 종료하고 재연결 타이머를 정리한다 */
  close(): void;
  /** 현재 WebSocket이 OPEN 상태인지 반환 */
  isConnected(): boolean;
}

// ===== 연결 팩토리 =====

/**
 * 지정된 회의 ID에 대한 WebSocket 연결을 수립하고 핸들을 반환한다.
 * 비브라우저 환경(테스트 등 WebSocket 미정의)에서는 즉시 no-op 핸들을 반환한다.
 * 모든 연결/메시지 파싱 실패는 조용히 무시하며, 앱이 WS 없이도 동작할 수 있다.
 */
export function connectMeetingSocket(
  id: string,
  handlers: {
    onInit?: (data: MeetingData, title?: string) => void;
    onUpdate?: (msg: { clientId: string; data: MeetingData }) => void;
    onStatusChange?: (connected: boolean) => void;
  },
): MeetingSocketHandle {
  // 비브라우저 환경 — 테스트 등에서 WebSocket이 정의되지 않은 경우 no-op 핸들 반환
  if (typeof WebSocket === 'undefined') {
    return {
      sendEdit: () => undefined,
      close: () => undefined,
      isConnected: () => false,
    };
  }

  // WS URL 구성 (same-origin)
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${location.host}/api/meetsync/meetings/${id}/ws`;

  let socket: WebSocket | null = null;
  let closedByUser = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let delay = 1000; // 초기 재연결 지연 1s

  function connect(): void {
    // 이전 재연결 타이머 정리
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    try {
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        // 연결 성공 — 딜레이 초기화 및 상태 알림
        delay = 1000;
        handlers.onStatusChange?.(true);
      };

      ws.onmessage = (event) => {
        // 메시지 파싱 실패는 조용히 무시
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            clientId?: string;
            data?: MeetingData;
            title?: string;
          };
          if (msg.type === 'init' && msg.data) {
            handlers.onInit?.(msg.data, msg.title);
          } else if (msg.type === 'update' && msg.clientId !== undefined && msg.data) {
            handlers.onUpdate?.({ clientId: msg.clientId, data: msg.data });
          }
        } catch {
          // JSON 파싱 실패 또는 핸들러 오류 — 조용히 무시
        }
      };

      ws.onclose = () => {
        handlers.onStatusChange?.(false);
        // 사용자가 직접 닫은 경우 재연결하지 않는다
        if (closedByUser) return;
        // 지수 백오프 재연결 (1s → 2s → 4s → … → 최대 15s)
        reconnectTimer = setTimeout(() => {
          connect();
        }, delay);
        delay = Math.min(delay * 2, 15000);
      };

      ws.onerror = () => {
        // 오류는 onclose가 이후에 발생하므로 여기서는 삼키기만 한다 (이중 스케줄 방지)
      };
    } catch {
      // WebSocket 생성 자체가 실패한 경우 (URL 이상 등) — 조용히 무시
      // onclose가 발생하지 않으므로 직접 재연결 예약
      if (!closedByUser) {
        reconnectTimer = setTimeout(() => {
          connect();
        }, delay);
        delay = Math.min(delay * 2, 15000);
      }
    }
  }

  // 핸들 객체
  const handle: MeetingSocketHandle = {
    sendEdit(data: MeetingData): void {
      // OPEN 상태일 때만 전송, 그 외 no-op
      try {
        if (socket !== null && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'edit', clientId: getClientId(), data }));
        }
      } catch (e) {
        // 전송 실패는 조용히 무시
        void e;
      }
    },

    close(): void {
      closedByUser = true;
      // 재연결 타이머 정리
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      // 소켓 닫기
      try {
        socket?.close();
      } catch {
        // 닫기 실패는 무시
      }
      socket = null;
    },

    isConnected(): boolean {
      return socket !== null && socket.readyState === WebSocket.OPEN;
    },
  };

  // 최초 연결 시도
  connect();

  return handle;
}
