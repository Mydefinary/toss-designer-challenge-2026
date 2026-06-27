/** 참석자 행 — 아바타·이름·필수/선택 세그먼트 토글 */
import { Avatar } from '../../components/ui';
import type { Attendee, AttendeeRole } from '../../types';
import { SegmentToggle, type SegmentOption } from './SegmentToggle';
import styles from './AttendeeRow.module.css';

const ROLE_OPTIONS: SegmentOption<AttendeeRole>[] = [
  { value: 'required', label: '필수' },
  { value: 'optional', label: '선택' },
];

export interface AttendeeRowProps {
  attendee: Attendee;
  /** 역할 변경 콜백 — 스토어 setAttendeeRole 연결 */
  onRoleChange: (id: string, role: AttendeeRole) => void;
}

export function AttendeeRow({ attendee, onRoleChange }: AttendeeRowProps) {
  return (
    <li className={styles.row}>
      <Avatar name={attendee.name} avatarColor={attendee.avatarColor} size="md" />
      <span className={styles.name}>{attendee.name}</span>
      <div className={styles.toggle}>
        <SegmentToggle
          ariaLabel={`${attendee.name} 참석 중요도`}
          options={ROLE_OPTIONS}
          value={attendee.role}
          onChange={(role) => onRoleChange(attendee.id, role)}
          size="sm"
        />
      </div>
    </li>
  );
}
