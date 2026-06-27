import styles from './Avatar.module.css';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** 표시할 이름 — 첫 글자(들)로 이니셜 생성 */
  name: string;
  /** 배경색 (페르소나별 고유색) */
  avatarColor?: string;
  /** 크기 — 기본 md */
  size?: AvatarSize;
  className?: string;
  title?: string;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

/** 한글은 첫 글자, 영문은 최대 2글자 이니셜 */
export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const first = trimmed[0] ?? '?';
  // 한글이면 한 글자, 그 외(영문 등)는 단어 첫 글자 2개까지
  if (/[가-힣]/.test(first)) return first;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function Avatar({ name, avatarColor, size = 'md', className, title }: AvatarProps) {
  return (
    <span
      className={cx(styles.avatar, styles[size], className)}
      style={avatarColor ? { backgroundColor: avatarColor } : undefined}
      title={title ?? name}
      aria-label={name}
    >
      {initialsOf(name)}
    </span>
  );
}
