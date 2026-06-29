/**
 * 로컬 규칙기반 한국어 제약 파서 (PRD 3.8) — 순수·동기 함수.
 * 자연어 문장에서 참석자·요일·시간대·상태·사유를 추출해 ConstraintCell[] 로 변환하고
 * 사람이 읽는 확인 메시지를 돌려준다. 모호하거나 요일이 없으면 unresolved 로 되묻는다.
 */
import type { Attendee, Availability, ConstraintCell, MeetingConfig, UnavailableReason } from '../types';
import { VALID_BLOCKS, blockStartLabel, businessDayCount, dayName } from './recommend';

export interface ParseResult {
  cells: ConstraintCell[];
  message: string;
  unresolved?: string[];
}

const VALID_BLOCK_SET = new Set(VALID_BLOCKS);

/** 정시 hour → 시작 blockIndex (09시=0, 13시=8, 17시=16) */
function hourToBlock(hour: number): number {
  return (hour - 9) * 2;
}

/** 블럭 배열을 유효 블럭으로만 필터 */
function onlyValid(blocks: number[]): number[] {
  return blocks.filter((b) => VALID_BLOCK_SET.has(b));
}

/** 상태 키워드 (unavailable 우선 판정) */
const UNAVAILABLE_KW = ['외근', '휴가', '퇴근', '불가', '미출근', '못 와', '못와', '못 옴', '참석 못'];
const AVOID_KW = ['피하고싶', '가능하면 피', '피해', '회피', '별로', '곤란'];
const AVAILABLE_KW = ['가능', '괜찮', '돼요', '됩니다', '참석 가능'];

/** 사유 태그 키워드 → UnavailableReason */
const REASON_MAP: Array<[string, UnavailableReason]> = [
  ['외근', '외근'],
  ['휴가', '휴가'],
  ['회의', '회의'],
  ['미출근', '미출근'],
  ['퇴근', '퇴근후'],
];

/** 요일 문자 → 0-based 인덱스 (월=0) */
const DAY_CHARS: Array<[string, number]> = [
  ['월', 0],
  ['화', 1],
  ['수', 2],
  ['목', 3],
  ['금', 4],
];

/** 공백 제거 (키워드 매칭을 띄어쓰기에 관대하게) */
function compact(s: string): string {
  return s.replace(/\s+/g, '');
}

/** 절(clause)에서 상태 판정 — unavailable > avoid > available. 공백 무시 매칭 */
function detectStatus(clause: string): Availability | null {
  const c = compact(clause);
  if (UNAVAILABLE_KW.some((k) => c.includes(compact(k)))) return 'unavailable';
  if (AVOID_KW.some((k) => c.includes(compact(k)))) return 'avoid';
  if (AVAILABLE_KW.some((k) => c.includes(compact(k)))) return 'available';
  return null;
}

/** 절에서 사유 태그 추출 (없으면 undefined) */
function detectReason(clause: string): UnavailableReason | undefined {
  for (const [kw, reason] of REASON_MAP) {
    if (clause.includes(kw)) return reason;
  }
  return undefined;
}

/** 절에서 요일 인덱스 목록 추출 */
function detectDays(clause: string, dayCount: number): number[] {
  // '매일'·'매주'·'평일'·'월~금'·'월-금' → 전 영업일
  if (/매일|매주|평일|월\s*[~\-]\s*금/.test(clause)) {
    return Array.from({ length: dayCount }, (_, i) => i);
  }
  const days = new Set<number>();
  for (const [ch, idx] of DAY_CHARS) {
    if (idx >= dayCount) continue;
    if (clause.includes(`${ch}요일`) || clause.includes(ch)) days.add(idx);
  }
  return [...days].sort((a, b) => a - b);
}

/** 절에서 시간대 블럭 목록 추출. 시간 미지정이면 null(→ 그날 전체 유효블럭) */
function detectBlocks(clause: string): number[] | null {
  // 점심 직후 13:00–14:00
  if (/점심\s*직후/.test(clause)) return [8, 9];

  // 시각 범위 N시~M시 / N시-M시
  const range = clause.match(/(\d{1,2})\s*시\s*[~\-]\s*(\d{1,2})\s*시/);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    const start = hourToBlock(from);
    const end = hourToBlock(to) - 1; // M:00 직전 블럭까지
    const blocks: number[] = [];
    for (let b = start; b <= end; b++) blocks.push(b);
    return onlyValid(blocks);
  }

  // 단일 시각 N시 → N:00–(N+1):00 = 두 블럭
  const single = clause.match(/(\d{1,2})\s*시/);
  if (single) {
    const h = Number(single[1]);
    const start = hourToBlock(h);
    return onlyValid([start, start + 1]);
  }

  // 오전 / 오후
  if (clause.includes('오전')) return [0, 1, 2, 3, 4, 5];
  if (clause.includes('오후')) return [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  return null; // 시간 미지정 → 종일
}

/** 상태 → 한국어 표기 */
function statusWord(status: Availability): string {
  if (status === 'unavailable') return '불가';
  if (status === 'avoid') return '회피';
  return '가능';
}

/** 블럭 목록 → "13:00–18:00" 범위 라벨 */
function blocksLabel(blocks: number[]): string {
  const min = Math.min(...blocks);
  const max = Math.max(...blocks);
  return `${blockStartLabel(min)}–${blockStartLabel(max + 1)}`;
}

/**
 * 자연어 제약 입력 파싱. 절 단위(쉼표·슬래시·'그리고'·마침표)로 분리해 각각 처리.
 */
export function parseConstraints(text: string, attendees: Attendee[], config: MeetingConfig): ParseResult {
  const dayCount = Math.max(businessDayCount(config.dateRange), 5);
  const clauses = text
    .split(/[,，/]|그리고|\.|。/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const cells: ConstraintCell[] = [];
  const unresolved: string[] = [];
  const messages: string[] = [];

  for (const clause of clauses) {
    // 1) 참석자 매칭 (부분일치)
    const matched = attendees.filter((a) => clause.includes(a.name));
    // 2) 상태 판정
    const status = detectStatus(clause);

    if (matched.length === 0 || status === null) {
      unresolved.push(clause);
      continue;
    }

    // 3) 요일
    const days = detectDays(clause, dayCount);
    if (days.length === 0) {
      unresolved.push(clause); // 요일 필수
      continue;
    }

    // 4) 시간대 블럭 (미지정이면 종일)
    const detected = detectBlocks(clause);
    const blocks = detected ?? VALID_BLOCKS;
    if (blocks.length === 0) {
      unresolved.push(clause);
      continue;
    }

    // 5) 사유
    const reason = status === 'available' ? undefined : detectReason(clause);
    const reasonText = status === 'available' || reason ? undefined : clause;

    for (const attendee of matched) {
      for (const day of days) {
        for (const blockIndex of blocks) {
          const cell: ConstraintCell = { attendeeId: attendee.id, slot: { day, blockIndex }, status };
          if (reason) cell.reason = reason;
          if (reasonText) cell.reasonText = reasonText;
          cells.push(cell);
        }
        messages.push(
          `${attendee.name}님 ${dayName(day)} ${blocksLabel(blocks)} ${statusWord(status)}로 반영했어요`,
        );
      }
    }
  }

  const message =
    messages.length > 0
      ? messages.join('\n')
      : '인식된 제약이 없어요. 예: "민준은 화요일 오후 외근"처럼 입력해보세요.';

  const result: ParseResult = { cells, message };
  if (unresolved.length > 0) result.unresolved = unresolved;
  return result;
}
