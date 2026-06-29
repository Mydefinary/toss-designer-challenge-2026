/**
 * 주간 격자 — 행=시간(8) · 열=요일(5). 각 셀은 button.
 * 상태를 색+아이콘+aria-label 로 병행 표기(색만으로 구분하지 않음).
 */
import type { Availability, ConstraintCell, Slot } from '../../types';
import { dayName, formatBlock, blockStartLabel, VALID_BLOCKS } from '../../lib/recommend';
import styles from './SlotGrid.module.css';

/** 유효 30분 블럭(점심 6·7 제외, 16개) — lib 의 VALID_BLOCKS 사용 */
const DAYS = [0, 1, 2, 3, 4];

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
  onCellClick: (slot: Slot) => void;
  /** 사유 패널이 열려 편집 중인 셀(하이라이트) */
  editingSlot: Slot | null;
}

export function SlotGrid({ attendeeId, lookup, onCellClick, editingSlot }: SlotGridProps) {
  return (
    <div className={styles.grid} role="group" aria-label="요일별 시간대 격자">
      {/* 헤더 행: 좌상단 빈칸 + 요일 라벨 */}
      <div className={styles.row}>
        <div className={styles.corner} aria-hidden="true" />
        {DAYS.map((day) => (
          <div key={`h-${day}`} className={styles.dayHead}>
            {dayName(day)[0]}
          </div>
        ))}
      </div>

      {/* 본문: 블럭 라벨 + 5개 요일 셀 (30분 단위, 16행) */}
      {VALID_BLOCKS.map((blockIndex) => (
        <div key={`row-${blockIndex}`} className={styles.row} role="row">
          <div className={styles.timeHead}>{blockStartLabel(blockIndex)}</div>
          {DAYS.map((day) => {
            const slot: Slot = { day, blockIndex };
            const status = lookup(attendeeId, slot).status;
            const editing =
              editingSlot != null &&
              editingSlot.day === day &&
              editingSlot.blockIndex === blockIndex;
            return (
              <button
                key={`${day}-${blockIndex}`}
                type="button"
                className={`${styles.cell} ${STATUS_CLASS[status] ?? ''} ${editing ? styles.editing : ''}`}
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
