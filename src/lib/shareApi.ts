/**
 * 상황 공유 + 코멘트 백엔드 API 클라이언트.
 * 경로/same-origin 배포 전제: 기본은 상대경로(base '')로 '/api/meetsync/*' 를 호출한다.
 * (nginx 가 /api 를 백엔드로 프록시 → CORS 불필요). VITE_API_BASE 를 명시하면 절대 URL 도
 * 여전히 사용 가능하다(다른 오리진 백엔드용 하위호환).
 * 모든 응답은 non-2xx 시 상태코드/본문을 담은 Error 를 던진다(404 는 message 에 '404' 포함).
 */

/** 코멘트 한 건 (순위별 vote 또는 텍스트, 혹은 둘 다) */
export interface ShareComment {
  id: string;
  author: string;
  rank: number | null;
  vote: 'up' | 'down' | null;
  text: string | null;
  createdAt: string;
}

/** 공유 레코드 — snapshot 은 화면3에서 저장한 임의 JSON */
export interface ShareRecord {
  id: string;
  snapshot: unknown;
  createdAt: string;
}

/** 코멘트 작성 입력 */
export interface CommentInput {
  author: string;
  rank?: number | null;
  vote?: 'up' | 'down' | null;
  text?: string;
}

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
 * 공유 기능 활성 여부. 경로/same-origin 배포에서는 상대경로로 항상 사용 가능하므로 true.
 * 네트워크 실패(백엔드 미가동 등)는 request() 가 Error 로 던져 UI 가 에러로 처리한다.
 */
export function isShareEnabled(): boolean {
  return true;
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

/** 현재 상황 스냅샷을 저장하고 공유 id 를 발급받는다 */
export async function createShare(snapshot: unknown): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/meetsync/shares`, {
    method: 'POST',
    body: JSON.stringify({ snapshot }),
  });
}

/** 공유 id 로 저장된 레코드(snapshot 포함)를 조회 */
export async function getShare(id: string): Promise<ShareRecord> {
  return request<ShareRecord>(`/api/meetsync/shares/${encodeURIComponent(id)}`);
}

/** 공유에 코멘트/의사표현(vote)을 추가 */
export async function postComment(id: string, body: CommentInput): Promise<ShareComment> {
  return request<ShareComment>(`/api/meetsync/shares/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 공유의 코멘트 목록을 조회 ({ comments } 응답에서 배열 추출) */
export async function getComments(id: string): Promise<ShareComment[]> {
  const data = await request<{ comments: ShareComment[] }>(
    `/api/meetsync/shares/${encodeURIComponent(id)}/comments`,
  );
  return Array.isArray(data.comments) ? data.comments : [];
}
