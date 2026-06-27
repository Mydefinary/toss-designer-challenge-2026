import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'available' | 'avoid' | 'unavailable' | 'success' | 'neutral';

export interface BadgeProps {
  /** 톤 — 상태색 재사용 + neutral/success */
  tone?: BadgeTone;
  /** 선두 아이콘 */
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export function Badge({ tone = 'neutral', icon, className, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {icon != null && <span>{icon}</span>}
      {children}
    </span>
  );
}
