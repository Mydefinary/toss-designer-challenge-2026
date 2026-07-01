/**
 * 주간 격자 — 행=시간(VALID_BLOCKS 18, 점심 포함) · 열=영업일(dayCount).
 * 각 셀은 button. 팝오버 없이 현재 브러시 상태를 클릭/드래그로 즉시 칠한다.
 * - 클릭(또는 드래그): 현재 브러시 상태를 셀에 적용.
 * - 같은 브러시 상태가 이미 명시돼 있으면 다시 누를 때 해제(가능=기본)로 토글.
 * - 점심 블럭(5·6·7)은 명시적 제약이 없으면 기본 불가(✕)로 옅은 빗금 처리해 구분.
 * 상태를 색+아이콘+aria-label 로 병행 표기(색만으로 구분하지 않음).
 */
import { useEffect, useRef } from 'react';
import type { Availability, ConstraintCell, Slot } from '../../types';
import { dayName, formatBlock, blockStartLabel, isLunchBlock, VALID_BLOCKS } from '../../lib/recommend';
import styles from './SlotGrid.module.css';

const STATUS_ICON: Record<Availability, string> = {
  available: '●',
  avoid: '▲',
  unavailable: '✕',
};

const STATUS_LABEL: Record<Availability, string> = {
  available: '가능',
  avoid: '회피',
  unavailable: '불가',
};

const STATUS_CLASS: Record<Availability, string | undefined> = {
  available: styles.available,
  avoid: styles.avoid,
  unavailable: styles.unavailable,
};

/** 슬롯 기본 상태 — 점심블럭은 '불가', 그 외 '가능' */
function defaultStatusFor(slot: Slot): Availability {
  return isLunchBlock(slot.blockIndex) ? 'unavailable' : 'available';
}

export interface SlotGridProps {
  attendeeId: string;
  /** (attendeeId, slot) → 효과적 셀(점심 기본불가 포함). store 파생 lookup */
  lookup: (attendeeId: string, slot: Slot) => ConstraintCell;
  /** (attendeeId, slot) → 명시적으로 저장된 상태(없으면 null). 점심 기본불가/토글 판정용 */
  explicitStatusOf: (attendeeId: string, slot: Slot) => Availability | null;
  /** 표시할 요일(열) 수 — businessDayCount 결과 */
  dayCount: number;
  /** 현재 선택된 브러시 상태 */
  brushStatus: Availability;
  /** 한 셀에 상태를 적용(즉시 setConstraint) */
  onApply: (slot: Slot, status: Availability) => void;
}

export function SlotGrid({ attendeeId, lookup, explicitStatusOf, dayCount, brushStatus, onApply }: SlotGridProps) {
  // 드래그 칠하기 상태 — 한 stroke 동안 같은 target 을 유지해 일관되게 칠한다
  const painting = useRef(false);
  const strokeTarget = useRef<Availability>('available');

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

  /** 이 셀에 칠할 target — 명시 상태가 브러시와 같으면 기본값으로 해제, 아니면 브러시 적용 */
  function targetFor(slot: Slot): Availability {
    const explicit = explicitStatusOf(attendeeId, slot);
    return explicit === brushStatus ? defaultStatusFor(slot) : brushStatus;
  }

  function startPaint(slot: Slot) {
    const target = targetFor(slot);
    strokeTarget.current = target;
    painting.current = true;
    onApply(slot, target);
  }

  function continuePaint(slot: Slot) {
    if (!painting.current) return;
    onApply(slot, strokeTarget.current);
  }

  // 0..dayCount-1 영업일 열
  const days = Array.from({ length: Math.max(0, dayCount) }, (_, i) => i);
  // 각 행에 동적으로 적용할 그리드 컬럼 — 시간 라벨(28px) + 요일 N칸
  const rowStyle = { gridTemplateColumns: `28px repeat(${days.length}, 1fr)` };

  return (
    <div className={styles.grid} role="group" aria-label="요일별 시간대 격자">
      {/* 헤더 행: 좌상단 빈칸 + 요일 라벨 */}
      <div className={styles.row} style={rowStyle}>
        <div className={styles.corner} aria-hidden="true" />
        {days.map((day) => (
          <div key={`h-${day}`} className={styles.dayHead}>
            {dayName(day)[0]}
          </div>
        ))}
      </div>

      {/* 본문: 블럭 라벨 + 요일 셀 (30분 단위, 18행, 점심 포함) */}
      {VALID_BLOCKS.map((blockIndex) => {
        const lunchRow = isLunchBlock(blockIndex);
        return (
          <div key={`row-${blockIndex}`} className={styles.row} role="row" style={rowStyle}>
            <div className={`${styles.timeHead} ${lunchRow ? styles.lunchHead : ''}`}>
              {blockStartLabel(blockIndex)}
            </div>
            {days.map((day) => {
              const slot: Slot = { day, blockIndex };
              const status = lookup(attendeeId, slot).status;
              // 점심 기본불가(명시 제약 없음)인지 — 옅은 빗금으로 구분
              const lunchAuto = lunchRow && explicitStatusOf(attendeeId, slot) === null;
              const ariaLabel = lunchAuto
                ? `${dayName(day)} ${formatBlock({ day, blockIndex })} · 점심 (기본 불가)`
                : `${dayName(day)} ${formatBlock({ day, blockIndex })} · ${STATUS_LABEL[status]}`;
              return (
                <button
                  key={`${day}-${blockIndex}`}
                  type="button"
                  className={`${styles.cell} ${STATUS_CLASS[status] ?? ''} ${lunchAuto ? styles.lunch : ''}`}
                  aria-label={ariaLabel}
                  aria-pressed={status !== 'available'}
                  title={lunchAuto ? '점심 시간 (기본 불가) — 가능으로 바꾸려면 가능 브러시로 칠하세요' : undefined}
                  onPointerDown={() => startPaint(slot)}
                  onPointerEnter={() => continuePaint(slot)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onApply(slot, targetFor(slot));
                    }
                  }}
                >
                  <span className={styles.icon} aria-hidden="true">
                    {STATUS_ICON[status]}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
