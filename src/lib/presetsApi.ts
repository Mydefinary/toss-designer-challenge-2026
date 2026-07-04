/**
 * 회의 프리셋(참석자·장소·제약 묶음) 백엔드 API 클라이언트.
 * 경로/same-origin 배포 전제: 기본은 상대경로(base '')로 '/api/meetsync/presets*' 를 호출한다.
 * (nginx 가 /api 를 백엔드로 프록시 → CORS 불필요). VITE_API_BASE 를 명시하면 절대 URL 도
 * 여전히 사용 가능하다(다른 오리진 백엔드용 하위호환). ownerToken 은 meetingsApi 와 공유한다.
 * 모든 응답은 non-2xx 시 상태코드/본문을 담은 Error 를 던진다(404 는 message 에 '404' 포함).
 */
import { getOwnerToken, type MeetingData } from './meetingsApi';

/** 프리셋 저장 데이터 — MeetingData 와 구조 동일(설정·참석자·제약). candidates/파생값 제외 */
export type PresetData = MeetingData;

/** 프리셋 목록 항목(요약) */
export interface PresetSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** 프리셋 단건(요약 + 데이터) */
export type PresetRecord = PresetSummary & { data: PresetData };

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

/** 내 ownerToken 으로 저장한 프리셋 목록을 조회 ({ presets } 응답에서 배열 추출) */
export async function listPresets(): Promise<PresetSummary[]> {
  const data = await request<{ presets: PresetSummary[] }>(
    `/api/meetsync/presets?ownerToken=${encodeURIComponent(getOwnerToken())}`,
  );
  return Array.isArray(data.presets) ? data.presets : [];
}

/** 프리셋을 생성하고 id 를 발급받는다 */
export async function createPreset(name: string, data: PresetData): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/meetsync/presets`, {
    method: 'POST',
    body: JSON.stringify({ ownerToken: getOwnerToken(), name, data }),
  });
}

/** 프리셋 id 로 단건(요약 + 데이터)을 조회 */
export async function getPreset(id: string): Promise<PresetRecord> {
  return request<PresetRecord>(`/api/meetsync/presets/${encodeURIComponent(id)}`);
}

/** 프리셋을 삭제 — 204/빈 본문을 허용(JSON 파싱하지 않음) */
export async function deletePreset(id: string): Promise<void> {
  const base = getBase();
  const path = `/api/meetsync/presets/${encodeURIComponent(id)}?ownerToken=${encodeURIComponent(getOwnerToken())}`;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { method: 'DELETE' });
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
  // 본문은 사용하지 않으므로 파싱 생략 (204/빈 응답 허용)
}
