/**
 * 제약 편집기 — 두 입력 모드(버튼/채팅)가 공유하는 공통 컨테이너.
 * 상단에 "현재 제약 현황"(공유 주간 격자)을 항상 노출하고,
 * 하단에만 모드별 입력 수단(브러시 팔레트 ↔ 자연어 채팅)을 바꿔 끼운다.
 * 채팅 모드에서는 격자를 read-only 로 보여줘 입력 결과를 실시간으로 확인한다.
 * 제약은 절대 로컬 복제하지 않고 store(useConstraints)에서 파생한다.
 */
import { useCallback, useMemo, useState } from 'react';
import { useConstraints, useAttendees, useConfig, useMeetingActions } from '../../store';
import { makeConstraintLookup, businessDayCount } from '../../lib/recommend';
import { Badge } from '../../components/ui';
import type { Availability, ConstraintCell, Slot, UnavailableReason } from '../../types';
import type { InputMode } from './ModeTabs';
import { AttendeeTabs } from './AttendeeTabs';
import { BrushPalette } from './BrushPalette';
import { SlotGrid } from './SlotGrid';
import { RoomSlotGrid } from './RoomSlotGrid';
import { ConstraintChat } from './ConstraintChat';
import { ConstraintSummary } from './ConstraintSummary';
import styles from './ConstraintEditor.module.css';

export interface ConstraintEditorProps {
  mode: InputMode;
}

export function ConstraintEditor({ mode }: ConstraintEditorProps) {
  const constraints = useConstraints();
  const attendees = useAttendees();
  const config = useConfig();
  const { setConstraint, setRoomSlot } = useMeetingActions();

  // 통합 회의실 예약(busy) 슬롯 Set — 오프라인 회의실 격자 셀 상태 조회용. 기존 시드 호환 방어 접근
  const roomBusySet = useMemo(() => new Set(config.roomBusy ?? []), [config.roomBusy]);
  const isOffline = config.location === 'offline';

  // 선택 참석자 — 사라지면 첫 참석자로 폴백
  const [picked, setPicked] = useState<string>('');
  const selectedId = attendees.some((a) => a.id === picked) ? picked : (attendees[0]?.id ?? '');

  // 현재 브러시 상태 + 불가 사유 (버튼 모드 전용이지만 모드 전환에도 유지)
  const [brush, setBrush] = useState<Availability>('unavailable');
  const [reason, setReason] = useState<UnavailableReason | undefined>(undefined);
  const [otherText, setOtherText] = useState<string>('');

  // 격자 접기/펼치기 — 기본 펼침
  const [collapsed, setCollapsed] = useState(false);

  // store 제약에서 파생한 조회 헬퍼 — 점심 기본불가 포함 효과적 상태
  const lookup = useMemo(() => makeConstraintLookup(constraints), [constraints]);

  // 명시적으로 저장된 상태만 조회 (점심 기본불가 제외) — 토글/점심구분 판정용
  const explicitMap = useMemo(() => {
    const m = new Map<string, Availability>();
    for (const c of constraints) m.set(`${c.attendeeId}|${c.slot.day}-${c.slot.blockIndex}`, c.status);
    return m;
  }, [constraints]);
  const explicitStatusOf = useCallback(
    (attendeeId: string, slot: Slot): Availability | null =>
      explicitMap.get(`${attendeeId}|${slot.day}-${slot.blockIndex}`) ?? null,
    [explicitMap],
  );

  // 영업일(열) 수
  const dayCount = useMemo(() => businessDayCount(config.dateRange), [config.dateRange]);

  // 선택 참석자 기준 요약(불가/회피 칸 수) — 파생만, 복제 금지
  const { avoidCount, unavailableCount } = useMemo(() => {
    let avoid = 0;
    let unavailable = 0;
    for (const c of constraints) {
      if (c.attendeeId !== selectedId) continue;
      if (c.status === 'avoid') avoid += 1;
      else if (c.status === 'unavailable') unavailable += 1;
    }
    return { avoidCount: avoid, unavailableCount: unavailable };
  }, [constraints, selectedId]);

  // 한 셀에 상태를 즉시 반영 — 불가면 현재 사유를 함께 저장
  const applyToCell = useCallback(
    (slot: Slot, status: Availability) => {
      if (status === 'unavailable') {
        const cell: ConstraintCell = { attendeeId: selectedId, slot, status: 'unavailable' };
        if (reason) cell.reason = reason;
        if (reason === '기타' && otherText.trim()) cell.reasonText = otherText.trim();
        setConstraint(cell);
      } else {
        setConstraint({ attendeeId: selectedId, slot, status });
      }
    },
    [selectedId, reason, otherText, setConstraint],
  );

  return (
    <div>
      {/* 공통 상단 — 두 모드에서 항상 노출되는 제약 현황(공유 격자) */}
      <div className={styles.commonHead}>
        <h2 className={styles.subheading}>현재 제약 현황</h2>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? '펼치기' : '접기'}
        </button>
      </div>

      {/* 참석자 탭 */}
      <AttendeeTabs attendees={attendees} selectedId={selectedId} onSelect={setPicked} />

      {/* 요약 뱃지 */}
      <div className={styles.summaryRow}>
        <Badge tone={unavailableCount + avoidCount > 0 ? 'unavailable' : 'neutral'}>
          불가 {unavailableCount}칸 · 회피 {avoidCount}칸
        </Badge>
      </div>

      {/* 주간 격자 — 채팅 모드에선 read-only, 접힘 시 일부 행만 노출 */}
      <div className={collapsed ? styles.gridWrapCollapsed : styles.gridWrap}>
        <SlotGrid
          attendeeId={selectedId}
          lookup={lookup}
          explicitStatusOf={explicitStatusOf}
          dayCount={dayCount}
          brushStatus={brush}
          onApply={applyToCell}
          readOnly={mode === 'chat'}
        />
      </div>

      {/* 회의실 가용 — 오프라인일 때만. 회의실을 "하나의 참석자"처럼 시간대별 가용/예약 편집 */}
      {isOffline && (
        <div className={styles.roomSection}>
          <div className={styles.commonHead}>
            <h2 className={styles.subheading}>🔒 회의실 가용</h2>
            <span className={styles.roomHint}>가용 ● / 예약 🔒 — 셀을 눌러 토글</span>
          </div>
          <RoomSlotGrid roomBusy={roomBusySet} dayCount={dayCount} onToggle={setRoomSlot} />
        </div>
      )}

      {/* 공통 격자 ↔ 모드별 입력 수단 구분선 */}
      <div className={styles.divider} />

      {/* 모드별 입력 수단 */}
      {mode === 'button' ? (
        <BrushPalette
          brush={brush}
          onBrush={setBrush}
          reason={reason}
          onReason={setReason}
          otherText={otherText}
          onOtherText={setOtherText}
        />
      ) : (
        <>
          <ConstraintChat />
          <ConstraintSummary />
        </>
      )}
    </div>
  );
}
