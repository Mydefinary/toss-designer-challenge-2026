/**
 * 추천 알고리즘 (PRD 3.4 / 3.5 / 3.5.1 · V5 30분 블럭) — 전부 순수 함수.
 * 슬롯 동일성은 (day, blockIndex)로만 결정되며, 회의는 연속 blocks(=duration/30)개를 점유한다.
 * day 는 dateRange 의 0-based 영업일 인덱스라 실제 달력 날짜에 의존하지 않는다(결정적 테스트).
 */
import type {
  Attendee,
  ConstraintCell,
  DurationMinutes,
  MeetingConfig,
  RankedCandidate,
  RelaxationSuggestion,
  RelaxationType,
  Slot,
  SlotKey,
  Yielding,
} from '../types';

// ===== 점수 모델 상수 (PRD 3.4) =====
export const W_REQUIRED = 3;
export const W_OPTIONAL = 1;
export const SAT_AVAILABLE = 1;
export const SAT_AVOID = -0.5;

// ===== 블럭/업무시간 정의 =====
const DAY_NAMES = ['월', '화', '수', '목', '금'];
/** 유효 블럭 — 09:00–18:00 모든 30분 칸(점심 포함, 끊김 없이) → 하루 18개 */
export const VALID_BLOCKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
/** 하루 유효 블럭 수 */
export const BLOCKS_PER_DAY = 18;
const VALID_BLOCK_SET = new Set(VALID_BLOCKS);

/** 점심 블럭 — 11:30–13:00 = blockIndex 5·6·7. 격자에는 표시하되 명시적 제약이 없으면 기본 '불가'로 간주 */
export const LUNCH_BLOCKS = [5, 6, 7];
const LUNCH_BLOCK_SET = new Set(LUNCH_BLOCKS);
/** 점심 기본 불가 사유 라벨 (reasonText 로 부착) */
export const LUNCH_REASON = '점심';

/** 점심 블럭 여부 — 명시적 제약이 없으면 기본 불가로 처리되는 칸 */
export function isLunchBlock(blockIndex: number): boolean {
  return LUNCH_BLOCK_SET.has(blockIndex);
}

/** blockIndex → 분(09:00 기준 오프셋 적용한 절대 분). 0→540(09:00) */
function blockMinutes(blockIndex: number): number {
  return 9 * 60 + 30 * blockIndex;
}

/** 분 → "HH:MM" */
function minutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 블럭 시작시각 "HH:MM" — 9:00 + 30분*blockIndex (0→"09:00", 8→"13:00", 17→"17:30") */
export function blockStartLabel(blockIndex: number): string {
  return minutesLabel(blockMinutes(blockIndex));
}

/** 단일 30분 블럭 표기 — "09:00–09:30" (en dash) */
export function formatBlock(slot: Slot): string {
  const start = blockMinutes(slot.blockIndex);
  return `${minutesLabel(start)}–${minutesLabel(start + 30)}`;
}

/** 시작 슬롯 + 회의 길이 → 점유 구간 표기 — "13:00–14:00" */
export function formatRange(startSlot: Slot, durationMinutes: number): string {
  const start = blockMinutes(startSlot.blockIndex);
  return `${minutesLabel(start)}–${minutesLabel(start + durationMinutes)}`;
}

/** 요일명 — 0..4 → 월요일..금요일 (데모 dateRange 는 월요일 시작 5영업일 가정) */
export function dayName(day: number): string {
  return `${DAY_NAMES[day] ?? `D${day}`}요일`;
}

/** 슬롯 한국어 표기 — 화면 호환용 "월요일 09:00" */
export function formatSlot(slot: Slot): string {
  return `${dayName(slot.day)} ${blockStartLabel(slot.blockIndex)}`;
}

/** 슬롯 고유 키 — (day, blockIndex) */
export function slotKey(slot: Slot): SlotKey {
  return `${slot.day}-${slot.blockIndex}`;
}

/**
 * 기간 내 영업일(월~금) 수. ISO 'YYYY-MM-DD' 두 개를 UTC 로 파싱해 start..end(포함) 순회.
 * 잘못된 입력이면 0.
 */
export function businessDayCount(dateRange: { start: string; end: string }): number {
  const start = new Date(`${dateRange.start}T00:00:00Z`);
  const end = new Date(`${dateRange.end}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    const dow = cursor.getUTCDay(); // 0=일 … 6=토
    if (dow >= 1 && dow <= 5) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * 기간 내 유효 30분 블럭 슬롯 전부 생성 (영업일 × VALID_BLOCKS).
 * 투명성 보드/전체 셀용. 회의 길이와 무관하게 모든 유효 블럭을 반환한다.
 */
export function generateSlots(config: MeetingConfig): Slot[] {
  const days = businessDayCount(config.dateRange);
  const slots: Slot[] = [];
  for (let day = 0; day < days; day++) {
    for (const blockIndex of VALID_BLOCKS) {
      slots.push({ day, blockIndex });
    }
  }
  return slots;
}

/** 회의 길이 → 점유 블럭 수 */
function blocksFor(durationMinutes: DurationMinutes): number {
  return durationMinutes / 30;
}

/**
 * 후보 시작 블럭 b 가 유효한지 — 점유블럭 [b, b+1, …, b+n-1]이 모두 VALID_BLOCKS 에 속해야 한다.
 * (점심 블럭도 VALID_BLOCKS 이므로 여기서는 통과하고, 점심 기본 불가는 makeConstraintLookup 에서
 *  필수자 'unavailable' 로 합성돼 후보가 제외된다. 18 이상 초과는 여기서 제외)
 */
function occupiedBlocks(startBlock: number, n: number): number[] | null {
  const blocks: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = startBlock + i;
    if (!VALID_BLOCK_SET.has(b)) return null;
    blocks.push(b);
  }
  return blocks;
}

/**
 * 제약 조회 헬퍼 — (attendeeId, slot) 의 셀을 반환.
 * 입력에 없는 셀은 'available'(가능)로 간주한다.
 * 단, 점심 블럭(LUNCH_BLOCKS)은 명시적 제약이 없으면 기본 '불가'(사유 '점심')로 간주한다.
 * 사용자가 점심 칸을 명시적으로 가능/회피로 칠하면 그 값(override)을 그대로 따른다.
 */
export function makeConstraintLookup(
  constraints: ConstraintCell[],
): (attendeeId: string, slot: Slot) => ConstraintCell {
  const map = new Map<string, ConstraintCell>();
  for (const cell of constraints) {
    map.set(`${cell.attendeeId}|${slotKey(cell.slot)}`, cell);
  }
  return (attendeeId, slot) => {
    const found = map.get(`${attendeeId}|${slotKey(slot)}`);
    if (found) return found; // 명시적 제약(override) 우선
    if (LUNCH_BLOCK_SET.has(slot.blockIndex)) {
      // 점심 기본 불가 — 시드 데이터를 고치지 않고 로직에서 처리
      return { attendeeId, slot, status: 'unavailable', reasonText: LUNCH_REASON };
    }
    return { attendeeId, slot, status: 'available' };
  };
}

/** 'avoid' 셀의 양보 사유 문구 */
function yieldReason(cell: ConstraintCell): string {
  return cell.reasonText ?? cell.reason ?? '회피';
}

/** 한 참석자의 점유블럭 전체에 대한 합성 상태 */
interface Composite {
  status: 'available' | 'avoid' | 'unavailable';
  /** avoid 일 때 첫 avoid 블럭의 사유 문구 */
  reason?: string;
}

/** 점유블럭들의 상태를 합성 — 하나라도 불가면 불가, 아니고 하나라도 회피면 회피, 모두 가능이면 가능 */
function compositeStatus(
  attendeeId: string,
  day: number,
  blocks: number[],
  lookup: (attendeeId: string, slot: Slot) => ConstraintCell,
): Composite {
  let firstAvoid: string | undefined;
  for (const blockIndex of blocks) {
    const cell = lookup(attendeeId, { day, blockIndex });
    if (cell.status === 'unavailable') return { status: 'unavailable' };
    if (cell.status === 'avoid' && firstAvoid === undefined) {
      firstAvoid = yieldReason(cell);
    }
  }
  if (firstAvoid !== undefined) return { status: 'avoid', reason: firstAvoid };
  return { status: 'available' };
}

/**
 * 통합 회의실 가용 판정 — 점유블럭 중 하나라도 roomBusy 에 있으면 false(확보 불가).
 * roomBusy 는 여러 회의실을 "하나라도 비면 가용"으로 통합한 예외(예약) 슬롯 집합이다.
 */
export function roomAvailableForBlocks(
  roomBusy: Set<SlotKey>,
  day: number,
  blocks: number[],
): boolean {
  for (const b of blocks) {
    if (roomBusy.has(`${day}-${b}`)) return false;
  }
  return true;
}

interface InternalScored extends RankedCandidate {
  /** 정렬용 — 불가/회피 인원 수 */
  conflictCount: number;
  /** 정렬용 — 필수자 전원 가능 여부 */
  allRequiredAvailable: boolean;
}

/**
 * 한 후보(시작블럭 b, day d)를 평가. 필수자 합성상태 '불가'가 있으면 null(후보 제외).
 */
function scoreCandidate(
  day: number,
  startBlock: number,
  blocks: number[],
  attendees: Attendee[],
  lookup: (attendeeId: string, slot: Slot) => ConstraintCell,
  config: MeetingConfig,
  roomBusy: Set<SlotKey>,
): InternalScored | null {
  const satisfied: Attendee[] = [];
  const yielding: Yielding[] = [];
  const absent: Attendee[] = [];
  let score = 0;
  let allRequiredAvailable = true;

  for (const attendee of attendees) {
    const composite = compositeStatus(attendee.id, day, blocks, lookup);
    const weight = attendee.role === 'required' ? W_REQUIRED : W_OPTIONAL;

    if (composite.status === 'unavailable') {
      if (attendee.role === 'required') return null; // Hard 제약: 필수자 불가 → 후보 제외
      absent.push(attendee); // 선택자 불가 → 불참(점수 0 기여, 후보 유지)
      continue;
    }

    if (composite.status === 'avoid') {
      score += SAT_AVOID * weight;
      yielding.push({ attendee, reason: composite.reason ?? '회피' });
      if (attendee.role === 'required') allRequiredAvailable = false;
    } else {
      score += SAT_AVAILABLE * weight;
      satisfied.push(attendee);
    }
  }

  // 장소 평가 (V3) — 오프라인은 점유블럭 전체가 회의실 가용(roomBusy 미포함)이어야 함(Hard).
  // 하나라도 예약(busy)이면 후보 제외. 온라인은 장소무관이라 무시.
  if (config.location === 'offline') {
    if (!roomAvailableForBlocks(roomBusy, day, blocks)) return null;
  }
  const roomAvailable = true; // 온라인(장소무관)이거나 오프라인이면 통합 회의실 확보됨 → 항상 true

  const conflictCount = yielding.length + absent.length;

  return {
    startSlot: { day, blockIndex: startBlock },
    blocks: blocks.length,
    score,
    satisfied,
    yielding,
    absent,
    roomAvailable,
    rank: 0,
    conflictCount,
    allRequiredAvailable,
  };
}

/**
 * 정렬 비교 — 점수 내림차순 후 Tie-break (PRD 3.4):
 * ① 불가/회피 인원 적은 후보 → ② 필수자 전원 '가능' → ③ 이른 day → ④ 이른 blockIndex
 */
function compareCandidates(a: InternalScored, b: InternalScored): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.conflictCount !== b.conflictCount) return a.conflictCount - b.conflictCount;
  if (a.allRequiredAvailable !== b.allRequiredAvailable) {
    return a.allRequiredAvailable ? -1 : 1;
  }
  if (a.startSlot.day !== b.startSlot.day) return a.startSlot.day - b.startSlot.day;
  return a.startSlot.blockIndex - b.startSlot.blockIndex;
}

/** 내부 정렬 필드 제거 + rank 부여 */
function stripInternal(c: InternalScored, rank: number): RankedCandidate {
  return {
    startSlot: c.startSlot,
    blocks: c.blocks,
    score: c.score,
    satisfied: c.satisfied,
    yielding: c.yielding,
    absent: c.absent,
    roomAvailable: c.roomAvailable,
    rank,
  };
}

/**
 * 가능한 모든 후보 시작블럭을 점수화해 정렬 반환 (다양성 규칙 적용 전).
 * 테스트·제약완화에서 재사용한다. rank 는 정렬 순서대로 1..n 임시 부여.
 */
export function scoreAllCandidates(
  attendees: Attendee[],
  constraints: ConstraintCell[],
  config: MeetingConfig,
): RankedCandidate[] {
  const lookup = makeConstraintLookup(constraints);
  const days = businessDayCount(config.dateRange);
  const n = blocksFor(config.durationMinutes);
  // 통합 회의실 예약(busy) 슬롯 Set — 기존 시드 호환 위해 방어적 접근
  const roomBusy = new Set<SlotKey>(config.roomBusy ?? []);
  const scored: InternalScored[] = [];

  for (let day = 0; day < days; day++) {
    // 후보 시작블럭 — 점유블럭이 전부 유효해야 한다
    for (const startBlock of VALID_BLOCKS) {
      const blocks = occupiedBlocks(startBlock, n);
      if (!blocks) continue;
      const candidate = scoreCandidate(day, startBlock, blocks, attendees, lookup, config, roomBusy);
      if (candidate) scored.push(candidate);
    }
  }

  scored.sort(compareCandidates);
  return scored.map((c, i) => stripInternal(c, i + 1));
}

/** 후보의 양보 주체 시그니처 (양보자 id 집합) */
function yieldingSignature(c: RankedCandidate): string {
  return c.yielding
    .map((y) => y.attendee.id)
    .sort()
    .join(',');
}

/**
 * 다양성 규칙 (PRD 3.4):
 * 정렬된 후보 중 같은 날 최대 2개, 가능하면 양보 주체가 다른 후보를 우선해 상위 limit 개 선별.
 */
export function applyDiversity(sorted: RankedCandidate[], limit = 5): RankedCandidate[] {
  const perDay = new Map<number, number>();
  const usedSignatures = new Set<string>();
  const picked: RankedCandidate[] = [];
  const taken = new Set<string>();

  // 1차: 같은 날 ≤2 + 양보 주체가 새로운 후보 우선
  for (const c of sorted) {
    if (picked.length >= limit) break;
    const day = c.startSlot.day;
    if ((perDay.get(day) ?? 0) >= 2) continue;
    const sig = yieldingSignature(c);
    const isNovel = sig === '' || !usedSignatures.has(sig);
    if (!isNovel) continue;
    picked.push(c);
    taken.add(slotKey(c.startSlot));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    if (sig !== '') usedSignatures.add(sig);
  }

  // 2차: 남은 자리를 같은 날 ≤2 제약만 지켜 채움
  if (picked.length < limit) {
    for (const c of sorted) {
      if (picked.length >= limit) break;
      if (taken.has(slotKey(c.startSlot))) continue;
      const day = c.startSlot.day;
      if ((perDay.get(day) ?? 0) >= 2) continue;
      picked.push(c);
      taken.add(slotKey(c.startSlot));
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
  }

  return picked.map((c, i) => ({ ...c, rank: i + 1 }));
}

/**
 * 메인 추천 진입점 — 최대 5순위 후보 반환.
 */
export function recommend(
  attendees: Attendee[],
  constraints: ConstraintCell[],
  config: MeetingConfig,
): RankedCandidate[] {
  const all = scoreAllCandidates(attendees, constraints, config);
  return applyDiversity(all, 5);
}

// ============================================================
// 제약 완화 제안 (PRD 3.5.1) — 풀버전
// ============================================================

/** 완화 부담 비용 — 불가 > 회피 > 회의실확보 > 선택자제외 > 온라인전환 */
const RELAX_COST: Record<RelaxationType, number> = {
  'adjust-hard': 4,
  'ignore-avoid': 3,
  'secure-room': 2,
  'exclude-optional': 2,
  'switch-online': 1,
};

interface RelaxInputs {
  attendees: Attendee[];
  constraints: ConstraintCell[];
  config: MeetingConfig;
}

interface InternalAction {
  type: RelaxationType;
  target: NonNullable<RelaxationSuggestion['target']>;
  apply: (input: RelaxInputs) => RelaxInputs;
}

/** 특정 셀의 상태를 available 로 바꾼 새 제약 배열 */
function withCellStatus(
  constraints: ConstraintCell[],
  attendeeId: string,
  slot: Slot,
  status: 'available',
): ConstraintCell[] {
  const key = `${attendeeId}|${slotKey(slot)}`;
  return constraints.map((cell) =>
    `${cell.attendeeId}|${slotKey(cell.slot)}` === key
      ? { ...cell, status, reason: undefined, reasonText: undefined }
      : cell,
  );
}

/** 4가지 유형의 개별 완화 액션 전부 생성 */
function buildActions(input: RelaxInputs): InternalAction[] {
  const { attendees, constraints, config } = input;
  const actions: InternalAction[] = [];

  // (1) 선택자 제외
  for (const a of attendees) {
    if (a.role !== 'optional') continue;
    actions.push({
      type: 'exclude-optional',
      target: { attendeeId: a.id, attendeeName: a.name },
      apply: (inp) => ({ ...inp, attendees: inp.attendees.filter((x) => x.id !== a.id) }),
    });
  }

  // (2) 회피 무시  /  (3) Hard 제약 조정
  for (const cell of constraints) {
    const attendee = attendees.find((x) => x.id === cell.attendeeId);
    const name = attendee?.name;
    if (cell.status === 'avoid') {
      actions.push({
        type: 'ignore-avoid',
        target: { attendeeId: cell.attendeeId, attendeeName: name, slot: cell.slot, reason: yieldReason(cell) },
        apply: (inp) => ({
          ...inp,
          constraints: withCellStatus(inp.constraints, cell.attendeeId, cell.slot, 'available'),
        }),
      });
    } else if (cell.status === 'unavailable') {
      actions.push({
        type: 'adjust-hard',
        target: { attendeeId: cell.attendeeId, attendeeName: name, slot: cell.slot, reason: cell.reason ?? cell.reasonText },
        apply: (inp) => ({
          ...inp,
          constraints: withCellStatus(inp.constraints, cell.attendeeId, cell.slot, 'available'),
        }),
      });
    }
  }

  // (4) 회의실 확보 (오프라인 유지) + 온라인 전환 — 오프라인일 때만 의미 있음
  if (config.location === 'offline') {
    actions.push({
      type: 'secure-room',
      target: {},
      // 통합 회의실을 전 슬롯 가용화 — roomBusy 를 빈 배열로 만든다(예약 해제)
      apply: (inp) => ({
        ...inp,
        config: { ...inp.config, roomBusy: [] },
      }),
    });
    actions.push({
      type: 'switch-online',
      target: {},
      apply: (inp) => ({ ...inp, config: { ...inp.config, location: 'online' } }),
    });
  }

  return actions;
}

/** 완화 결과 메트릭 */
interface ActionResult {
  candidates: RankedCandidate[];
  gain: number;
  bestRank: number;
}

function evaluate(input: RelaxInputs, baseCount: number): ActionResult {
  const candidates = scoreAllCandidates(input.attendees, input.constraints, input.config);
  const top = candidates[0];
  return {
    candidates,
    gain: candidates.length - baseCount,
    bestRank: top ? top.score : Number.NEGATIVE_INFINITY,
  };
}

/** 결과 문구 — "후보 +N개, 새 1순위 = 13:00–14:00" */
function resultPhrase(gain: number, candidates: RankedCandidate[], durationMinutes: DurationMinutes): string {
  const sign = gain >= 0 ? '+' : '';
  const top = candidates[0];
  const topText = top ? `${dayName(top.startSlot.day)} ${formatRange(top.startSlot, durationMinutes)}` : '없음';
  return `후보 ${sign}${gain}개, 새 1순위 ${topText}`;
}

/** 액션 → 사람·대상 설명 */
function actionSubject(action: InternalAction): string {
  const t = action.target;
  switch (action.type) {
    case 'exclude-optional':
      return `${t.attendeeName ?? '선택 참석자'}님을 이번 회의에서 제외`;
    case 'ignore-avoid':
      return `${t.attendeeName ?? '참석자'}님의 회피(${t.slot ? formatBlock(t.slot) : ''})를 양보로 전환`;
    case 'adjust-hard':
      return `${t.attendeeName ?? '참석자'}님의 불가(${t.reason ?? ''} · ${t.slot ? formatBlock(t.slot) : ''})를 조정`;
    case 'secure-room':
      return '회의실 추가 확보(오프라인 유지)';
    case 'switch-online':
      return '오프라인 → 온라인 전환(회의실 제약 제거)';
  }
}

function toSuggestion(
  action: InternalAction,
  result: ActionResult,
  durationMinutes: DurationMinutes,
  combinedWith?: RelaxationSuggestion,
  extraCost = 0,
): RelaxationSuggestion {
  const top = result.candidates[0];
  return {
    type: action.type,
    target: action.target,
    gain: result.gain,
    cost: RELAX_COST[action.type] + extraCost,
    bestRank: result.bestRank,
    description: `${actionSubject(action)} → ${resultPhrase(result.gain, result.candidates, durationMinutes)}`,
    previewTopSlot: top ? top.startSlot : undefined,
    combinedWith,
  };
}

/** 정렬: gain 내림차순 → cost 오름차순 → bestRank 내림차순 */
function sortSuggestions(a: RelaxationSuggestion, b: RelaxationSuggestion): number {
  if (b.gain !== a.gain) return b.gain - a.gain;
  if (a.cost !== b.cost) return a.cost - b.cost;
  return b.bestRank - a.bestRank;
}

/**
 * 제약 완화 제안 (PRD 3.5.1) — 상위 3개.
 * base 후보가 0이고 모든 단일 완화도 0이면 상위 6개 액션 내에서 2단계 조합까지 탐색.
 */
export function suggestRelaxations(
  attendees: Attendee[],
  constraints: ConstraintCell[],
  config: MeetingConfig,
): RelaxationSuggestion[] {
  const input: RelaxInputs = { attendees, constraints, config };
  const duration = config.durationMinutes;
  const base = scoreAllCandidates(attendees, constraints, config);
  const baseCount = base.length;

  const actions = buildActions(input);
  const evaluated = actions.map((action) => ({
    action,
    result: evaluate(action.apply(input), baseCount),
  }));

  const singles = evaluated.map(({ action, result }) => toSuggestion(action, result, duration));
  singles.sort(sortSuggestions);

  const allSinglesZero = evaluated.every(({ result }) => result.candidates.length === 0);

  // 2단계 조합 — 단일로 풀리지 않을 때만
  if (baseCount === 0 && allSinglesZero && actions.length >= 2) {
    const topActions = [...evaluated]
      .sort((x, y) => {
        const gx = x.result.gain;
        const gy = y.result.gain;
        if (gy !== gx) return gy - gx;
        return RELAX_COST[x.action.type] - RELAX_COST[y.action.type];
      })
      .slice(0, 6)
      .map((e) => e.action);

    const combos: RelaxationSuggestion[] = [];
    for (let i = 0; i < topActions.length; i++) {
      for (let j = i + 1; j < topActions.length; j++) {
        const a = topActions[i]!;
        const b = topActions[j]!;
        const combinedInput = b.apply(a.apply(input));
        const result = evaluate(combinedInput, baseCount);
        if (result.candidates.length === 0) continue;
        const innerB = toSuggestion(b, evaluate(b.apply(input), baseCount), duration);
        combos.push(toSuggestion(a, result, duration, innerB, RELAX_COST[b.type]));
      }
    }
    combos.sort(sortSuggestions);
    if (combos.length > 0) return combos.slice(0, 3);
  }

  return singles.slice(0, 3);
}
