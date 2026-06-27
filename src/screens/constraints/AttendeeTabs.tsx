/** 참석자 선택 탭 — 가로 스크롤. 한 명 선택해 격자를 편집한다. */
import type { Attendee } from '../../types';
import { Avatar } from '../../components/ui';
import styles from './AttendeeTabs.module.css';

export interface AttendeeTabsProps {
  attendees: Attendee[];
  selectedId: string;
  onSelect: (attendeeId: string) => void;
}

export function AttendeeTabs({ attendees, selectedId, onSelect }: AttendeeTabsProps) {
  return (
    <div className={styles.scroller} role="tablist" aria-label="참석자 선택">
      {attendees.map((a) => {
        const selected = a.id === selectedId;
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.tab} ${selected ? styles.selected : ''}`}
            onClick={() => onSelect(a.id)}
          >
            <Avatar name={a.name} avatarColor={a.avatarColor} size="sm" />
            <span className={styles.name}>{a.name}</span>
            <span className={styles.role}>{a.role === 'required' ? '필수' : '선택'}</span>
          </button>
        );
      })}
    </div>
  );
}
