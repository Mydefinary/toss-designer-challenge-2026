import { describe, it, expect } from 'vitest';
import {
  generateSlots,
  slotKey,
  recommend,
  scoreAllCandidates,
  suggestRelaxations,
  applyDiversity,
} from './recommend';
import type { Attendee, ConstraintCell, MeetingConfig } from '../types';
import { scenarios } from '../data/scenarios';

const s1 = scenarios[0]!;
const s2 = scenarios[1]!;
const s3 = scenarios[2]!;
const s4 = scenarios[3]!;

describe('generateSlots', () => {
  it('1. 40개 슬롯, 점심(12시) 제외, day 0–4 / hour 9–17', () => {
    const slots = generateSlots(5);
    expect(slots).toHaveLength(40);
    // 점심 12시는 없어야 한다
    expect(slots.some((s) => s.startHour === 12)).toBe(false);
    // day 범위 0–4
    expect(slots.every((s) => s.day >= 0 && s.day <= 4)).toBe(true);
    // hour 범위 9–17
    expect(slots.every((s) => s.startHour >= 9 && s.startHour <= 17)).toBe(true);
    // 하루 8슬롯
    expect(slots.filter((s) => s.day === 0)).toHaveLength(8);
  });
});

describe('시나리오 1 — Hard 제약 (필수자 불가 제외)', () => {
  it('2. 지훈(필수)의 화요일(day1) 외근 슬롯은 추천에서 제외된다', () => {
    const out = recommend(s1.attendees, s1.constraints, s1.config);
    expect(out.length).toBeGreaterThan(0);
    // 화요일(day1)은 지훈 종일 외근 → 어떤 슬롯도 후보에 없어야 한다
    expect(out.every((c) => c.slot.day !== 1)).toBe(true);
    // 전체 후보집합에서도 day1 은 전부 제외
    const all = scoreAllCandidates(s1.attendees, s1.constraints, s1.config);
    expect(all.some((c) => c.slot.day === 1)).toBe(false);
  });
});

describe('시나리오 2 — 완벽한 시간 없음', () => {
  it('3. 1순위 후보도 양보(yielding)를 동반한다', () => {
    const out = recommend(s2.attendees, s2.constraints, s2.config);
    expect(out.length).toBeGreaterThan(0);
    const top = out[0]!;
    expect(top.yielding.length).toBeGreaterThan(0);
    // 100% 만족(양보 0) 슬롯이 존재하지 않음을 전체에서 확인
    const all = scoreAllCandidates(s2.attendees, s2.constraints, s2.config);
    expect(all.every((c) => c.yielding.length > 0)).toBe(true);
  });
});

describe('시나리오 3 — 후보 희소 + 제약 완화', () => {
  it('4. 가능 후보가 5개 미만이고, 완화 제안이 1개 이상 나온다', () => {
    const all = scoreAllCandidates(s3.attendees, s3.constraints, s3.config);
    expect(all.length).toBeLessThan(5);
    expect(all.length).toBeGreaterThan(0); // 금요일 13시 1개
    const suggestions = suggestRelaxations(s3.attendees, s3.constraints, s3.config);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('시나리오 4 — 장소 병목', () => {
  it('5. 시간은 좋지만 회의실 없는 슬롯은 roomAvailable=false + 패널티(-5)', () => {
    const all = scoreAllCandidates(s4.attendees, s4.constraints, s4.config);
    const withRoom = all.find((c) => c.roomAvailable);
    const withoutRoom = all.find((c) => !c.roomAvailable);
    expect(withRoom).toBeDefined();
    expect(withoutRoom).toBeDefined();
    // 시간 만족도는 동일(전원 가능)하므로 점수 차이는 정확히 장소 패널티 -5
    expect(withRoom!.score - withoutRoom!.score).toBe(5);
  });
});

describe('Tie-break', () => {
  it('6. 동점 슬롯은 이른 시간(필수자 전원 가능)이 상위로 정렬된다', () => {
    // 전원 가능 + 온라인 → 모든 슬롯 점수 동일 → tie-break(이른 날짜·시간)만 작동
    const attendees: Attendee[] = [
      { id: 'R', name: '필수', role: 'required' },
      { id: 'O', name: '선택', role: 'optional' },
    ];
    const config: MeetingConfig = { title: 't', rangeDays: 5, location: 'online' };
    const all = scoreAllCandidates(attendees, [], config);
    // 모든 슬롯 동점 → 첫 번째는 가장 이른 슬롯 (월 9시)
    expect(all[0]!.slot).toEqual({ day: 0, startHour: 9 });
    const out = recommend(attendees, [], config);
    expect(out[0]!.slot).toEqual({ day: 0, startHour: 9 });

    // 동점·동일 충돌수에서 '필수자 전원 가능' 슬롯이 '필수자 회피' 슬롯보다 상위
    const constraints: ConstraintCell[] = [
      // 슬롯 A(day0 h10): 선택자 회피 1명 → 점수 3 + (-0.5) = 2.5, 필수 전원 가능
      { attendeeId: 'O', slot: { day: 0, startHour: 10 }, status: 'avoid' },
      // 슬롯 B(day0 h11): 필수자 회피 1명 → 점수 -1.5 + 1 = -0.5
      { attendeeId: 'R', slot: { day: 0, startHour: 11 }, status: 'avoid' },
    ];
    const ranked = scoreAllCandidates(attendees, constraints, config);
    const idxA = ranked.findIndex((c) => slotKey(c.slot) === '0-10');
    const idxB = ranked.findIndex((c) => slotKey(c.slot) === '0-11');
    expect(idxA).toBeLessThan(idxB); // 필수 전원 가능(A)이 필수 회피(B)보다 상위
  });
});

describe('다양성 규칙', () => {
  it('7. 추천 결과는 같은 날 최대 2개까지만 포함한다', () => {
    // 전원 가능 → 40개 동점 후보 → 다양성 규칙이 같은 날 2개로 제한
    const attendees: Attendee[] = [
      { id: 'R1', name: '필수1', role: 'required' },
      { id: 'R2', name: '필수2', role: 'required' },
    ];
    const config: MeetingConfig = { title: 't', rangeDays: 5, location: 'online' };
    const out = recommend(attendees, [], config);
    expect(out.length).toBe(5);
    const perDay = new Map<number, number>();
    for (const c of out) perDay.set(c.slot.day, (perDay.get(c.slot.day) ?? 0) + 1);
    for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(2);

    // 시나리오 4(후보 다수)에서도 동일하게 보장
    const s4out = recommend(s4.attendees, s4.constraints, s4.config);
    const s4PerDay = new Map<number, number>();
    for (const c of s4out) s4PerDay.set(c.slot.day, (s4PerDay.get(c.slot.day) ?? 0) + 1);
    for (const count of s4PerDay.values()) expect(count).toBeLessThanOrEqual(2);
  });
});

describe('점수 모델 — 가중치', () => {
  it('8. 필수자 회피(-1.5)가 선택자 가능(+1)보다 무겁게 작동한다', () => {
    const attendees: Attendee[] = [
      { id: 'R', name: '필수', role: 'required' },
      { id: 'O', name: '선택', role: 'optional' },
    ];
    const config: MeetingConfig = { title: 't', rangeDays: 5, location: 'online' };
    const constraints: ConstraintCell[] = [
      { attendeeId: 'R', slot: { day: 0, startHour: 9 }, status: 'avoid' }, // 필수 회피
      { attendeeId: 'O', slot: { day: 0, startHour: 10 }, status: 'avoid' }, // 선택 회피
    ];
    const all = scoreAllCandidates(attendees, constraints, config);
    const byKey = (k: string) => all.find((c) => slotKey(c.slot) === k)!;

    const reqAvoid = byKey('0-9'); // R 회피, O 가능 → -1.5 + 1
    const optAvoid = byKey('0-10'); // R 가능, O 회피 → 3 - 0.5
    const bothOk = byKey('0-11'); // 전원 가능 → 3 + 1

    expect(bothOk.score).toBe(4);
    expect(optAvoid.score).toBe(2.5);
    expect(reqAvoid.score).toBe(-0.5);
    // 필수자 회피 패널티(4.5 = 0.5×3+? → 만점 대비 4.5↓)가 선택자 회피 패널티(1.5)보다 큼
    expect(bothOk.score - reqAvoid.score).toBe(4.5);
    expect(bothOk.score - optAvoid.score).toBe(1.5);
    // 결과적으로 필수자 회피 슬롯이 선택자 회피 슬롯보다 하위
    expect(reqAvoid.score).toBeLessThan(optAvoid.score);
  });
});

describe('applyDiversity 직접 검증', () => {
  it('정렬된 동점 후보에서 같은 날 2개 제한이 적용된다', () => {
    const attendees: Attendee[] = [{ id: 'R', name: '필수', role: 'required' }];
    const config: MeetingConfig = { title: 't', rangeDays: 5, location: 'online' };
    const all = scoreAllCandidates(attendees, [], config);
    const picked = applyDiversity(all, 5);
    const day0 = picked.filter((c) => c.slot.day === 0);
    expect(day0.length).toBeLessThanOrEqual(2);
    // rank 는 1..5 로 재부여
    expect(picked.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});
