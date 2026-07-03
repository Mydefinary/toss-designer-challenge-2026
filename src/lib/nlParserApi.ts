/**
 * 자연어 제약 파서 — 서버 프록시 우선 + 로컬 규칙기반 폴백 (PRD 3.8).
 * 경로/same-origin 배포 전제: 기본은 상대경로 '(VITE_API_BASE ?? '') + /api/meetsync/parse-constraints'
 * 로 POST 하여 서버가 Claude 로 구조화 파싱한 결과를 받는다(API 키는 백엔드 env 에만 존재, 브라우저 미노출).
 * VITE_PARSE_ENDPOINT 가 설정돼 있으면 해당 절대 URL 을 우선 사용한다(하위호환).
 * 프록시가 실패(503 등)/비정상 응답/파싱 오류면 nlParser 의 동기 규칙기반 결과로 폴백한다.
 * 새 npm 의존성 없이 fetch 만 사용하며, 예외가 UI 로 전파되지 않도록 전부 감싼다.
 */
import type { Attendee, Availability, ConstraintCell, MeetingConfig, UnavailableReason } from '../types';
import { parseConstraints as parseLocal, type ParseResult } from './nlParser';
import { VALID_BLOCKS, blockStartLabel, dayName } from './recommend';

export type { ParseResult } from './nlParser';

const VALID_BLOCK_SET = new Set(VALID_BLOCKS);
const STATUSES: Availability[] = ['available', 'avoid', 'unavailable'];
const REASONS: UnavailableReason[] = ['외근', '미출근', '퇴근후', '휴가', '회의', '기타'];

/** 프록시 응답 셀 후보를 검증해 ConstraintCell 로 변환 */
function toCell(raw: unknown, attendeeIds: Set<string>): ConstraintCell | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const attendeeId = typeof r.attendeeId === 'string' ? r.attendeeId : undefined;
  const day = typeof r.day === 'number' ? r.day : undefined;
  const blockIndex = typeof r.blockIndex === 'number' ? r.blockIndex : undefined;
  const status = r.status as Availability;
  if (!attendeeId || !attendeeIds.has(attendeeId)) return null;
  if (day === undefined || day < 0) return null;
  if (blockIndex === undefined || !VALID_BLOCK_SET.has(blockIndex)) return null;
  if (!STATUSES.includes(status)) return null;
  const cell: ConstraintCell = { attendeeId, slot: { day, blockIndex }, status };
  if (status !== 'available' && typeof r.reason === 'string' && REASONS.includes(r.reason as UnavailableReason)) {
    cell.reason = r.reason as UnavailableReason;
  }
  return cell;
}

/** 추출된 셀들로 사람이 읽는 확인 메시지 생성 */
function buildMessage(cells: ConstraintCell[], attendees: Attendee[]): string {
  if (cells.length === 0) return '인식된 제약이 없어요.';
  const nameOf = new Map(attendees.map((a) => [a.id, a.name]));
  // (attendee, day) 단위로 블럭 범위를 묶어 요약
  const groups = new Map<string, { name: string; day: number; status: Availability; blocks: number[] }>();
  for (const c of cells) {
    const key = `${c.attendeeId}|${c.slot.day}|${c.status}`;
    const g = groups.get(key);
    if (g) g.blocks.push(c.slot.blockIndex);
    else
      groups.set(key, {
        name: nameOf.get(c.attendeeId) ?? c.attendeeId,
        day: c.slot.day,
        status: c.status,
        blocks: [c.slot.blockIndex],
      });
  }
  const word: Record<Availability, string> = { unavailable: '불가', avoid: '회피', available: '가능' };
  const lines: string[] = [];
  for (const g of groups.values()) {
    const min = Math.min(...g.blocks);
    const max = Math.max(...g.blocks);
    lines.push(`${g.name}님 ${dayName(g.day)} ${blockStartLabel(min)}–${blockStartLabel(max + 1)} ${word[g.status]}로 반영했어요`);
  }
  return lines.join('\n');
}

/**
 * 자연어 제약 파싱 (비동기). 엔드포인트가 있으면 서버 프록시, 없거나 실패하면 로컬 규칙기반.
 */
export async function parseConstraints(
  text: string,
  attendees: Attendee[],
  config: MeetingConfig,
): Promise<ParseResult> {
  // VITE_PARSE_ENDPOINT(하위호환) 우선, 없으면 same-origin 상대경로.
  // VITE_API_BASE 가 설정돼 있으면 절대 URL, 기본은 '' → same-origin 상대 호출.
  const override = import.meta.env.VITE_PARSE_ENDPOINT;
  const apiBase = (import.meta.env.VITE_API_BASE ?? '').trim().replace(/\/+$/, '');
  const endpoint = override && override.trim() !== '' ? override.trim() : `${apiBase}/api/meetsync/parse-constraints`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        attendees: attendees.map((a) => ({ id: a.id, name: a.name })),
        config: {
          durationMinutes: config.durationMinutes,
          dateRange: { start: config.dateRange.start, end: config.dateRange.end },
        },
      }),
    });

    if (!res.ok) throw new Error(`Proxy ${res.status}`);

    const data = (await res.json()) as { cells?: unknown; message?: unknown; unresolved?: unknown };
    if (!Array.isArray(data.cells)) throw new Error('잘못된 응답 형식');

    const attendeeIds = new Set(attendees.map((a) => a.id));
    const cells = data.cells.map((c) => toCell(c, attendeeIds)).filter((c): c is ConstraintCell => c !== null);

    const message = typeof data.message === 'string' ? data.message : buildMessage(cells, attendees);
    const unresolved =
      Array.isArray(data.unresolved) && data.unresolved.every((u) => typeof u === 'string')
        ? (data.unresolved as string[])
        : [];

    return { cells, message, ...(unresolved.length ? { unresolved } : {}) };
  } catch {
    // 프록시 실패/파싱 오류 → 로컬 폴백
    return parseLocal(text, attendees, config);
  }
}
