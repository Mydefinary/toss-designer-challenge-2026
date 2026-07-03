/**
 * 데모 시드 시나리오 5종 (PRD 부록 A · V5 30분 블럭).
 * 각 시나리오는 서로 다른 엣지케이스(전형충돌 / 완벽한시간없음 / 필수자충돌 / 장소병목 / 이슈대응)를 자극한다.
 * constraints 에는 'avoid'·'unavailable' 셀만 시드한다(나머지는 알고리즘이 'available'로 간주).
 * 공통 기간: 2026-06-29(월) ~ 2026-07-03(금) = 5영업일. 회의 길이 기본 60분(=연속 2블럭).
 */
import type { Attendee, ConstraintCell, MeetingConfig, Room, SlotKey, Availability, UnavailableReason } from '../types';

/** 한 시나리오 시드 */
export interface Scenario {
  id: string;
  name: string;
  purpose: string;
  config: MeetingConfig;
  attendees: Attendee[];
  rooms: Room[];
  constraints: ConstraintCell[];
}

// ===== 블럭 유틸 (시드 전용) =====
/** 유효 블럭 — 점심(6·7) 제외, 하루 16개 */
const VALID_BLOCKS = [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
/** 오전 09:00–12:00 = blocks 0–5 */
const MORNING = [0, 1, 2, 3, 4, 5];
/** 오후 13:00–18:00 = blocks 8–17 */
const AFTERNOON = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
/** 점심 직후 13:00–14:00 = blocks 8,9 */
const LUNCH_AFTER = [8, 9];
/** 17시대 17:00–18:00 = blocks 16,17 */
const HOUR_17 = [16, 17];
const DAYS = [0, 1, 2, 3, 4];

/** 공통 기간 (월~금 5영업일) */
const DATE_RANGE = { start: '2026-06-29', end: '2026-07-03' };

/** 셀 생성 — 하루 전체 유효 블럭 */
function fullDay(
  attendeeId: string,
  day: number,
  status: Availability,
  reason?: UnavailableReason,
  reasonText?: string,
): ConstraintCell[] {
  return VALID_BLOCKS.map((blockIndex) => ({ attendeeId, slot: { day, blockIndex }, status, reason, reasonText }));
}

/** 셀 생성 — 특정 요일의 특정 블럭들 */
function atBlocks(
  attendeeId: string,
  day: number,
  blocks: number[],
  status: Availability,
  reason?: UnavailableReason,
  reasonText?: string,
): ConstraintCell[] {
  return blocks.map((blockIndex) => ({ attendeeId, slot: { day, blockIndex }, status, reason, reasonText }));
}

/** 회의실 가용 SlotKey 목록 — days × blocks */
function roomSlots(days: number[], blocks: number[]): SlotKey[] {
  return days.flatMap((day) => blocks.map((b) => `${day}-${b}`));
}

const COLORS = ['#0064FF', '#7B61FF', '#00C2A8', '#FF6B6B', '#FFB020', '#00C880', '#FF9500', '#22B8CF'];

// ============================================================
// 시나리오 1 — 전형적 충돌 (기본값) · 오프라인
// ============================================================
const s1Attendees: Attendee[] = [
  { id: 's1-jihun', name: '지훈', role: 'required', avatarColor: COLORS[0] }, // PM
  { id: 's1-seoyeon', name: '서연', role: 'required', avatarColor: COLORS[1] }, // 디자인 리드
  { id: 's1-minjun', name: '민준', role: 'required', avatarColor: COLORS[2] }, // 개발 리드
  { id: 's1-haneul', name: '하늘', role: 'optional', avatarColor: COLORS[3] }, // 마케터
  { id: 's1-doyun', name: '도윤', role: 'optional', avatarColor: COLORS[4] }, // 개발
  { id: 's1-yuna', name: '유나', role: 'optional', avatarColor: COLORS[5] }, // QA
];

const s1Rooms: Room[] = [
  { id: 's1-roomA', name: '회의실 A', available: roomSlots(DAYS, VALID_BLOCKS) }, // 종일
  { id: 's1-roomB', name: '회의실 B', available: roomSlots(DAYS, MORNING) }, // 오전만
];

const s1Constraints: ConstraintCell[] = [
  // 지훈: 화요일(day1) 종일 외근 ✕
  ...fullDay('s1-jihun', 1, 'unavailable', '외근'),
  // 서연: 매일 점심 직후(13:00–14:00) 회피 ▲
  ...DAYS.flatMap((d) => atBlocks('s1-seoyeon', d, LUNCH_AFTER, 'avoid', undefined, '점심직후')),
  // 서연: 금요일(day4) 오전 집중 회피 ▲
  ...atBlocks('s1-seoyeon', 4, MORNING, 'avoid', undefined, '오전 집중'),
  // 민준: 월요일(day0) 오전 미출근 ✕
  ...atBlocks('s1-minjun', 0, MORNING, 'unavailable', '미출근'),
  // 하늘: 수요일(day2) 휴가 ✕
  ...fullDay('s1-haneul', 2, 'unavailable', '휴가'),
  // 도윤: 매일 17시대(17:00–18:00) 회피 ▲ (퇴근 준비)
  ...DAYS.flatMap((d) => atBlocks('s1-doyun', d, HOUR_17, 'avoid', undefined, '퇴근준비')),
  // 유나: 목요일(day3) 오후 외근 ✕
  ...atBlocks('s1-yuna', 3, AFTERNOON, 'unavailable', '외근'),
];

const scenario1: Scenario = {
  id: 'scenario-1',
  name: '전형적 충돌',
  purpose: '모든 변수(필수/선택·3단계 상태·오프라인 장소)가 한 번에 작동하는 표준 케이스',
  config: { title: '제품팀 주간 회의', durationMinutes: 60, dateRange: DATE_RANGE, location: 'offline', rooms: s1Rooms },
  attendees: s1Attendees,
  rooms: s1Rooms,
  constraints: s1Constraints,
};

// ============================================================
// 시나리오 2 — 완벽한 시간 없음 (양보 필연) · 필수4/선택2 · 온라인
// 매일 1명씩 종일 'avoid'를 깔아 100% 만족(yielding 0) 후보가 하나도 없게 한다.
// ============================================================
const s2Attendees: Attendee[] = [
  { id: 's2-r1', name: '태호', role: 'required', avatarColor: COLORS[0] },
  { id: 's2-r2', name: '예린', role: 'required', avatarColor: COLORS[1] },
  { id: 's2-r3', name: '준서', role: 'required', avatarColor: COLORS[2] },
  { id: 's2-r4', name: '소민', role: 'required', avatarColor: COLORS[3] },
  { id: 's2-o1', name: '재현', role: 'optional', avatarColor: COLORS[4] },
  { id: 's2-o2', name: '나윤', role: 'optional', avatarColor: COLORS[5] },
];

const s2Constraints: ConstraintCell[] = [
  ...fullDay('s2-r1', 0, 'avoid', undefined, '오전 미팅 연속'),
  ...fullDay('s2-r2', 1, 'avoid', undefined, '집중 업무'),
  ...fullDay('s2-r3', 2, 'avoid', undefined, '외부 미팅 대기'),
  ...fullDay('s2-r4', 3, 'avoid', undefined, '리뷰 주간'),
  ...fullDay('s2-o1', 4, 'avoid', undefined, '재택 선호'),
];

const scenario2: Scenario = {
  id: 'scenario-2',
  name: '완벽한 시간 없음',
  purpose: '모든 슬롯에 최소 1명의 회피가 걸려 "양보 없이는 불가능"함을 투명성 보드가 증명',
  config: { title: '신규 캠페인 킥오프', durationMinutes: 60, dateRange: DATE_RANGE, location: 'online', rooms: [] },
  attendees: s2Attendees,
  rooms: [],
  constraints: s2Constraints,
};

// ============================================================
// 시나리오 3 — 필수자끼리 충돌 (후보 희소) · 필수5/선택1 · 오프라인(종일 회의실)
// 월~목은 필수 5명 전원 종일 불가, 금요일도 막혀 60분 가능 후보는 금 13:00(block8) 단 1개뿐.
// ============================================================
const s3Attendees: Attendee[] = [
  { id: 's3-r1', name: '현우', role: 'required', avatarColor: COLORS[0] },
  { id: 's3-r2', name: '지아', role: 'required', avatarColor: COLORS[1] },
  { id: 's3-r3', name: '도현', role: 'required', avatarColor: COLORS[2] },
  { id: 's3-r4', name: '수빈', role: 'required', avatarColor: COLORS[3] },
  { id: 's3-r5', name: '민서', role: 'required', avatarColor: COLORS[4] },
  { id: 's3-o1', name: '하준', role: 'optional', avatarColor: COLORS[5] },
];

const s3RequiredIds = ['s3-r1', 's3-r2', 's3-r3', 's3-r4', 's3-r5'];
const s3Reasons: UnavailableReason[] = ['외근', '휴가', '회의', '외근', '휴가'];

const s3Constraints: ConstraintCell[] = [
  // 월~목(day 0~3): 필수 5명 전원 종일 불가 ✕
  ...s3RequiredIds.flatMap((id, i) =>
    [0, 1, 2, 3].flatMap((d) => fullDay(id, d, 'unavailable', s3Reasons[i] ?? '외근')),
  ),
  // 금요일(day4): r1 오전 불가 ✕, r2 14:00 이후(blocks 10–17) 불가 ✕ → 60분 후보는 13:00(block8) 한 칸만
  ...atBlocks('s3-r1', 4, MORNING, 'unavailable', '외근'),
  ...atBlocks('s3-r2', 4, [10, 11, 12, 13, 14, 15, 16, 17], 'unavailable', '외근'),
];

const s3Rooms: Room[] = [{ id: 's3-roomA', name: '회의실 A', available: roomSlots(DAYS, VALID_BLOCKS) }];

const scenario3: Scenario = {
  id: 'scenario-3',
  name: '필수자 충돌 (후보 희소)',
  purpose: '필수 참석자들의 불가가 서로 어긋나 가능 후보가 1개로 극히 적은 상황. Hard 제약·완화 제안 검증',
  config: { title: '분기 전략 확정 회의', durationMinutes: 60, dateRange: DATE_RANGE, location: 'offline', rooms: s3Rooms },
  attendees: s3Attendees,
  rooms: s3Rooms,
  constraints: s3Constraints,
};

// ============================================================
// 시나리오 4 — 장소 병목 · 필수3/선택3 · 오프라인
// 시간 제약 없음(전원 가능)이지만 회의실은 월(day0) 오전 블럭만 비어 있어 장소가 결정 요인.
// ============================================================
const s4Attendees: Attendee[] = [
  { id: 's4-r1', name: '서진', role: 'required', avatarColor: COLORS[0] },
  { id: 's4-r2', name: '유진', role: 'required', avatarColor: COLORS[1] },
  { id: 's4-r3', name: '건우', role: 'required', avatarColor: COLORS[2] },
  { id: 's4-o1', name: '아린', role: 'optional', avatarColor: COLORS[3] },
  { id: 's4-o2', name: '시우', role: 'optional', avatarColor: COLORS[4] },
  { id: 's4-o3', name: '채원', role: 'optional', avatarColor: COLORS[5] },
];

// 회의실 1개 — 월(day0) 오전 블럭 0–5 전부 가용, 그 외 없음
const s4Rooms: Room[] = [{ id: 's4-room', name: '회의실 단독', available: roomSlots([0], MORNING) }];

const scenario4: Scenario = {
  id: 'scenario-4',
  name: '장소 병목',
  purpose: '오프라인인데 회의실이 월요일 오전에만 있어 후보가 그 시간대로 좁혀지는 V3 강조 케이스. 완화에서 온라인 전환·회의실 확보가 병목을 푼다',
  config: { title: '전사 타운홀 준비 회의', durationMinutes: 60, dateRange: DATE_RANGE, location: 'offline', rooms: s4Rooms },
  attendees: s4Attendees,
  rooms: s4Rooms,
  constraints: [], // 시간 제약 없음(전원 가능) — 장소가 유일한 제약
};

// ============================================================
// 시나리오 5 — 이슈 발생 → 다음 순위 (V4 운영 데모)
// 시나리오 1 데이터를 그대로 재사용해 확정 후 이슈 대응을 시연.
// ============================================================
const scenario5: Scenario = {
  id: 'scenario-5',
  name: '이슈 대응 (다음 순위)',
  purpose: '시나리오 1을 확정한 상태에서 1순위가 무너졌을 때 다음 순위 이동을 시연(V4)',
  config: { ...scenario1.config, title: '제품팀 주간 회의 (운영)' },
  attendees: scenario1.attendees,
  rooms: scenario1.rooms,
  constraints: scenario1.constraints,
};

export const scenarios: Scenario[] = [scenario1, scenario2, scenario3, scenario4, scenario5];

/** 기본 시나리오 — 전형적 충돌 */
export const defaultScenario: Scenario = scenarios[0]!;

export default scenarios;
