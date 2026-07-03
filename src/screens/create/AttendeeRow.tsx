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
  /** 이름 변경 콜백 — 스토어 setAttendeeName 연결 */
  onNameChange: (id: string, name: string) => void;
  /** 삭제 콜백 — 스토어 removeAttendee 연결 */
  onRemove: (id: string) => void;
  /** 삭제 가능 여부 (최소 인원에서는 false → 버튼 비활성) */
  canRemove: boolean;
}

export function AttendeeRow({ attendee, onRoleChange, onNameChange, onRemove, canRemove }: AttendeeRowProps) {
  return (
    <li className={styles.row}>
      {/* 아바타 이니셜은 이름 첫 글자로 자동 (Avatar.initialsOf) */}
      <Avatar name={attendee.name} avatarColor={attendee.avatarColor} size="md" />
      <input
        className={styles.nameInput}
        type="text"
        value={attendee.name}
        placeholder="이름"
        aria-label="참석자 이름"
        onChange={(e) => onNameChange(attendee.id, e.target.value)}
      />
      <div className={styles.toggle}>
        <SegmentToggle
          ariaLabel={`${attendee.name} 참석 중요도`}
          options={ROLE_OPTIONS}
          value={attendee.role}
          onChange={(role) => onRoleChange(attendee.id, role)}
          size="sm"
        />
      </div>
      <button
        type="button"
        className={styles.remove}
        onClick={() => onRemove(attendee.id)}
        disabled={!canRemove}
        aria-label={`${attendee.name} 삭제`}
        title={canRemove ? '참석자 삭제' : '최소 인원이라 삭제할 수 없어요'}
      >
        ✕
      </button>
    </li>
  );
}
