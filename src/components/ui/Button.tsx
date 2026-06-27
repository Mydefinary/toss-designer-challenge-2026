import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 시각 변형 — 기본 primary */
  variant?: ButtonVariant;
  /** 크기 — 기본 md */
  size?: ButtonSize;
  /** 가로 꽉 채우기 */
  fullWidth?: boolean;
  children?: ReactNode;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
