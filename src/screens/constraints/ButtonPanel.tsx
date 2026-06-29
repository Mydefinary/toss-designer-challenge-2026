/**
 * 버튼 모드 패널 — 참석자 선택 + 주간 격자 + 상태 팝오버.
 * 제약은 절대 로컬 복제하지 않고 store(useConstraints)에서 파생한다.
 */
import { useMemo, useState } from 'react';
import { useConstraints, useAttendees, useConfig } from '../../store';
import { makeConstraintLookup, businessDayCount } from '../../lib/recommend';
import { Badge } from '../../components/ui';
import type { Slot } from '../../types';
import { AttendeeTabs } from './AttendeeTabs';
import { SlotGrid } from './SlotGrid';
import { StatusPopover } from './StatusPopover';
import styles from './ButtonPanel.module.css';

export function ButtonPanel() {
  const constraints = useConstraints();
  const attendees = useAttendees();
  const config = useConfig();

  // 선택 참석자 — 사라지면 첫 참석자로 폴백
  const [picked, setPicked] = useState<string>('');
  const selectedId = attendees.some((a) => a.id === picked) ? picked : (attendees[0]?.id ?? '');

  // 팝오버가 열린 셀(없으면 null)
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);

  // store 제약에서 파생한 조회 헬퍼 — 없으면 'available'
  const lookup = useMemo(() => makeConstraintLookup(constraints), [constraints]);

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

  function selectAttendee(id: string) {
    setPicked(id);
    setOpenSlot(null); // 참석자 전환 시 팝오버 닫기
  }

  const openCell = openSlot ? lookup(selectedId, openSlot) : null;

  return (
    <div>
      {/* 참석자 탭 */}
      <AttendeeTabs attendees={attendees} selectedId={selectedId} onSelect={selectAttendee} />

      {/* 범례 + 요약 */}
      <div className={styles.legendRow}>
        <div className={styles.legend}>
          <span className={styles.legendItem} data-tone="available">
            ● 가능
          </span>
          <span className={styles.legendItem} data-tone="avoid">
            ▲ 회피
          </span>
          <span className={styles.legendItem} data-tone="unavailable">
            ✕ 불가
          </span>
        </div>
        <Badge tone={unavailableCount + avoidCount > 0 ? 'unavailable' : 'neutral'}>
          불가 {unavailableCount}칸 · 회피 {avoidCount}칸
        </Badge>
      </div>

      {/* 주간 격자 */}
      <SlotGrid
        attendeeId={selectedId}
        lookup={lookup}
        dayCount={dayCount}
        onCellClick={(slot) => setOpenSlot(slot)}
        selectedSlot={openSlot}
      />

      <p className={styles.guide}>칸을 누르면 가능·회피·불가를 고르는 창이 열려요.</p>

      {/* 상태 팝오버 */}
      {openSlot && openCell && (
        <StatusPopover
          key={`${openSlot.day}-${openSlot.blockIndex}`}
          attendeeId={selectedId}
          slot={openSlot}
          cell={openCell}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
