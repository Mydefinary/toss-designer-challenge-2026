/**
 * 회의실 전용 2단계 미니 격자 — 행=시간(VALID_BLOCKS 18) · 열=영업일(dayCount).
 * 회의실을 "하나의 참석자"처럼 다뤄, 시간대별 가용/예약(확보 불가)을 보여주고 편집한다.
 * - 셀 상태: 가용(roomBusy 미포함, 중립/파랑 ●) / 예약(roomBusy 포함, 회색 자물쇠 🔒).
 * - 클릭/드래그 브러시로 토글 → setRoomSlot(slot, busy). 색만으로 구분하지 않도록 아이콘·aria-label 병기.
 * - 점심 블럭도 회의실엔 특별 규칙 없음(기본 가용).
 */
import { useEffect, useRef } from 'react';
import type { Slot, SlotKey } from '../../types';
import { dayName, formatBlock, blockStartLabel, slotKey, VALID_BLOCKS } from '../../lib/recommend';
import styles from './RoomSlotGrid.module.css';

export interface RoomSlotGridProps {
  /** 회의실 예약(busy) 슬롯 집합 — config.roomBusy 를 Set 으로 */
  roomBusy: Set<SlotKey>;
  /** 표시할 요일(열) 수 — businessDayCount 결과 */
  dayCount: number;
  /** 한 슬롯의 가용/예약을 토글 — setRoomSlot 연결 */
  onToggle: (slot: Slot, busy: boolean) => void;
}

export function RoomSlotGrid({ roomBusy, dayCount, onToggle }: RoomSlotGridProps) {
  // 드래그 칠하기 — 한 stroke 동안 같은 target(busy 여부)을 유지
  const painting = useRef(false);
  const strokeBusy = useRef(false);

  useEffect(() => {
    const stop = () => {
      painting.current = false;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  /** 이 슬롯을 눌렀을 때의 target busy — 현재 가용이면 예약으로, 예약이면 가용으로 토글 */
  function targetFor(slot: Slot): boolean {
    return !roomBusy.has(slotKey(slot));
  }

  function startPaint(slot: Slot) {
    const target = targetFor(slot);
    strokeBusy.current = target;
    painting.current = true;
    onToggle(slot, target);
  }

  function continuePaint(slot: Slot) {
    if (!painting.current) return;
    onToggle(slot, strokeBusy.current);
  }

  const days = Array.from({ length: Math.max(0, dayCount) }, (_, i) => i);
  const rowStyle = { gridTemplateColumns: `28px repeat(${days.length}, 1fr)` };

  return (
    <div className={styles.grid} role="group" aria-label="회의실 요일별 시간대 격자">
      {/* 헤더 행: 좌상단 빈칸 + 요일 라벨 */}
      <div className={styles.row} style={rowStyle}>
        <div aria-hidden="true" />
        {days.map((day) => (
          <div key={`rh-${day}`} className={styles.dayHead}>
            {dayName(day)[0]}
          </div>
        ))}
      </div>

      {/* 본문: 블럭 라벨 + 요일 셀 (18행) */}
      {VALID_BLOCKS.map((blockIndex) => (
        <div key={`rrow-${blockIndex}`} className={styles.row} role="row" style={rowStyle}>
          <div className={styles.timeHead}>{blockStartLabel(blockIndex)}</div>
          {days.map((day) => {
            const slot: Slot = { day, blockIndex };
            const busy = roomBusy.has(slotKey(slot));
            const stateLabel = busy ? '예약' : '가용';
            const ariaLabel = `회의실 · ${dayName(day)} ${formatBlock({ day, blockIndex })} · ${stateLabel}`;
            return (
              <button
                key={`${day}-${blockIndex}`}
                type="button"
                className={`${styles.cell} ${busy ? styles.busy : styles.available}`}
                aria-label={ariaLabel}
                aria-pressed={busy}
                title={ariaLabel}
                onPointerDown={() => startPaint(slot)}
                onPointerEnter={() => continuePaint(slot)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle(slot, targetFor(slot));
                  }
                }}
              >
                <span className={styles.icon} aria-hidden="true">
                  {busy ? '🔒' : '●'}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default RoomSlotGrid;
