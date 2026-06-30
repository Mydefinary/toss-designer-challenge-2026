/**
 * 버튼 모드 패널 — 참석자 선택 + 브러시 팔레트 + 주간 격자.
 * 팝오버/모달 없이 현재 화면에서 브러시를 고르고 격자 셀을 클릭/드래그해 즉시 칠한다.
 * 제약은 절대 로컬 복제하지 않고 store(useConstraints)에서 파생한다.
 */
import { useCallback, useMemo, useState } from 'react';
import { useConstraints, useAttendees, useConfig, useMeetingActions } from '../../store';
import { makeConstraintLookup, businessDayCount } from '../../lib/recommend';
import { Badge } from '../../components/ui';
import type { Availability, ConstraintCell, Slot, UnavailableReason } from '../../types';
import { AttendeeTabs } from './AttendeeTabs';
import { BrushPalette } from './BrushPalette';
import { SlotGrid } from './SlotGrid';
import styles from './ButtonPanel.module.css';

export function ButtonPanel() {
  const constraints = useConstraints();
  const attendees = useAttendees();
  const config = useConfig();
  const { setConstraint } = useMeetingActions();

  // 선택 참석자 — 사라지면 첫 참석자로 폴백
  const [picked, setPicked] = useState<string>('');
  const selectedId = attendees.some((a) => a.id === picked) ? picked : (attendees[0]?.id ?? '');

  // 현재 브러시 상태 + 불가 사유
  const [brush, setBrush] = useState<Availability>('unavailable');
  const [reason, setReason] = useState<UnavailableReason | undefined>(undefined);
  const [otherText, setOtherText] = useState<string>('');

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
      {/* 참석자 탭 */}
      <AttendeeTabs attendees={attendees} selectedId={selectedId} onSelect={setPicked} />

      {/* 브러시 팔레트 (가능/회피/불가 + 사유) */}
      <BrushPalette
        brush={brush}
        onBrush={setBrush}
        reason={reason}
        onReason={setReason}
        otherText={otherText}
        onOtherText={setOtherText}
      />

      {/* 요약 뱃지 */}
      <div className={styles.summaryRow}>
        <Badge tone={unavailableCount + avoidCount > 0 ? 'unavailable' : 'neutral'}>
          불가 {unavailableCount}칸 · 회피 {avoidCount}칸
        </Badge>
      </div>

      {/* 주간 격자 */}
      <SlotGrid
        attendeeId={selectedId}
        lookup={lookup}
        explicitStatusOf={explicitStatusOf}
        dayCount={dayCount}
        brushStatus={brush}
        onApply={applyToCell}
      />

      <p className={styles.guide}>
        브러시를 고르고 칸을 누르거나 드래그하면 바로 반영돼요. 같은 칸을 같은 브러시로 다시 누르면 해제돼요.
        점심(빗금) 칸은 기본 불가예요.
      </p>
    </div>
  );
}
