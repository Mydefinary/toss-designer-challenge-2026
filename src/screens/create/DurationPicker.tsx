/** 회의 길이 선택 — 30/60/90/120분. SegmentToggle 은 T extends string 이라 숫자를 못 담아 별도 구현 */
import type { DurationMinutes } from '../../types';
import styles from './DurationPicker.module.css';

/** 선택 가능한 회의 길이 (분) */
export const DURATIONS: DurationMinutes[] = [30, 60, 90, 120];

/** 분 단위 회의 길이 → 한국어 표기 (30→"30분", 90→"1시간 30분") */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export interface DurationPickerProps {
  /** 현재 선택된 회의 길이 */
  value: DurationMinutes;
  /** 선택 변경 콜백 — 스토어 setDuration 연결 */
  onChange: (minutes: DurationMinutes) => void;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export function DurationPicker({ value, onChange }: DurationPickerProps) {
  return (
    <div className={styles.grid} role="group" aria-label="회의 길이">
      {DURATIONS.map((minutes) => {
        const selected = minutes === value;
        return (
          <button
            key={minutes}
            type="button"
            className={cx(styles.option, selected && styles.selected)}
            aria-pressed={selected}
            onClick={() => onChange(minutes)}
          >
            {formatDuration(minutes)}
          </button>
        );
      })}
    </div>
  );
}
