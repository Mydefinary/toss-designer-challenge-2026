import { describe, it, expect } from 'vitest';
import {
  generateSlots,
  slotKey,
  recommend,
  scoreAllCandidates,
  suggestRelaxations,
  applyDiversity,
  businessDayCount,
  formatBlock,
  formatRange,
  makeConstraintLookup,
  isLunchBlock,
  VALID_BLOCKS,
  BLOCKS_PER_DAY,
  LUNCH_BLOCKS,
} from './recommend';
import type { Attendee, ConstraintCell, MeetingConfig, SlotKey } from '../types';
import { scenarios } from '../data/scenarios';

const s1 = scenarios[0]!;
const s2 = scenarios[1]!;
const s3 = scenarios[2]!;
const s4 = scenarios[3]!;

/** v2 테스트용 설정 (월~금 5영업일, 온라인 기본) */
function makeConfig(over?: Partial<MeetingConfig>): MeetingConfig {
  return {
    title: 't',
    durationMinutes: 60,
    dateRange: { start: '2026-06-29', end: '2026-07-03' },
    location: 'online',
    rooms: [],
    roomBusy: [],
    ...over,
  };
}

/** 통합 회의실을 day0 blocks 0,1 만 가용으로 두는 roomBusy — 그 외 5일×18블럭 전부 예약 */
function roomBusyExceptDay0Blocks01(): SlotKey[] {
  const keep = new Set(['0-0', '0-1']);
  const busy: SlotKey[] = [];
  for (let day = 0; day < 5; day++) {
    for (const b of VALID_BLOCKS) {
      const k = `${day}-${b}`;
      if (!keep.has(k)) busy.push(k);
    }
  }
  return busy;
}

describe('generateSlots / 블럭 모델', () => {
  it('1. 5영업일 × 18블럭 = 90슬롯, 점심(5·6·7) 포함(끊김 없이), blockIndex 유효', () => {
    const slots = generateSlots(makeConfig());
    expect(slots).toHaveLength(90);
    // 점심 블럭 5·6·7 도 격자에 포함된다(표시는 하되 기본 불가)
    expect(slots.some((s) => s.blockIndex === 5)).toBe(true);
    expect(slots.some((s) => s.blockIndex === 6)).toBe(true);
    expect(slots.some((s) => s.blockIndex === 7)).toBe(true);
    // 모든 블럭이 유효집합에 속한다
    expect(slots.every((s) => VALID_BLOCKS.includes(s.blockIndex))).toBe(true);
    // day 범위 0–4, 하루 18블럭(09:00–18:00 끊김 없음)
    expect(slots.every((s) => s.day >= 0 && s.day <= 4)).toBe(true);
    expect(slots.filter((s) => s.day === 0)).toHaveLength(BLOCKS_PER_DAY);
    expect(BLOCKS_PER_DAY).toBe(18);
    // businessDayCount: 월~금 = 5
    expect(businessDayCount({ start: '2026-06-29', end: '2026-07-03' })).toBe(5);
    expect(businessDayCount({ start: '2026-07-04', end: '2026-07-05' })).toBe(0); // 주말
    expect(businessDayCount({ start: 'bad', end: 'date' })).toBe(0);
  });

  it('2. 블럭/구간 표기 — formatBlock·formatRange', () => {
    expect(formatBlock({ day: 0, blockIndex: 0 })).toBe('09:00–09:30');
    expect(formatBlock({ day: 0, blockIndex: 8 })).toBe('13:00–13:30');
    expect(formatBlock({ day: 0, blockIndex: 17 })).toBe('17:30–18:00');
    expect(formatRange({ day: 0, blockIndex: 8 }, 60)).toBe('13:00–14:00');
    expect(formatRange({ day: 0, blockIndex: 0 }, 90)).toBe('09:00–10:30');
  });
});

describe('점심 블럭 기본 불가 (5·6·7)', () => {
  it('1-1. makeConstraintLookup — 점심 블럭은 제약 없으면 기본 불가(사유 점심), 그 외는 가능', () => {
    const lookup = makeConstraintLookup([]);
    for (const b of LUNCH_BLOCKS) {
      const cell = lookup('X', { day: 0, blockIndex: b });
      expect(cell.status).toBe('unavailable');
      expect(cell.reasonText).toBe('점심');
    }
    // 점심 아닌 블럭은 기본 가능
    expect(lookup('X', { day: 0, blockIndex: 4 }).status).toBe('available');
    expect(lookup('X', { day: 0, blockIndex: 8 }).status).toBe('available');
  });

  it('1-2. 명시적 override — 점심 칸을 가능으로 칠하면 후보가 생긴다', () => {
    const a: Attendee[] = [{ id: 'R', name: '필수', role: 'required' }];
    const c30 = makeConfig({ durationMinutes: 30 });
    // override 없으면 점심(block6) 시작 30분 후보는 없다
    const base = scoreAllCandidates(a, [], c30);
    expect(base.some((c) => c.startSlot.blockIndex === 6)).toBe(false);
    // block6 을 명시적 available 로 override 하면 후보가 생긴다
    const override: ConstraintCell[] = [{ attendeeId: 'R', slot: { day: 0, blockIndex: 6 }, status: 'available' }];
    const withOverride = scoreAllCandidates(a, override, c30);
    expect(withOverride.some((c) => slotKey(c.startSlot) === '0-6')).toBe(true);
  });

  it('1-3. 점심에 걸치는 연속 블럭(11:30–12:30)은 후보에서 제외된다', () => {
    const a: Attendee[] = [{ id: 'R', name: '필수', role: 'required' }];
    const c60 = makeConfig({ durationMinutes: 60 });
    const all = scoreAllCandidates(a, [], c60);
    // 어떤 60분 후보도 점유 블럭에 점심(5·6·7)을 포함하지 않는다
    for (const c of all) {
      const occupied = [c.startSlot.blockIndex, c.startSlot.blockIndex + 1];
      expect(occupied.some((b) => LUNCH_BLOCKS.includes(b))).toBe(false);
    }
    // 11:30(block5) 시작 60분([5,6])은 점심이라 제외
    expect(all.some((c) => c.startSlot.blockIndex === 5)).toBe(false);
    // 11:00(block4) 시작 60분([4,5])도 block5 가 점심이라 제외
    expect(all.some((c) => c.startSlot.blockIndex === 4)).toBe(false);
  });
});

describe('시나리오 1 — Hard 제약 (필수자 불가 제외)', () => {
  it('3. 지훈(필수)의 화요일(day1) 외근으로 day1 후보가 전부 제외된다', () => {
    const out = recommend(s1.attendees, s1.constraints, s1.config);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.startSlot.day !== 1)).toBe(true);
    const all = scoreAllCandidates(s1.attendees, s1.constraints, s1.config);
    expect(all.some((c) => c.startSlot.day === 1)).toBe(false);
    // 60분 후보는 2블럭을 점유
    expect(all.every((c) => c.blocks === 2)).toBe(true);
  });
});

describe('시나리오 2 — 완벽한 시간 없음', () => {
  it('4. 1순위 후보도 양보(yielding)를 동반하고, 전 후보가 yielding>0', () => {
    const out = recommend(s2.attendees, s2.constraints, s2.config);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.yielding.length).toBeGreaterThan(0);
    const all = scoreAllCandidates(s2.attendees, s2.constraints, s2.config);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((c) => c.yielding.length > 0)).toBe(true);
  });
});

describe('시나리오 3 — 후보 희소 + 제약 완화', () => {
  it('5. 가능 후보가 5개 미만(1개)이고 완화 제안이 1개 이상 나온다', () => {
    const all = scoreAllCandidates(s3.attendees, s3.constraints, s3.config);
    expect(all.length).toBeLessThan(5);
    expect(all.length).toBeGreaterThan(0);
    // 유일 후보는 금요일(day4) 13:00(block8) 시작
    expect(all[0]!.startSlot).toEqual({ day: 4, blockIndex: 8 });
    const suggestions = suggestRelaxations(s3.attendees, s3.constraints, s3.config);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('시나리오 4 — 장소 병목 (오프라인 회의실 Hard 제약)', () => {
  it('6. 회의실 없는 오프라인 슬롯은 후보에서 제외되고 남은 후보는 전부 회의실 보유', () => {
    const all = scoreAllCandidates(s4.attendees, s4.constraints, s4.config);
    expect(all.length).toBeGreaterThan(0);
    // 남은 후보는 전부 roomAvailable=true (통합 회의실이 점유블럭 전체를 커버)
    expect(all.every((c) => c.roomAvailable === true)).toBe(true);
    // 회의실이 월요일(day0) 오전에만 가용하므로 후보도 day0 에만 존재
    expect(all.every((c) => c.startSlot.day === 0)).toBe(true);
  });

  it('6-1. 완화 제안에 온라인 전환·회의실 확보가 포함되고 후보가 늘어난다', () => {
    const base = scoreAllCandidates(s4.attendees, s4.constraints, s4.config);
    expect(base.every((c) => c.startSlot.day === 0)).toBe(true);
    const suggestions = suggestRelaxations(s4.attendees, s4.constraints, s4.config);
    const online = suggestions.find((r) => r.type === 'switch-online');
    const room = suggestions.find((r) => r.type === 'secure-room');
    expect(online).toBeDefined();
    expect(room).toBeDefined();
    expect(online!.gain).toBeGreaterThan(0);
    expect(room!.gain).toBeGreaterThan(0);
  });
});

describe('가변 회의 길이', () => {
  it('7. 60분=2블럭 점유, 30분 후보수 > 90분 후보수', () => {
    const a: Attendee[] = [{ id: 'R', name: '필수', role: 'required' }];
    const n30 = scoreAllCandidates(a, [], makeConfig({ durationMinutes: 30 }));
    const n90 = scoreAllCandidates(a, [], makeConfig({ durationMinutes: 90 }));
    const c60 = scoreAllCandidates(a, [], makeConfig({ durationMinutes: 60 }));
    expect(n30.length).toBeGreaterThan(n90.length);
    expect(n30[0]!.blocks).toBe(1);
    expect(c60[0]!.blocks).toBe(2);
    expect(n90[0]!.blocks).toBe(3);
    // 30분: 점심(5·6·7)은 기본 불가라 후보에서 빠짐 → 5일 × 15블럭 = 75
    expect(n30.length).toBe(75);
    // 어떤 후보도 점심 블럭에서 시작하지 않는다
    expect(n30.every((c) => !isLunchBlock(c.startSlot.blockIndex))).toBe(true);
  });
});

describe('Tie-break', () => {
  it('8. 동점이면 가장 이른 슬롯, 그리고 필수자 가능 슬롯이 필수자 회피 슬롯보다 상위', () => {
    const attendees: Attendee[] = [
      { id: 'R', name: '필수', role: 'required' },
      { id: 'O', name: '선택', role: 'optional' },
    ];
    const config = makeConfig({ location: 'online' });
    const all = scoreAllCandidates(attendees, [], config);
    expect(all[0]!.startSlot).toEqual({ day: 0, blockIndex: 0 });
    const out = recommend(attendees, [], config);
    expect(out[0]!.startSlot).toEqual({ day: 0, blockIndex: 0 });

    // 30분 단위로 특정 블럭을 타깃해 검증
    const c30 = makeConfig({ durationMinutes: 30 });
    const constraints: ConstraintCell[] = [
      { attendeeId: 'O', slot: { day: 0, blockIndex: 2 }, status: 'avoid' }, // 선택 회피 → 3 - 0.5 = 2.5
      { attendeeId: 'R', slot: { day: 0, blockIndex: 3 }, status: 'avoid' }, // 필수 회피 → -1.5 + 1 = -0.5
    ];
    const ranked = scoreAllCandidates(attendees, constraints, c30);
    const idxA = ranked.findIndex((c) => slotKey(c.startSlot) === '0-2');
    const idxB = ranked.findIndex((c) => slotKey(c.startSlot) === '0-3');
    expect(idxA).toBeLessThan(idxB);
  });
});

describe('다양성 규칙', () => {
  it('9. 추천 결과는 같은 날 최대 2개까지만 포함한다', () => {
    const attendees: Attendee[] = [
      { id: 'R1', name: '필수1', role: 'required' },
      { id: 'R2', name: '필수2', role: 'required' },
    ];
    const out = recommend(attendees, [], makeConfig({ location: 'online' }));
    expect(out.length).toBe(5);
    const perDay = new Map<number, number>();
    for (const c of out) perDay.set(c.startSlot.day, (perDay.get(c.startSlot.day) ?? 0) + 1);
    for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(2);

    const s4out = recommend(s4.attendees, s4.constraints, s4.config);
    const s4PerDay = new Map<number, number>();
    for (const c of s4out) s4PerDay.set(c.startSlot.day, (s4PerDay.get(c.startSlot.day) ?? 0) + 1);
    for (const count of s4PerDay.values()) expect(count).toBeLessThanOrEqual(2);
  });
});

describe('점수 모델 — 가중치', () => {
  it('10. 필수자 회피(-1.5)가 선택자 가능(+1)보다 무겁게 작동한다', () => {
    const attendees: Attendee[] = [
      { id: 'R', name: '필수', role: 'required' },
      { id: 'O', name: '선택', role: 'optional' },
    ];
    const config = makeConfig({ durationMinutes: 30 });
    const constraints: ConstraintCell[] = [
      { attendeeId: 'R', slot: { day: 0, blockIndex: 0 }, status: 'avoid' }, // 필수 회피
      { attendeeId: 'O', slot: { day: 0, blockIndex: 1 }, status: 'avoid' }, // 선택 회피
    ];
    const all = scoreAllCandidates(attendees, constraints, config);
    const byKey = (k: string) => all.find((c) => slotKey(c.startSlot) === k)!;

    const reqAvoid = byKey('0-0'); // R 회피, O 가능 → -1.5 + 1
    const optAvoid = byKey('0-1'); // R 가능, O 회피 → 3 - 0.5
    const bothOk = byKey('0-2'); // 전원 가능 → 3 + 1

    expect(bothOk.score).toBe(4);
    expect(optAvoid.score).toBe(2.5);
    expect(reqAvoid.score).toBe(-0.5);
    expect(bothOk.score - reqAvoid.score).toBe(4.5);
    expect(bothOk.score - optAvoid.score).toBe(1.5);
    expect(reqAvoid.score).toBeLessThan(optAvoid.score);
  });
});

describe('applyDiversity 직접 검증', () => {
  it('11. 정렬된 동점 후보에서 같은 날 2개 제한 + rank 재부여', () => {
    const attendees: Attendee[] = [{ id: 'R', name: '필수', role: 'required' }];
    const all = scoreAllCandidates(attendees, [], makeConfig({ location: 'online' }));
    const picked = applyDiversity(all, 5);
    const day0 = picked.filter((c) => c.startSlot.day === 0);
    expect(day0.length).toBeLessThanOrEqual(2);
    expect(picked.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('오프라인 회의실 Hard 제약 (작업2)', () => {
  it('12. 오프라인인데 점유블럭 중 하나라도 예약(busy)이면 후보 제외', () => {
    const a: Attendee[] = [{ id: 'R', name: '필수', role: 'required' }];
    // 통합 회의실은 day0 blocks 0,1 만 가용 → 그 외 전 슬롯 예약. 60분 후보는 [0,1] 하나만 성립
    const roomBusy = roomBusyExceptDay0Blocks01();
    const cfg = makeConfig({ location: 'offline', roomBusy });
    const all = scoreAllCandidates(a, [], cfg);
    expect(all.every((c) => c.roomAvailable === true)).toBe(true);
    expect(all.map((c) => slotKey(c.startSlot))).toEqual(['0-0']);
  });

  it('12-1. 온라인이면 회의실과 무관하게 후보 유지(roomAvailable=true)', () => {
    const a: Attendee[] = [{ id: 'R', name: '필수', role: 'required' }];
    const all = scoreAllCandidates(a, [], makeConfig({ location: 'online', rooms: [] }));
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((c) => c.roomAvailable === true)).toBe(true);
  });
});
