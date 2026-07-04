/**
 * 회의(멀티) 백엔드 API 클라이언트.
 * 경로/same-origin 배포 전제: 기본은 상대경로(base '')로 '/api/meetsync/meetings*' 를 호출한다.
 * (nginx 가 /api 를 백엔드로 프록시 → CORS 불필요). VITE_API_BASE 를 명시하면 절대 URL 도
 * 여전히 사용 가능하다(다른 오리진 백엔드용 하위호환).
 * 모든 응답은 non-2xx 시 상태코드/본문을 담은 Error 를 던진다(404 는 message 에 '404' 포함).
 * ownerToken 은 localStorage 에 보관해 "내가 만든 회의"를 식별한다(방어적 try/catch).
 */
import type { MeetingConfig, Attendee, ConstraintCell } from '../types';

/** 회의 저장 데이터(설정·참석자·제약) — 서버 스냅샷의 payload */
export interface MeetingData {
  config: MeetingConfig;
  attendees: Attendee[];
  constraints: ConstraintCell[];
}

/** 회의 목록 항목(요약) */
export interface MeetingSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** 회의 단건(요약 + 데이터) */
export type MeetingRecord = MeetingSummary & { data: MeetingData };

/** ownerToken localStorage 키 */
const OWNER_TOKEN_KEY = 'meetsync.ownerToken';

/**
 * base URL 을 읽어 trailing slash 를 제거해 반환.
 * 미설정/빈 문자열이면 '' (상대경로)를 반환한다 → same-origin 으로 '/api/meetsync/*' 호출.
 * VITE_API_BASE 가 설정돼 있으면 해당 절대 URL 을 사용한다(하위호환).
 */
function getBase(): string {
  const raw = import.meta.env.VITE_API_BASE;
  if (!raw || raw.trim() === '') {
    return '';
  }
  return raw.trim().replace(/\/+$/, '');
}

/**
 * fetch 래퍼 — JSON 요청/응답. 네트워크 실패·non-2xx 를 명확한 Error 로 변환한다.
 * 404 는 message 에 '404' 를 포함해 호출부가 "존재하지 않는 회의"로 식별할 수 있게 한다.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getBase();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (e) {
    // 네트워크 계층 실패 (CORS·오프라인 등)
    throw new Error(`네트워크 오류로 요청에 실패했어요: ${(e as Error).message}`);
  }
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // 본문 파싱 실패는 무시
    }
    throw new Error(`요청 실패 (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  return (await res.json()) as T;
}

/**
 * UUID 생성 — crypto.randomUUID 우선, 미지원 환경은 Math.random 폴백.
 * 폴백 템플릿: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (y = 8|9|a|b)
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * ownerToken 을 localStorage 에서 읽고 없으면 생성·저장 후 반환.
 * 저장소 접근이 막혀 있어도(프라이빗 모드 등) 항상 토큰 문자열을 반환한다.
 */
export function getOwnerToken(): string {
  try {
    const saved = localStorage.getItem(OWNER_TOKEN_KEY);
    if (saved) return saved;
  } catch {
    // 저장소 접근 불가 — 생성으로 진행
  }
  const token = uuid();
  try {
    localStorage.setItem(OWNER_TOKEN_KEY, token);
  } catch {
    // 저장 실패는 무시(세션 동안만 사용)
  }
  return token;
}

/** 내 ownerToken 으로 만든 회의 목록을 조회 ({ meetings } 응답에서 배열 추출) */
export async function listMeetings(): Promise<MeetingSummary[]> {
  const data = await request<{ meetings: MeetingSummary[] }>(
    `/api/meetsync/meetings?ownerToken=${encodeURIComponent(getOwnerToken())}`,
  );
  return Array.isArray(data.meetings) ? data.meetings : [];
}

/** 회의를 생성하고 id 를 발급받는다 */
export async function createMeeting(title: string, data: MeetingData): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/meetsync/meetings`, {
    method: 'POST',
    body: JSON.stringify({ ownerToken: getOwnerToken(), title, data }),
  });
}

/** 회의 id 로 단건(요약 + 데이터)을 조회 */
export async function getMeeting(id: string): Promise<MeetingRecord> {
  return request<MeetingRecord>(`/api/meetsync/meetings/${encodeURIComponent(id)}`);
}

/** 회의를 부분 갱신(제목/데이터) */
export async function updateMeeting(
  id: string,
  patch: { title?: string; data?: MeetingData },
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/meetsync/meetings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}
