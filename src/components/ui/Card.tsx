import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 강조 그림자 */
  elevated?: boolean;
  /** 강조 테두리 + 틴트 배경 (선택된 후보 등) */
  emphasized?: boolean;
  children?: ReactNode;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export function Card({ elevated = false, emphasized = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        styles.card,
        elevated && styles.elevated,
        emphasized && styles.emphasized,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
