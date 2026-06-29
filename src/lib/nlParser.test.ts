import { describe, it, expect } from 'vitest';
import { parseConstraints } from './nlParser';
import type { Attendee, MeetingConfig } from '../types';

const attendees: Attendee[] = [
  { id: 'a-minjun', name: '민준', role: 'required' },
  { id: 'a-seoyeon', name: '서연', role: 'required' },
  { id: 'a-jihun', name: '지훈', role: 'required' },
  { id: 'a-doyun', name: '도윤', role: 'optional' },
];

const config: MeetingConfig = {
  title: 't',
  durationMinutes: 60,
  dateRange: { start: '2026-06-29', end: '2026-07-03' },
  location: 'online',
  rooms: [],
};

describe('nlParser — 로컬 규칙기반 파서', () => {
  it('1. "민준은 화요일 오후 외근" → 민준 화요일(day1) 오후 unavailable·사유 외근', () => {
    const r = parseConstraints('민준은 화요일 오후 외근', attendees, config);
    const cells = r.cells.filter((c) => c.attendeeId === 'a-minjun');
    expect(cells.length).toBe(10); // 오후 = blocks 8..17 (10개)
    expect(cells.every((c) => c.status === 'unavailable')).toBe(true);
    expect(cells.every((c) => c.slot.day === 1)).toBe(true);
    expect(cells.every((c) => c.reason === '외근')).toBe(true);
    expect(cells.some((c) => c.slot.blockIndex === 8)).toBe(true);
    expect(r.message).toContain('민준님 화요일 13:00–18:00 불가');
  });

  it('2. "서연은 매일 점심 직후 피하고 싶어함" → 서연 점심직후(13:00–14:00) avoid', () => {
    const r = parseConstraints('서연은 매일 점심 직후 피하고 싶어함', attendees, config);
    expect(r.cells.length).toBe(10); // 5일 × 2블럭(8,9)
    expect(r.cells.every((c) => c.attendeeId === 'a-seoyeon')).toBe(true);
    expect(r.cells.every((c) => c.status === 'avoid')).toBe(true);
    expect(r.cells.every((c) => c.slot.blockIndex === 8 || c.slot.blockIndex === 9)).toBe(true);
  });

  it('3. 다중 절 분리 — "지훈 화요일 종일 불가, 도윤 금요일 17시 회피"', () => {
    const r = parseConstraints('지훈 화요일 종일 불가, 도윤 금요일 17시 회피', attendees, config);
    const jihun = r.cells.filter((c) => c.attendeeId === 'a-jihun');
    const doyun = r.cells.filter((c) => c.attendeeId === 'a-doyun');
    // 지훈: 화요일 종일(16블럭) 불가
    expect(jihun.length).toBe(16);
    expect(jihun.every((c) => c.status === 'unavailable' && c.slot.day === 1)).toBe(true);
    // 도윤: 금요일 17시대(16,17) 회피
    expect(doyun.length).toBe(2);
    expect(doyun.every((c) => c.status === 'avoid' && c.slot.day === 4)).toBe(true);
    expect(doyun.map((c) => c.slot.blockIndex).sort((x, y) => x - y)).toEqual([16, 17]);
  });

  it('4. 사유 추출 — "지훈 화요일 종일 외근" → reason 외근', () => {
    const r = parseConstraints('지훈 화요일 종일 외근', attendees, config);
    expect(r.cells.length).toBeGreaterThan(0);
    expect(r.cells.every((c) => c.status === 'unavailable')).toBe(true);
    expect(r.cells.every((c) => c.reason === '외근')).toBe(true);
  });

  it('5. 모호 문장 → unresolved (셀 없음)', () => {
    const r = parseConstraints('내일 다같이 잘 부탁해요', attendees, config);
    expect(r.cells.length).toBe(0);
    expect(r.unresolved && r.unresolved.length).toBeGreaterThan(0);
  });

  it('6. 요일 미지정 절은 unresolved 로 분류', () => {
    const r = parseConstraints('민준은 오후에 외근', attendees, config);
    // 요일이 없으므로 반영되지 않고 unresolved
    expect(r.cells.length).toBe(0);
    expect(r.unresolved && r.unresolved.length).toBeGreaterThan(0);
  });
});
