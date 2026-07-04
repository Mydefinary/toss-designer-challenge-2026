/**
 * 대체안(대안 시간대) 제안 백엔드 API 클라이언트.
 * 경로/same-origin 배포 전제: 기본은 상대경로(base '')로 '/api/meetsync/suggest-alternative' 를 호출한다.
 * (nginx 가 /api 를 백엔드로 프록시 → CORS 불필요). VITE_API_BASE 를 명시하면 절대 URL 도
 * 여전히 사용 가능하다(다른 오리진 백엔드용 하위호환). 이 API 는 ownerToken 을 사용하지 않는다.
 * 모든 응답은 non-2xx 시 request() 가 상태코드/본문을 담은 Error 를 던진다(503 등).
 */
import type { MeetingConfig, Attendee, ConstraintCell, DurationMinutes } from '../types';

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
 * 404 는 message 에 '404' 를 포함해 호출부가 "존재하지 않는 링크"로 식별할 수 있게 한다.
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

/** 대체안 한 건 — 제목/상세 설명/완화 부담 비용 등급 */
export interface AlternativeSuggestion {
  title: string;
  detail: string;
  cost: 'low' | 'medium' | 'high';
}

/**
 * 현재 회의 설정·참석자·제약을 백엔드로 보내 대안 시간대 제안 목록을 받는다.
 * non-2xx(503 등)는 catch 하지 않고 request() 가 던지는 Error 를 그대로 전파한다.
 */
export async function suggestAlternative(args: {
  config: MeetingConfig;
  attendees: Attendee[];
  constraints: ConstraintCell[];
  durationMinutes: DurationMinutes;
  dateRange: { start: string; end: string };
}): Promise<{ suggestions: AlternativeSuggestion[]; source: string }> {
  return request<{ suggestions: AlternativeSuggestion[]; source: string }>(
    '/api/meetsync/suggest-alternative',
    { method: 'POST', body: JSON.stringify(args) },
  );
}
