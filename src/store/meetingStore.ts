/**
 * 회의 일정 조율 전역 스토어 (Zustand v5).
 * 상태(설정·참석자·제약)를 단일 소스로 두고, 추천 후보/완화 제안은 recommend()·suggestRelaxations()로 파생한다.
 * 확정 랭킹·이슈 로그·완화 undo 스택까지 운영(V4) 시나리오를 한 스토어에서 다룬다.
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type {
  Attendee,
  AttendeeRole,
  Availability,
  ConstraintCell,
  DurationMinutes,
  MeetingConfig,
  RankedCandidate,
  RelaxationSuggestion,
  Room,
} from '../types';
import { recommend, suggestRelaxations, formatRange, generateSlots, slotKey, isLunchBlock } from '../lib/recommend';
import { scenarios, defaultScenario, type Scenario } from '../data/scenarios';

// ===== 헬퍼 타입 =====

/** 이슈/운영 로그 한 줄 (확정·순위이동·완화·완화되돌림) */
export interface IssueLogEntry {
  at: number; // Date.now()
  kind: 'confirm' | 'rank-move' | 'relax' | 'undo-relax';
  description: string; // 한국어 설명
  fromRank?: number; // rank-move 시 (1-based)
  toRank?: number; // rank-move 시 (1-based)
}

/** 완화 적용 직전 상태 스냅샷 (undo 복원용) */
export interface RelaxationSnapshot {
  suggestion: RelaxationSuggestion;
  config: MeetingConfig;
  attendees: Attendee[];
  constraints: ConstraintCell[];
}

// ===== 참석자 인프라 상수 =====

/** 신규 참석자 아바타 색 팔레트 — 인원 수 기준 순환 배정 (scenarios 시드와 동일 계열) */
const AVATAR_PALETTE = [
  '#0064FF',
  '#7B61FF',
  '#00C2A8',
  '#FF6B6B',
  '#FFB020',
  '#00C880',
  '#FF9500',
  '#22B8CF',
];

/** 참석자 인원 경계 — 이 밖에서는 추가/삭제 액션이 no-op */
export const MIN_ATTENDEES = 2;
export const MAX_ATTENDEES = 12;

// ===== 순수 헬퍼 (init·actions 공유) =====

/** 현재 입력으로 추천 후보를 파생 */
function deriveCandidates(
  attendees: Attendee[],
  constraints: ConstraintCell[],
  config: MeetingConfig,
): RankedCandidate[] {
  return recommend(attendees, constraints, config);
}

/** 현재 입력으로 완화 제안을 파생 */
function deriveRelaxations(
  attendees: Attendee[],
  constraints: ConstraintCell[],
  config: MeetingConfig,
): RelaxationSuggestion[] {
  return suggestRelaxations(attendees, constraints, config);
}

/** 후보 1순위 표기 — "월요일 13:00–14:00" */
function topLabel(candidate: RankedCandidate, config: MeetingConfig): string {
  return formatRange(candidate.startSlot, config.durationMinutes);
}

/** 시나리오로부터 초기/재설정 상태 조각을 생성 (깊은 복사) */
function buildScenarioState(scenario: Scenario): Pick<
  MeetingState,
  | 'scenarioId'
  | 'config'
  | 'attendees'
  | 'constraints'
  | 'candidates'
  | 'relaxations'
  | 'confirmedRanking'
  | 'currentRankIndex'
  | 'finalChoice'
  | 'issueLog'
  | 'appliedRelaxations'
> {
  const config = structuredClone(scenario.config);
  const attendees = structuredClone(scenario.attendees);
  const constraints = structuredClone(scenario.constraints);
  return {
    scenarioId: scenario.id,
    config,
    attendees,
    constraints,
    candidates: deriveCandidates(attendees, constraints, config),
    relaxations: deriveRelaxations(attendees, constraints, config),
    confirmedRanking: null,
    currentRankIndex: 0,
    finalChoice: 0,
    issueLog: [],
    appliedRelaxations: [],
  };
}

/** 동일 슬롯 셀 판정 — (attendeeId, day, blockIndex) */
function sameCell(a: ConstraintCell, attendeeId: string, day: number, blockIndex: number): boolean {
  return a.attendeeId === attendeeId && a.slot.day === day && a.slot.blockIndex === blockIndex;
}

/**
 * 완화 한 건을 입력 상태(attendees/constraints/config)에 적용한 새 조각을 반환.
 * combinedWith 처리를 위해 type/target 단위로 재사용한다.
 */
function applyOneRelaxation(
  type: RelaxationSuggestion['type'],
  target: RelaxationSuggestion['target'],
  attendees: Attendee[],
  constraints: ConstraintCell[],
  config: MeetingConfig,
): { attendees: Attendee[]; constraints: ConstraintCell[]; config: MeetingConfig } {
  switch (type) {
    case 'exclude-optional': {
      // 선택 참석자 제외
      const nextAttendees = target?.attendeeId
        ? attendees.filter((a) => a.id !== target.attendeeId)
        : attendees;
      return { attendees: nextAttendees, constraints, config };
    }
    case 'ignore-avoid':
    case 'adjust-hard': {
      // 해당 셀 제거 → available 로 복귀
      const nextConstraints =
        target?.attendeeId && target.slot
          ? constraints.filter(
              (c) => !sameCell(c, target.attendeeId!, target.slot!.day, target.slot!.blockIndex),
            )
          : constraints;
      return { attendees, constraints: nextConstraints, config };
    }
    case 'secure-room': {
      // 오프라인 유지하며 전 유효블럭 가용한 회의실 1개 확보
      const available = generateSlots(config).map((s) => slotKey(s));
      const room: Room = {
        id: `room-secured-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        name: '확보한 회의실',
        available,
      };
      return { attendees, constraints, config: { ...config, rooms: [...config.rooms, room] } };
    }
    case 'switch-online': {
      // 온라인 전환
      return { attendees, constraints, config: { ...config, location: 'online' } };
    }
    default:
      return { attendees, constraints, config };
  }
}

// ===== 상태 + 액션 타입 =====

export interface MeetingState {
  // --- 상태 ---
  /** 현재 시나리오 id */
  scenarioId: string;
  /** 회의 설정 */
  config: MeetingConfig;
  /** 참석자 목록 */
  attendees: Attendee[];
  /** 제약 셀 (avoid/unavailable 만 저장; available 은 미저장) */
  constraints: ConstraintCell[];
  /** recommend() 파생 추천 후보 (1~5순위) */
  candidates: RankedCandidate[];
  /** suggestRelaxations() 파생 완화 제안 */
  relaxations: RelaxationSuggestion[];
  /** 확정된 랭킹 스냅샷 (미확정이면 null) */
  confirmedRanking: RankedCandidate[] | null;
  /** 확정 랭킹 내 현재 순위 인덱스 (0-based) */
  currentRankIndex: number;
  /** 확정 랭킹 내 최종 선택 인덱스 (0-based). currentRankIndex 와 동기 유지 */
  finalChoice: number;
  /** 이슈/운영 로그 */
  issueLog: IssueLogEntry[];
  /** 완화 undo 스택 (가장 최근이 마지막) */
  appliedRelaxations: RelaxationSnapshot[];

  // --- 액션 ---
  /** 시나리오 로드(없으면 no-op). 입력을 깊은 복사하고 확정/로그/undo 를 초기화 */
  loadScenario: (id: string) => void;
  /** 설정 부분 변경 후 재계산 */
  setConfig: (patch: Partial<MeetingConfig>) => void;
  /** 회의 길이 변경 후 재계산 */
  setDuration: (min: DurationMinutes) => void;
  /** 후보 기간 변경 후 재계산 */
  setDateRange: (start: string, end: string) => void;
  /** 회의실 추가(모든 유효블럭 가용) 후 재계산 */
  addRoom: (name: string) => void;
  /** 회의실 제거 후 재계산 */
  removeRoom: (id: string) => void;
  /** 참석자 역할 변경 후 재계산 */
  setAttendeeRole: (id: string, role: AttendeeRole) => void;
  /** 참석자 이름 변경 (아바타 이니셜은 이름 첫 글자로 자동 반영) 후 재계산 */
  setAttendeeName: (id: string, name: string) => void;
  /** 참석자 추가 — 새 id·기본 role 'optional'·팔레트 순환 색. 최대 인원 초과 시 no-op. 추가 후 재계산 */
  addAttendee: (name?: string) => void;
  /** 참석자 삭제 — 해당 참석자의 제약 셀도 함께 제거 후 재계산. 최소 인원 이하이면 no-op */
  removeAttendee: (id: string) => void;
  /** 제약 셀 추가/교체(available 이면 제거) 후 재계산 */
  setConstraint: (cell: ConstraintCell) => void;
  /** 후보/완화 재계산 (확정 랭킹은 건드리지 않음) */
  recompute: () => void;
  /** 현재 후보를 확정 랭킹으로 복사 */
  confirm: () => void;
  /** 확정 랭킹에서 다음 순위로 이동 */
  moveToNextRank: () => void;
  /** 확정 랭킹 내 최종 선택을 직접 지정 (0-based) */
  setFinalChoice: (rankIndex: number) => void;
  /** 완화 적용(스냅샷 push 후 상태 변경, combinedWith 포함) */
  applyRelaxation: (suggestion: RelaxationSuggestion) => void;
  /** 직전 완화 되돌림(스냅샷 복원) */
  undoRelaxation: () => void;
}

// ===== 스토어 생성 =====

export const useMeetingStore = create<MeetingState>()((set, get) => ({
  // 모듈 로드 즉시 기본 시나리오로 초기 상태 계산 (useEffect 불필요)
  ...buildScenarioState(defaultScenario),

  loadScenario: (id) => {
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) return; // 없으면 no-op
    set(buildScenarioState(scenario));
  },

  setConfig: (patch) => {
    const config = { ...get().config, ...patch };
    const { attendees, constraints } = get();
    set({
      config,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  setDuration: (min) => {
    const config = { ...get().config, durationMinutes: min };
    const { attendees, constraints } = get();
    set({
      config,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  setDateRange: (start, end) => {
    const config: MeetingConfig = { ...get().config, dateRange: { start, end } };
    const { attendees, constraints } = get();
    set({
      config,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  addRoom: (name) => {
    const current = get().config;
    // 새 회의실은 모든 유효블럭이 가용한 상태로 추가
    const available = generateSlots(current).map((s) => slotKey(s));
    const room: Room = { id: `room-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name, available };
    const config: MeetingConfig = { ...current, rooms: [...current.rooms, room] };
    const { attendees, constraints } = get();
    set({
      config,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  removeRoom: (id) => {
    const current = get().config;
    const config: MeetingConfig = { ...current, rooms: current.rooms.filter((r) => r.id !== id) };
    const { attendees, constraints } = get();
    set({
      config,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  setAttendeeRole: (id, role) => {
    const attendees = get().attendees.map((a) => (a.id === id ? { ...a, role } : a));
    const { constraints, config } = get();
    set({
      attendees,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  setAttendeeName: (id, name) => {
    const attendees = get().attendees.map((a) => (a.id === id ? { ...a, name } : a));
    const { constraints, config } = get();
    // 이름은 점수에 영향 없지만, 후보 카드의 참석자 표기를 최신화하기 위해 재파생
    set({
      attendees,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  addAttendee: (name) => {
    const current = get().attendees;
    if (current.length >= MAX_ATTENDEES) return; // 최대 인원 제한
    const trimmed = name?.trim();
    const attendee: Attendee = {
      id: `attendee-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: trimmed && trimmed.length > 0 ? trimmed : `참석자 ${current.length + 1}`,
      role: 'optional',
      // 팔레트를 현재 인원 수 기준으로 순환 배정
      avatarColor: AVATAR_PALETTE[current.length % AVATAR_PALETTE.length],
    };
    const attendees = [...current, attendee];
    const { constraints, config } = get();
    set({
      attendees,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  removeAttendee: (id) => {
    const current = get().attendees;
    if (current.length <= MIN_ATTENDEES) return; // 최소 인원 제한
    const attendees = current.filter((a) => a.id !== id);
    // 정합성 — 삭제된 참석자의 제약 셀도 함께 제거해 유령 제약이 남지 않게 한다
    const constraints = get().constraints.filter((c) => c.attendeeId !== id);
    const { config } = get();
    set({
      attendees,
      constraints,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  setConstraint: (cell) => {
    const { day, blockIndex } = cell.slot;
    const without = get().constraints.filter((c) => !sameCell(c, cell.attendeeId, day, blockIndex));
    // 슬롯 기본값과 같은 상태는 저장하지 않고 제거(=기본 복귀).
    // 점심 블럭(5·6·7) 기본은 '불가', 그 외는 '가능'. 점심칸을 '가능'으로 override하면 저장돼 유지된다.
    const defaultStatus: Availability = isLunchBlock(blockIndex) ? 'unavailable' : 'available';
    const constraints =
      cell.status === defaultStatus ? without : [...without, structuredClone(cell)];
    const { attendees, config } = get();
    set({
      constraints,
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  recompute: () => {
    const { attendees, constraints, config } = get();
    set({
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
    });
  },

  confirm: () => {
    const { candidates, issueLog, config } = get();
    const confirmedRanking = structuredClone(candidates);
    const description =
      candidates.length === 0 ? '확정할 후보 없음' : `${topLabel(candidates[0]!, config)} 확정`;
    const entry: IssueLogEntry = { at: Date.now(), kind: 'confirm', description };
    set({
      confirmedRanking,
      currentRankIndex: 0,
      finalChoice: 0,
      issueLog: [...issueLog, entry],
    });
  },

  moveToNextRank: () => {
    const { confirmedRanking, currentRankIndex, issueLog, config } = get();
    if (!confirmedRanking) return;
    const newIndex = currentRankIndex + 1;
    if (newIndex >= confirmedRanking.length) return; // 더 이상 다음 순위 없음
    const fromRank = currentRankIndex + 1; // 1-based
    const toRank = newIndex + 1; // 1-based
    const entry: IssueLogEntry = {
      at: Date.now(),
      kind: 'rank-move',
      fromRank,
      toRank,
      description: `${fromRank}순위 → ${toRank}순위 이동: ${topLabel(confirmedRanking[newIndex]!, config)}`,
    };
    set({ currentRankIndex: newIndex, finalChoice: newIndex, issueLog: [...issueLog, entry] });
  },

  setFinalChoice: (rankIndex) => {
    const { confirmedRanking, currentRankIndex, issueLog, config } = get();
    if (!confirmedRanking) return;
    if (rankIndex < 0 || rankIndex >= confirmedRanking.length) return; // 범위 밖이면 no-op
    if (rankIndex === currentRankIndex) {
      set({ finalChoice: rankIndex });
      return;
    }
    const fromRank = currentRankIndex + 1;
    const toRank = rankIndex + 1;
    const entry: IssueLogEntry = {
      at: Date.now(),
      kind: 'rank-move',
      fromRank,
      toRank,
      description: `${fromRank}순위 → ${toRank}순위 선택: ${topLabel(confirmedRanking[rankIndex]!, config)}`,
    };
    set({ finalChoice: rankIndex, currentRankIndex: rankIndex, issueLog: [...issueLog, entry] });
  },

  applyRelaxation: (suggestion) => {
    const { attendees, constraints, config, appliedRelaxations, issueLog } = get();
    // 적용 직전 스냅샷(깊은 복사)을 undo 스택에 push
    const snapshot: RelaxationSnapshot = {
      suggestion: structuredClone(suggestion),
      config: structuredClone(config),
      attendees: structuredClone(attendees),
      constraints: structuredClone(constraints),
    };

    // 주 완화 적용
    let next = applyOneRelaxation(suggestion.type, suggestion.target, attendees, constraints, config);
    // 2단계 조합 완화도 동일 규칙으로 적용
    if (suggestion.combinedWith) {
      next = applyOneRelaxation(
        suggestion.combinedWith.type,
        suggestion.combinedWith.target,
        next.attendees,
        next.constraints,
        next.config,
      );
    }

    const entry: IssueLogEntry = { at: Date.now(), kind: 'relax', description: suggestion.description };
    set({
      attendees: next.attendees,
      constraints: next.constraints,
      config: next.config,
      candidates: deriveCandidates(next.attendees, next.constraints, next.config),
      relaxations: deriveRelaxations(next.attendees, next.constraints, next.config),
      appliedRelaxations: [...appliedRelaxations, snapshot],
      issueLog: [...issueLog, entry],
    });
  },

  undoRelaxation: () => {
    const { appliedRelaxations, issueLog } = get();
    if (appliedRelaxations.length === 0) return; // 스택 비었으면 no-op
    const stack = appliedRelaxations.slice();
    const snapshot = stack.pop()!;
    const { config, attendees, constraints } = snapshot;
    const entry: IssueLogEntry = {
      at: Date.now(),
      kind: 'undo-relax',
      description: `완화 되돌림: ${snapshot.suggestion.description}`,
    };
    set({
      config: structuredClone(config),
      attendees: structuredClone(attendees),
      constraints: structuredClone(constraints),
      candidates: deriveCandidates(attendees, constraints, config),
      relaxations: deriveRelaxations(attendees, constraints, config),
      appliedRelaxations: stack,
      issueLog: [...issueLog, entry],
    });
  },
}));

// ===== 셀렉터 훅 =====

/** 추천 후보 (동일 참조) */
export const useCandidates = (): RankedCandidate[] => useMeetingStore((s) => s.candidates);

/** 완화 제안 (동일 참조) */
export const useRelaxations = (): RelaxationSuggestion[] => useMeetingStore((s) => s.relaxations);

/** 최상위(1순위) 후보 */
export const useTopCandidate = (): RankedCandidate | undefined =>
  useMeetingStore((s) => s.candidates[0]);

/** 현재 운영 중인 후보 — 확정 랭킹의 현재 순위, 없으면 1순위 후보 */
export const useCurrentCandidate = (): RankedCandidate | undefined =>
  useMeetingStore((s) => s.confirmedRanking?.[s.currentRankIndex] ?? s.candidates[0]);

/** 확정 랭킹 내 최종 선택 후보 */
export const useFinalChoice = (): RankedCandidate | undefined =>
  useMeetingStore((s) => s.confirmedRanking?.[s.finalChoice]);

/** 회의 설정 */
export const useConfig = (): MeetingConfig => useMeetingStore((s) => s.config);

/** 참석자 목록 */
export const useAttendees = (): Attendee[] => useMeetingStore((s) => s.attendees);

/** 제약 셀 목록 */
export const useConstraints = (): ConstraintCell[] => useMeetingStore((s) => s.constraints);

/** 이슈/운영 로그 */
export const useIssueLog = (): IssueLogEntry[] => useMeetingStore((s) => s.issueLog);

/** 현재 시나리오 메타 (id/name/purpose) */
export const useScenarioMeta = (): { id: string; name: string; purpose: string } =>
  useMeetingStore(
    useShallow((s) => {
      const found = scenarios.find((sc) => sc.id === s.scenarioId) ?? defaultScenario;
      return { id: found.id, name: found.name, purpose: found.purpose };
    }),
  );

/** 액션 번들 (useShallow 로 참조 안정화) */
export const useMeetingActions = (): {
  loadScenario: MeetingState['loadScenario'];
  setConfig: MeetingState['setConfig'];
  setDuration: MeetingState['setDuration'];
  setDateRange: MeetingState['setDateRange'];
  addRoom: MeetingState['addRoom'];
  removeRoom: MeetingState['removeRoom'];
  setAttendeeRole: MeetingState['setAttendeeRole'];
  setAttendeeName: MeetingState['setAttendeeName'];
  addAttendee: MeetingState['addAttendee'];
  removeAttendee: MeetingState['removeAttendee'];
  setConstraint: MeetingState['setConstraint'];
  recompute: MeetingState['recompute'];
  confirm: MeetingState['confirm'];
  moveToNextRank: MeetingState['moveToNextRank'];
  setFinalChoice: MeetingState['setFinalChoice'];
  applyRelaxation: MeetingState['applyRelaxation'];
  undoRelaxation: MeetingState['undoRelaxation'];
} =>
  useMeetingStore(
    useShallow((s) => ({
      loadScenario: s.loadScenario,
      setConfig: s.setConfig,
      setDuration: s.setDuration,
      setDateRange: s.setDateRange,
      addRoom: s.addRoom,
      removeRoom: s.removeRoom,
      setAttendeeRole: s.setAttendeeRole,
      setAttendeeName: s.setAttendeeName,
      addAttendee: s.addAttendee,
      removeAttendee: s.removeAttendee,
      setConstraint: s.setConstraint,
      recompute: s.recompute,
      confirm: s.confirm,
      moveToNextRank: s.moveToNextRank,
      setFinalChoice: s.setFinalChoice,
      applyRelaxation: s.applyRelaxation,
      undoRelaxation: s.undoRelaxation,
    })),
  );
