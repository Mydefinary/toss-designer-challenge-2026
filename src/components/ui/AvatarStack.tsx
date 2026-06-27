import { Avatar, type AvatarSize } from './Avatar';
import styles from './AvatarStack.module.css';

export interface AvatarStackItem {
  name: string;
  avatarColor?: string;
}

export interface AvatarStackProps {
  /** 겹쳐 표시할 아바타 목록 */
  items: AvatarStackItem[];
  /** 최대 표시 개수 — 초과분은 "+N" 으로 */
  max?: number;
  /** 아바타 크기 — 기본 md */
  size?: AvatarSize;
  className?: string;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export function AvatarStack({ items, max = 5, size = 'md', className }: AvatarStackProps) {
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;

  return (
    <span className={cx(styles.stack, className)}>
      {visible.map((item, i) => (
        <Avatar
          key={`${item.name}-${i}`}
          name={item.name}
          avatarColor={item.avatarColor}
          size={size}
          className={styles.item}
        />
      ))}
      {overflow > 0 && (
        <span className={cx(styles.overflow, styles[size])} aria-label={`외 ${overflow}명`}>
          +{overflow}
        </span>
      )}
    </span>
  );
}
