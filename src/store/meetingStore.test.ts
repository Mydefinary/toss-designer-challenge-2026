import { describe, it, expect, beforeEach } from 'vitest';
import { useMeetingStore, MIN_ATTENDEES, MAX_ATTENDEES } from './meetingStore';
import { slotKey, scoreAllCandidates } from '../lib/recommend';
import { scenarios } from '../data/scenarios';
import type { MeetingRecord } from '../lib/meetingsApi';

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

describe('store — 참석자 이름 편집·인원 추가/삭제 (가변 인원)', () => {
  beforeEach(() => {
    useMeetingStore.getState().loadScenario(useMeetingStore.getState().scenarioId);
  });

  it('setAttendeeName 은 이름을 갱신한다 (아바타 이니셜은 파생이라 이름만 반영하면 충분)', () => {
    const id = useMeetingStore.getState().attendees[0]!.id;
    useMeetingStore.getState().setAttendeeName(id, '홍길동');
    const found = useMeetingStore.getState().attendees.find((a) => a.id === id);
    expect(found?.name).toBe('홍길동');
  });

  it('addAttendee 는 인원을 1 늘리고 role optional·avatarColor 를 배정하며 후보를 재계산한다', () => {
    const before = useMeetingStore.getState().attendees.length;
    useMeetingStore.getState().addAttendee('신입');
    const s = useMeetingStore.getState();
    expect(s.attendees.length).toBe(before + 1);
    const added = s.attendees[s.attendees.length - 1]!;
    expect(added.name).toBe('신입');
    expect(added.role).toBe('optional');
    expect(added.avatarColor).toBeTruthy();
    // 후보는 배열로 파생되어 있어야 한다(가변 인원에서도 정상 동작)
    expect(Array.isArray(s.candidates)).toBe(true);
  });

  it('removeAttendee 는 참석자와 그 참석자의 제약 셀을 함께 제거하고 재계산한다', () => {
    // 시나리오1: s1-jihun 은 화요일 종일 외근 제약을 가진다
    const target = 's1-jihun';
    const hadConstraints = useMeetingStore
      .getState()
      .constraints.some((c) => c.attendeeId === target);
    expect(hadConstraints).toBe(true);

    useMeetingStore.getState().removeAttendee(target);
    const s = useMeetingStore.getState();

    // 참석자 제거
    expect(s.attendees.some((a) => a.id === target)).toBe(false);
    // 정합성 — 그 참석자의 제약 셀도 남아있지 않다
    expect(s.constraints.some((c) => c.attendeeId === target)).toBe(false);
    // 남은 참석자만으로 후보가 정상 파생된다
    expect(
      scoreAllCandidates(s.attendees, s.constraints, s.config).every((c) =>
        c.satisfied.concat(c.absent).every((a) => a.id !== target),
      ),
    ).toBe(true);
  });

  it('경계 — 최소 인원 이하로는 삭제 no-op, 최대 인원 초과로는 추가 no-op', () => {
    // 최소치까지 삭제
    let guard = 0;
    while (useMeetingStore.getState().attendees.length > MIN_ATTENDEES && guard < 50) {
      const id = useMeetingStore.getState().attendees[0]!.id;
      useMeetingStore.getState().removeAttendee(id);
      guard += 1;
    }
    expect(useMeetingStore.getState().attendees.length).toBe(MIN_ATTENDEES);
    // 한 번 더 삭제 시도 → no-op
    const minId = useMeetingStore.getState().attendees[0]!.id;
    useMeetingStore.getState().removeAttendee(minId);
    expect(useMeetingStore.getState().attendees.length).toBe(MIN_ATTENDEES);

    // 최대치까지 추가
    guard = 0;
    while (useMeetingStore.getState().attendees.length < MAX_ATTENDEES && guard < 50) {
      useMeetingStore.getState().addAttendee();
      guard += 1;
    }
    expect(useMeetingStore.getState().attendees.length).toBe(MAX_ATTENDEES);
    // 한 번 더 추가 시도 → no-op
    useMeetingStore.getState().addAttendee();
    expect(useMeetingStore.getState().attendees.length).toBe(MAX_ATTENDEES);
  });
});

describe('store — 회의 로드/제목/스냅샷 (멀티 회의)', () => {
  it('loadMeeting 은 레코드 데이터로 상태를 세팅하고 currentMeetingId 를 저장한다', () => {
    const seed = scenarios[0]!;
    const record: MeetingRecord = {
      id: 'meet-123', title: '테스트 회의', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      data: { config: structuredClone({ ...seed.config, title: '테스트 회의' }), attendees: structuredClone(seed.attendees), constraints: structuredClone(seed.constraints) },
    };
    useMeetingStore.getState().loadMeeting('meet-123', record);
    const s = useMeetingStore.getState();
    expect(s.currentMeetingId).toBe('meet-123');
    expect(s.config.title).toBe('테스트 회의');
    expect(s.attendees.length).toBe(seed.attendees.length);
    expect(Array.isArray(s.candidates)).toBe(true);
  });

  it('setTitle 은 제목만 바꾸고 getMeetingData 는 깊은 복사 스냅샷을 반환한다', () => {
    const seed = scenarios[0]!;
    const record: MeetingRecord = {
      id: 'meet-xyz', title: '초기', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      data: { config: structuredClone(seed.config), attendees: structuredClone(seed.attendees), constraints: structuredClone(seed.constraints) },
    };
    useMeetingStore.getState().loadMeeting('meet-xyz', record);
    useMeetingStore.getState().setTitle('새 제목');
    expect(useMeetingStore.getState().config.title).toBe('새 제목');
    const snap = useMeetingStore.getState().getMeetingData();
    expect(snap.config.title).toBe('새 제목');
    snap.config.title = 'X';
    expect(useMeetingStore.getState().config.title).toBe('새 제목');
  });
});
