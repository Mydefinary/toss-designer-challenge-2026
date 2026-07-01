import { describe, it, expect, beforeEach } from 'vitest';
import { useMeetingStore } from './meetingStore';
import { slotKey, scoreAllCandidates } from '../lib/recommend';

describe('store.setConstraint — 점심 override', () => {
  beforeEach(() => {
    // 각 테스트마다 현재 시나리오를 다시 로드해 상태를 초기화한다
    useMeetingStore.getState().loadScenario(useMeetingStore.getState().scenarioId);
  });

  it('점심칸(block6)을 가능으로 칠하면 셀이 유지되고 30분 후보에 그 시간이 포함된다', () => {
    useMeetingStore.getState().setDuration(30);
    const attendeeId = useMeetingStore.getState().attendees[0]!.id;
    // attendee0 을 required 로, 나머지는 optional 로 두어 다른 참석자의 점심 기본불가가
    // 후보를 배제하지 않게 한다(optional 불가 → 불참 처리로 후보 유지). 회의실 제약은 온라인으로 배제.
    for (const a of useMeetingStore.getState().attendees) {
      useMeetingStore.getState().setAttendeeRole(a.id, a.id === attendeeId ? 'required' : 'optional');
    }
    useMeetingStore.getState().setConfig({ location: 'online' });

    // 사전 조건: override 전에는 attendee0 점심 기본불가라 0-6 후보가 존재하지 않는다
    const before = useMeetingStore.getState();
    expect(
      scoreAllCandidates(before.attendees, before.constraints, before.config).some(
        (c) => slotKey(c.startSlot) === '0-6',
      ),
    ).toBe(false);

    useMeetingStore.getState().setConstraint({ attendeeId, slot: { day: 0, blockIndex: 6 }, status: 'available' });
    const s = useMeetingStore.getState();

    // 명시 셀이 저장돼 있다 (버그 수정 핵심 — 시드와 무관하게 통과해야 함)
    expect(
      s.constraints.some(
        (c) =>
          c.attendeeId === attendeeId &&
          c.slot.day === 0 &&
          c.slot.blockIndex === 6 &&
          c.status === 'available',
      ),
    ).toBe(true);

    // 그 점심 시간이 이제 유효 후보(전체 후보군)에 포함된다
    expect(
      scoreAllCandidates(s.attendees, s.constraints, s.config).some((c) => slotKey(c.startSlot) === '0-6'),
    ).toBe(true);
  });

  it('점심 override를 불가로 다시 칠하면(기본 복귀) 셀이 제거된다', () => {
    useMeetingStore.getState().setDuration(30);
    const attendeeId = useMeetingStore.getState().attendees[0]!.id;

    useMeetingStore.getState().setConstraint({ attendeeId, slot: { day: 0, blockIndex: 6 }, status: 'available' });
    // 기본값(unavailable)으로 다시 설정 → 제거
    useMeetingStore.getState().setConstraint({ attendeeId, slot: { day: 0, blockIndex: 6 }, status: 'unavailable' });
    const s = useMeetingStore.getState();

    expect(
      s.constraints.some((c) => c.attendeeId === attendeeId && c.slot.day === 0 && c.slot.blockIndex === 6),
    ).toBe(false);
  });
});
