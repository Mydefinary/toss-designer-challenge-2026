/**
 * 추천 알고리즘 (PRD 3.4 / 3.5 / 3.5.1) — 전부 순수 함수.
 * 슬롯 동일성은 (day, startHour)로만 결정되며 실제 달력 날짜에 의존하지 않는다(결정적 테스트).
 */
import type {
  Attendee,
  ConstraintCell,
  MeetingConfig,
  RankedCandidate,
  RelaxationSuggestion,
  RelaxationType,
  Room,
  Slot,
  Yielding,
} from '../types';

// ===== 점수 모델 상수 (PRD 3.4) =====
export const W_REQUIRED = 3;
export const W_OPTIONAL = 1;
export const SAT_AVAILABLE = 1;
export const SAT_AVOID = -0.5;
/** 오프라인인데 가용 회의실 0개 → 장소부재 패널티 */
export const ROOM_PENALTY = -5;

// ===== 업무시간 정의 =====
const DAY_NAMES = ['월', '화', '수', '목', '금'];
const WORK_HOURS = [9, 10, 11, 13, 14, 15, 16, 17]; // 점심 12 제외 → 하루 8슬롯

/** 슬롯 고유 키 — (day, startHour) */
export function slotKey(slot: Slot): string {
  return `${slot.day}-${slot.startHour}`;
}

/** 요일명 — 0..4 → 월요일..금요일 */
export function dayName(day: number): string {
  return `${DAY_NAMES[day] ?? `D${day}`}요일`;
}

/** 슬롯 한국어 표기 — "화요일 14시" */
export function formatSlot(slot: Slot): string {
  return `${dayName(slot.day)} ${slot.startHour}시`;
}

/** 기간 내 1시간 슬롯 전부 생성 (월–금 × 09–18 점심 제외 = 8/일) */
export function generateSlots(rangeDays = 5): Slot[] {
  const slots: Slot[] = [];
  for (let day = 0; day < rangeDays; day++) {
    for (const startHour of WORK_HOURS) {
      slots.push({ day, startHour });
    }
  }
  return slots;
}

/**
 * 제약 조회 헬퍼 — (attendeeId, slot) 의 셀을 반환.
 * 입력에 없는 셀은 'available'(가능)로 간주한다.
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
    return found ?? { attendeeId, slot, status: 'available' };
  };
}

/** 회의실이 해당 슬롯에 가용한지 */
function isRoomFree(rooms: Room[] | undefined, slot: Slot): boolean {
  if (!rooms || rooms.length === 0) return false;
  return rooms.some((room) => room.availability.some((s) => s.day === slot.day && s.startHour === slot.startHour));
}

/** 슬롯에 회의실을 잡을 수 있는지 (온라인이면 항상 true) */
function computeRoomAvailable(config: MeetingConfig, slot: Slot): boolean {
  if (config.location === 'online') return true;
  return isRoomFree(config.rooms, slot);
}

/** 'avoid' 셀의 양보 사유 문구 */
function yieldReason(cell: ConstraintCell): string {
  return cell.reasonText ?? '회피';
}

interface InternalScored extends RankedCandidate {
  /** 정렬용 — 불가/회피 인원 수 */
  conflictCount: number;
  /** 정렬용 — 필수자 전원 가능 여부 */
  allRequiredAvailable: boolean;
}

/**
 * 한 슬롯을 평가. 필수자 '불가'가 있으면 null(후보 제외).
 */
function scoreSlot(
  slot: Slot,
  attendees: Attendee[],
  lookup: (attendeeId: string, slot: Slot) => ConstraintCell,
  config: MeetingConfig,
): InternalScored | null {
  const satisfied: Attendee[] = [];
  const yielding: Yielding[] = [];
  const absent: Attendee[] = [];
  let score = 0;
  let allRequiredAvailable = true;

  for (const attendee of attendees) {
    const cell = lookup(attendee.id, slot);
    const weight = attendee.role === 'required' ? W_REQUIRED : W_OPTIONAL;

    if (cell.status === 'unavailable') {
      if (attendee.role === 'required') {
        // Hard 제약: 필수자 불가 → 후보 제외
        return null;
      }
      // 선택자 불가 → 불참 처리(점수 0 기여, 후보 유지)
      absent.push(attendee);
      continue;
    }

    if (cell.status === 'avoid') {
      score += SAT_AVOID * weight;
      yielding.push({ attendee, reason: yieldReason(cell) });
      if (attendee.role === 'required') allRequiredAvailable = false;
    } else {
      // available
      score += SAT_AVAILABLE * weight;
      satisfied.push(attendee);
    }
  }

  const roomAvailable = computeRoomAvailable(config, slot);
  if (!roomAvailable) score += ROOM_PENALTY; // 장소부재 패널티 (오프라인·회의실 없음)

  const conflictCount = yielding.length + absent.length;

  return {
    slot,
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
 * ① 불가/회피 인원 적은 슬롯 → ② 필수자 전원 '가능' → ③ 이른 날짜·시간
 */
function compareCandidates(a: InternalScored, b: InternalScored): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.conflictCount !== b.conflictCount) return a.conflictCount - b.conflictCount;
  if (a.allRequiredAvailable !== b.allRequiredAvailable) {
    return a.allRequiredAvailable ? -1 : 1;
  }
  if (a.slot.day !== b.slot.day) return a.slot.day - b.slot.day;
  return a.slot.startHour - b.slot.startHour;
}

/**
 * 가능한 모든 후보 슬롯을 점수화해 정렬 반환 (다양성 규칙 적용 전).
 * 테스트·제약완화에서 재사용한다. rank 는 정렬 순서대로 1..n 임시 부여.
 */
export function scoreAllCandidates(
  attendees: Attendee[],
  constraints: ConstraintCell[],
  config: MeetingConfig,
): RankedCandidate[] {
  const lookup = makeConstraintLookup(constraints);
  const slots = generateSlots(config.rangeDays);
  const scored: InternalScored[] = [];
  for (const slot of slots) {
    const candidate = scoreSlot(slot, attendees, lookup, config);
    if (candidate) scored.push(candidate);
  }
  scored.sort(compareCandidates);
  return scored.map((c, i) => stripInternal(c, i + 1));
}

/** 내부 정렬 필드 제거 + rank 부여 */
function stripInternal(c: InternalScored, rank: number): RankedCandidate {
  return {
    slot: c.slot,
    score: c.score,
    satisfied: c.satisfied,
    yielding: c.yielding,
    absent: c.absent,
    roomAvailable: c.roomAvailable,
    rank,
  };
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
 * 정렬된 후보 중 같은 날 최대 2개, 가능하면 양보 주체가 다른 슬롯을 우선해 상위 5개 선별.
 */
export function applyDiversity(sorted: RankedCandidate[], limit = 5): RankedCandidate[] {
  const perDay = new Map<number, number>();
  const usedSignatures = new Set<string>();
  const picked: RankedCandidate[] = [];
  const taken = new Set<string>();

  // 1차: 같은 날 ≤2 + 양보 주체가 새로운 슬롯 우선
  for (const c of sorted) {
    if (picked.length >= limit) break;
    const day = c.slot.day;
    if ((perDay.get(day) ?? 0) >= 2) continue;
    const sig = yieldingSignature(c);
    const isNovel = sig === '' || !usedSignatures.has(sig);
    if (!isNovel) continue;
    picked.push(c);
    taken.add(slotKey(c.slot));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    if (sig !== '') usedSignatures.add(sig);
  }

  // 2차: 남은 자리를 같은 날 ≤2 제약만 지켜 채움
  if (picked.length < limit) {
    for (const c of sorted) {
      if (picked.length >= limit) break;
      if (taken.has(slotKey(c.slot))) continue;
      const day = c.slot.day;
      if ((perDay.get(day) ?? 0) >= 2) continue;
      picked.push(c);
      taken.add(slotKey(c.slot));
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

/** 완화 부담 비용 — 불가 > 회피 > 선택자제외 > 온라인전환 */
const RELAX_COST: Record<RelaxationType, number> = {
  'adjust-hard': 4,
  'ignore-avoid': 3,
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

/** 특정 셀의 상태를 바꾼 새 제약 배열 */
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

  // (4) 온라인 전환
  if (config.location === 'offline') {
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

/** 결과 문구 — "후보 +N개, 새 1순위 = ○요일 △시" */
function resultPhrase(gain: number, candidates: RankedCandidate[]): string {
  const sign = gain >= 0 ? '+' : '';
  const top = candidates[0];
  const topText = top ? formatSlot(top.slot) : '없음';
  return `후보 ${sign}${gain}개, 새 1순위 ${topText}`;
}

/** 액션 → 사람·대상 설명 */
function actionSubject(action: InternalAction): string {
  const t = action.target;
  switch (action.type) {
    case 'exclude-optional':
      return `${t.attendeeName ?? '선택 참석자'}님을 이번 회의에서 제외`;
    case 'ignore-avoid':
      return `${t.attendeeName ?? '참석자'}님의 회피(${t.slot ? formatSlot(t.slot) : ''})를 양보로 전환`;
    case 'adjust-hard':
      return `${t.attendeeName ?? '참석자'}님의 불가(${t.reason ?? ''} · ${t.slot ? formatSlot(t.slot) : ''})를 조정`;
    case 'switch-online':
      return '오프라인 → 온라인 전환(회의실 제약 제거)';
  }
}

function toSuggestion(
  action: InternalAction,
  result: ActionResult,
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
    description: `${actionSubject(action)} → ${resultPhrase(result.gain, result.candidates)}`,
    previewTopSlot: top ? top.slot : undefined,
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
  const base = scoreAllCandidates(attendees, constraints, config);
  const baseCount = base.length;

  const actions = buildActions(input);
  const evaluated = actions.map((action) => ({
    action,
    result: evaluate(action.apply(input), baseCount),
  }));

  const singles = evaluated.map(({ action, result }) => toSuggestion(action, result));
  singles.sort(sortSuggestions);

  const allSinglesZero = evaluated.every(({ result }) => result.candidates.length === 0);

  // 2단계 조합 — 단일로 풀리지 않을 때만
  if (baseCount === 0 && allSinglesZero && actions.length >= 2) {
    // 상위 영향 액션 N=6 (gain desc → cost asc) 내에서만 쌍 탐색
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
        const innerB = toSuggestion(b, evaluate(b.apply(input), baseCount));
        combos.push(toSuggestion(a, result, innerB, RELAX_COST[b.type]));
      }
    }
    combos.sort(sortSuggestions);
    if (combos.length > 0) return combos.slice(0, 3);
  }

  return singles.slice(0, 3);
}
