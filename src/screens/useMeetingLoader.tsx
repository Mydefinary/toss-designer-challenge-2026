/**
 * 회의 로더 훅 — /m/:id/* 진입 시 해당 회의를 서버에서 불러와 스토어에 세팅한다.
 * 이미 로드된 회의(currentMeetingId === id)면 재조회를 건너뛴다.
 * loading/error 폴백 노드를 반환하고, 화면 컴포넌트는 hooks 순서를 지킨 뒤 `if (fallback) return fallback` 로 렌더한다.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui';
import { getMeeting } from '../lib/meetingsApi';
import { useMeetingStore, useMeetingActions, setMeetingSocket } from '../store';
import { connectMeetingSocket, getClientId } from '../lib/realtime';

const centered: CSSProperties = { padding: 40, textAlign: 'center' };

export function useMeetingLoader(): {
  status: 'loading' | 'ready' | 'error';
  fallback: ReactNode | null;
  connected: boolean;
} {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadMeeting, applyRemoteData } = useMeetingActions();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (!id) {
      setStatus('error');
      return;
    }
    // 이미 로드된 회의면 재조회 없이 즉시 준비 완료 (getState 로 읽어 재실행 루프 방지)
    if (useMeetingStore.getState().currentMeetingId === id) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    getMeeting(id)
      .then((record) => {
        if (ignore) return;
        loadMeeting(id, record);
        setStatus('ready');
      })
      .catch(() => {
        if (ignore) return;
        setStatus('error');
      });
    return () => {
      ignore = true;
    };
  }, [id, loadMeeting]);

  // WS 연결 — REST 로드와 독립적으로 실시간 협업 채널을 수립한다
  useEffect(() => {
    if (!id) return;
    const handle = connectMeetingSocket(id, {
      onInit: (data) => {
        // 이미 이 회의를 로컬에 들고 있으면(미저장 편집·완화 적용 등이 있을 수 있음)
        // 서버 초기 스냅샷으로 덮어쓰지 않는다. 화면 전환 시 재연결로 로컬 상태가 리셋되는 버그 방지.
        // (새 진입/새로고침은 currentMeetingId 가 null 이라 정상적으로 반영된다.)
        if (useMeetingStore.getState().currentMeetingId !== id) applyRemoteData(data);
      },
      onUpdate: (msg) => {
        // 자신이 보낸 편집은 에코 방지를 위해 무시
        if (msg.clientId !== getClientId()) applyRemoteData(msg.data);
      },
      onStatusChange: (c) => setConnected(c),
    });
    setMeetingSocket(handle);
    return () => {
      handle.close();
      setMeetingSocket(null);
    };
  }, [id, applyRemoteData]);

  let fallback: ReactNode | null = null;
  if (status === 'loading') {
    fallback = <div style={centered}>불러오는 중…</div>;
  } else if (status === 'error') {
    fallback = (
      <div style={centered}>
        <p>회의를 찾을 수 없어요</p>
        <Button onClick={() => navigate('/')}>목록으로</Button>
      </div>
    );
  }

  return { status, fallback, connected };
}
