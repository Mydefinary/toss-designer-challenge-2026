/** 오프라인 회의실 목록 — 입력으로 추가, 항목별 삭제. 가용시간 입력 UI 없음 */
import { useState } from 'react';
import type { Room } from '../../types';
import styles from './RoomList.module.css';

export interface RoomListProps {
  /** 현재 회의실 목록 */
  rooms: Room[];
  /** 회의실 추가 콜백 — 스토어 addRoom 연결 */
  onAdd: (name: string) => void;
  /** 회의실 삭제 콜백 — 스토어 removeRoom 연결 */
  onRemove: (id: string) => void;
}

export function RoomList({ rooms, onAdd, onRemove }: RoomListProps) {
  // 입력값은 RoomList 로컬 상태로만 관리
  const [input, setInput] = useState('');

  const submit = () => {
    const name = input.trim();
    if (!name) return; // 공백이면 무시
    onAdd(name);
    setInput('');
  };

  return (
    <div className={styles.roomList}>
      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className={styles.input}
          type="text"
          value={input}
          placeholder="예: 3층 회의실 A"
          aria-label="회의실 이름"
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className={styles.addBtn}>
          추가
        </button>
      </form>

      {rooms.length > 0 && (
        <ul className={styles.list}>
          {rooms.map((room) => (
            <li key={room.id} className={styles.item}>
              <span className={styles.name}>{room.name}</span>
              <button
                type="button"
                className={styles.removeBtn}
                aria-label={`${room.name} 삭제`}
                onClick={() => onRemove(room.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
