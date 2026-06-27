/** 재사용 가능한 세그먼트 컨트롤 (2~N 옵션). button 기반 + aria-pressed 로 접근성 보장 */
import styles from './SegmentToggle.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentToggleProps<T extends string> {
  /** 선택 옵션 목록 (2개 이상) */
  options: SegmentOption<T>[];
  /** 현재 선택 값 */
  value: T;
  /** 선택 변경 콜백 */
  onChange: (value: T) => void;
  /** 그룹 레이블 (스크린리더용) */
  ariaLabel?: string;
  /** 컴팩트 크기 */
  size?: 'sm' | 'md';
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export function SegmentToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: SegmentToggleProps<T>) {
  return (
    <div className={styles.segment} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={cx(styles.option, size === 'sm' && styles.sm, selected && styles.selected)}
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
