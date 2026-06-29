/**
 * 자연어 제약 파서 — Claude API 우선 + 로컬 규칙기반 폴백 (PRD 3.8).
 * VITE_ANTHROPIC_API_KEY 가 있으면 Anthropic Messages API(claude-haiku-4-5)로 구조화 추출,
 * 키가 없거나 네트워크/파싱 실패 시 nlParser 의 동기 규칙기반 결과로 폴백한다.
 * 새 npm 의존성 없이 fetch 만 사용한다.
 */
import type { Attendee, Availability, ConstraintCell, MeetingConfig, UnavailableReason } from '../types';
import { parseConstraints as parseLocal, type ParseResult } from './nlParser';
import { VALID_BLOCKS, blockStartLabel, dayName } from './recommend';

export type { ParseResult } from './nlParser';

const VALID_BLOCK_SET = new Set(VALID_BLOCKS);
const STATUSES: Availability[] = ['available', 'avoid', 'unavailable'];
const REASONS: UnavailableReason[] = ['외근', '미출근', '퇴근후', '휴가', '회의', '기타'];

const SYSTEM_PROMPT = [
  '너는 회의 일정 제약을 추출하는 파서다. 한국어 문장에서 각 참석자의 불가/회피/가능 시간을 뽑아낸다.',
  '규칙:',
  '- 요일은 0-based 인덱스로: 월=0, 화=1, 수=2, 목=3, 금=4.',
  '- 시간은 30분 blockIndex 로: 0=09:00, 1=09:30 … 점심(12:00–13:00)인 6·7은 제외, 13:00=8 … 17:30=17. 하루 16개 유효블럭.',
  '- 오전 = blockIndex 0~5, 오후 = 8~17, 점심직후 = 8,9.',
  '- status 는 "unavailable"(외근·휴가·퇴근·미출근·불가) / "avoid"(피하고싶음·회피) / "available"(가능) 중 하나.',
  '- reason 은 선택: 외근·미출근·퇴근후·휴가·회의·기타.',
  '오직 아래 JSON 만 출력하라(설명·코드블럭 금지):',
  '{"cells":[{"attendeeId":"...","day":0,"blockIndex":8,"status":"unavailable","reason":"외근"}]}',
].join('\n');

/** API 응답 셀 후보를 검증해 ConstraintCell 로 변환 */
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

/** 응답 content[0].text 에서 JSON 블록 추출·파싱 */
function extractJson(text: string): { cells?: unknown } | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as { cells?: unknown };
  } catch {
    return null;
  }
}

/**
 * 자연어 제약 파싱 (비동기). 키가 있으면 Claude API, 없거나 실패하면 로컬 규칙기반.
 */
export async function parseConstraints(
  text: string,
  attendees: Attendee[],
  config: MeetingConfig,
): Promise<ParseResult> {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key) {
    // 키 없음 → 즉시 로컬 폴백
    return parseLocal(text, attendees, config);
  }

  try {
    const userContent = JSON.stringify({
      text,
      attendees: attendees.map((a) => ({ id: a.id, name: a.name })),
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const out = data.content?.[0]?.text;
    if (!out) throw new Error('빈 응답');

    const parsed = extractJson(out);
    const rawCells = parsed && Array.isArray(parsed.cells) ? parsed.cells : null;
    if (!rawCells) throw new Error('JSON 파싱 실패');

    const attendeeIds = new Set(attendees.map((a) => a.id));
    const cells = rawCells.map((c) => toCell(c, attendeeIds)).filter((c): c is ConstraintCell => c !== null);

    return { cells, message: buildMessage(cells, attendees) };
  } catch {
    // 네트워크/파싱 실패 → 로컬 폴백
    return parseLocal(text, attendees, config);
  }
}
