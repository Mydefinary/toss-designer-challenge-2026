/**
 * 주간 격자 — 행=시간(VALID_BLOCKS 16) · 열=영업일(dayCount).
 * 각 셀은 button. 클릭하면 상태 팝오버를 연다(자동 순환 없음).
 * 상태를 색+아이콘+aria-label 로 병행 표기(색만으로 구분하지 않음).
 */
import type { Availability, ConstraintCell, Slot } from '../../types';
import { dayName, formatBlock, blockStartLabel, VALID_BLOCKS } from '../../lib/recommend';
import styles from './SlotGrid.module.css';

const STATUS_ICON: Record<Availability, string> = {
  available: '●',
  avoid: '▲',
  unavailable: '✕',
};

const STATUS_LABEL: Record<Availability, string> = {
  available: '가능',
  avoid: '회피',
  unavailable: '불가',
};

const STATUS_CLASS: Record<Availability, string | undefined> = {
  available: styles.available,
  avoid: styles.avoid,
  unavailable: styles.unavailable,
};

export interface SlotGridProps {
  attendeeId: string;
  /** (attendeeId, slot) → 셀(없으면 available). store 파생 lookup */
  lookup: (attendeeId: string, slot: Slot) => ConstraintCell;
  /** 표시할 요일(열) 수 — businessDayCount 결과 */
  dayCount: number;
  /** 셀 클릭 → 상태 팝오버 열기 */
  onCellClick: (slot: Slot) => void;
  /** 팝오버가 열려 선택된 셀(하이라이트) */
  selectedSlot: Slot | null;
}

export function SlotGrid({ attendeeId, lookup, dayCount, onCellClick, selectedSlot }: SlotGridProps) {
  // 0..dayCount-1 영업일 열
  const days = Array.from({ length: Math.max(0, dayCount) }, (_, i) => i);
  // 각 행에 동적으로 적용할 그리드 컬럼 — 시간 라벨(28px) + 요일 N칸
  const rowStyle = { gridTemplateColumns: `28px repeat(${days.length}, 1fr)` };

  return (
    <div className={styles.grid} role="group" aria-label="요일별 시간대 격자">
      {/* 헤더 행: 좌상단 빈칸 + 요일 라벨 */}
      <div className={styles.row} style={rowStyle}>
        <div className={styles.corner} aria-hidden="true" />
        {days.map((day) => (
          <div key={`h-${day}`} className={styles.dayHead}>
            {dayName(day)[0]}
          </div>
        ))}
      </div>

      {/* 본문: 블럭 라벨 + 요일 셀 (30분 단위, 16행) */}
      {VALID_BLOCKS.map((blockIndex) => (
        <div key={`row-${blockIndex}`} className={styles.row} role="row" style={rowStyle}>
          <div className={styles.timeHead}>{blockStartLabel(blockIndex)}</div>
          {days.map((day) => {
            const slot: Slot = { day, blockIndex };
            const status = lookup(attendeeId, slot).status;
            const selected =
              selectedSlot != null &&
              selectedSlot.day === day &&
              selectedSlot.blockIndex === blockIndex;
            return (
              <button
                key={`${day}-${blockIndex}`}
                type="button"
                className={`${styles.cell} ${STATUS_CLASS[status] ?? ''} ${selected ? styles.selected : ''}`}
                aria-label={`${dayName(day)} ${formatBlock({ day, blockIndex })} · ${STATUS_LABEL[status]}`}
                aria-pressed={status !== 'available'}
                onClick={() => onCellClick(slot)}
              >
                <span className={styles.icon} aria-hidden="true">
                  {STATUS_ICON[status]}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
