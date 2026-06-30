/**
 * 도메인 타입 (PRD 6.1 · V5 30분 블럭 모델).
 * 회의 일정 조율의 핵심 모델 — 참석 중요도(V1)·참석 가능 상태(V2)·장소(V3)·회의 길이/기간(V5)·사후 이슈(V4).
 * 필드명은 다운스트림(알고리즘·시드·화면)이 의존하므로 임의 변경 금지.
 */

/** 참석 가능 상태 — 3단계 (V2). 가능 / 회피선호 / 불가 */
export type Availability = 'available' | 'avoid' | 'unavailable';

/** '불가' 사유 태그. '기타'는 reasonText 로 자유 입력 */
export type UnavailableReason = '외근' | '미출근' | '퇴근후' | '휴가' | '회의' | '기타';

/** 참석 중요도 (V1) — 필수/선택 */
export type AttendeeRole = 'required' | 'optional';

/** 회의 장소 형태 (V3) — 온라인이면 회의실 무관 */
export type MeetingLocation = 'online' | 'offline';

/** 회의 참석자 */
export interface Attendee {
  id: string;
  name: string;
  role: AttendeeRole;
  /** 아바타 배경색 (페르소나별 고유색) */
  avatarColor?: string;
}

/** 30분 블럭 슬롯. day=0-based 영업일 인덱스(0=dateRange 첫 영업일).
 * blockIndex: 0=09:00–09:30 … 17=17:30–18:00. 유효블럭 {0–17} 하루 18개(끊김 없이 전부 표시).
 * 점심 11:30–13:00 = blockIndex 5·6·7 은 격자에 보이되 명시적 제약이 없으면 기본 '불가'(사유 '점심')로 처리. */
export interface Slot {
  day: number;
  blockIndex: number;
}

export type SlotKey = string; // `${day}-${blockIndex}`
export type DurationMinutes = 30 | 60 | 90 | 120;

/** 회의실(V3). available = 비어있는(예약가능) 블럭들의 SlotKey 집합 */
export interface Room {
  id: string;
  name: string;
  available: SlotKey[];
}

/** 참석자 한 명의 특정 30분 블럭에 대한 제약 (격자 셀) */
export interface ConstraintCell {
  attendeeId: string;
  slot: Slot;
  status: Availability;
  /** status === 'unavailable' 일 때의 사유 태그 */
  reason?: UnavailableReason;
  /** reason === '기타' 이거나 자유 사유일 때 직접 입력한 텍스트 */
  reasonText?: string;
}

/** 회의 설정 (V5 가변 길이·기간 + V3 장소목록) */
export interface MeetingConfig {
  title: string;
  /** 회의 길이. 연속 블럭 수 = durationMinutes/30 */
  durationMinutes: DurationMinutes;
  /** 후보 기간 — ISO 'YYYY-MM-DD'. 영업일(월~금)만 슬롯 생성 */
  dateRange: { start: string; end: string };
  location: MeetingLocation;
  /** 오프라인 후보 회의실 목록 (온라인이면 무시) */
  rooms: Room[];
}

/** 슬롯에서 양보하는 사람 + 사유 (회피인데 포함됨) */
export interface Yielding {
  attendee: Attendee;
  /** 양보 사유 설명 (예: "점심직후 회피") */
  reason: string;
}

/**
 * 추천 후보 (1~5순위). 회의는 연속 blocks 개의 30분 블럭을 점유 → 후보는 "시작 블럭".
 * satisfied: 'available' 인 사람들. yielding: 'avoid' 인데 포함된 사람들. absent: '불가'라 불참하는 선택 참석자들.
 */
export interface RankedCandidate {
  startSlot: Slot;
  /** 점유 블럭 수 (= durationMinutes/30) */
  blocks: number;
  score: number;
  satisfied: Attendee[];
  yielding: Yielding[];
  absent: Attendee[];
  /** 오프라인일 때 점유 블럭 전부에 가용한 회의실(첫 매칭). 온라인이면 undefined */
  room?: Room;
  /** 온라인이거나, 오프라인이면 점유 블럭 전부 가용한 회의실 ≥1 */
  roomAvailable: boolean;
  /** 1..n */
  rank: number;
}

/** 제약 완화 액션 유형 (3.5.1) */
export type RelaxationType =
  | 'exclude-optional' // 선택자 제외
  | 'ignore-avoid' // 회피 무시(양보 전환)
  | 'adjust-hard' // 불가 부분 조정
  | 'switch-online'; // 온라인 전환

/** 제약 완화 제안 (3.5.1) */
export interface RelaxationSuggestion {
  type: RelaxationType;
  /** 완화 대상 (누구의/어느 슬롯의 무엇) */
  target?: {
    attendeeId?: string;
    attendeeName?: string;
    slot?: Slot;
    reason?: string;
  };
  /** 후보 증가량 (|candidates_r| − |base|) */
  gain: number;
  /** 완화 부담 비용 (불가>회피>선택자제외>온라인전환) */
  cost: number;
  /** 완화 후 최상위 후보 점수 */
  bestRank: number;
  /** 한국어 설명 — "무엇을 / 누가 / 결과" */
  description: string;
  /** 완화 적용 후 새 1순위 시작 슬롯 미리보기 */
  previewTopSlot?: Slot;
  /** 2단계 조합 시 함께 적용한 또 다른 완화 */
  combinedWith?: RelaxationSuggestion;
}
