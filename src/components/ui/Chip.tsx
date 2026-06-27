import type { ReactNode } from 'react';
import styles from './Chip.module.css';

export type ChipTone = 'available' | 'avoid' | 'unavailable' | 'neutral';

export interface ChipProps {
  /** 상태 톤 — 기본 neutral */
  tone?: ChipTone;
  /** 선택됨(토글) 여부 */
  selected?: boolean;
  /** 선두 아이콘 (●▲✕ 등) */
  icon?: ReactNode;
  /** 클릭 핸들러 — 있으면 클릭 가능 */
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export function Chip({
  tone = 'neutral',
  selected = false,
  icon,
  onClick,
  className,
  children,
}: ChipProps) {
  const clickable = typeof onClick === 'function';
  return (
    <span
      className={cx(
        styles.chip,
        styles[tone],
        selected && styles.selected,
        clickable && styles.clickable,
        className,
      )}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {icon != null && <span className={styles.icon}>{icon}</span>}
      {children}
    </span>
  );
}
