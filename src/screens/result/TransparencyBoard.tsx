/**
 * (a) 투명성 보드 — 참석자×시간 히트맵. 색 + 아이콘(●▲✕)으로 색맹 대비.
 * 모바일: 요일 탭으로 하루씩(6×8). 768px↑: 전체 격자(6×40, 가로 스크롤).
 * 기본 접힘 — "모두의 상황 보기" 토글로 펼친다.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Availability, ConstraintCell } from '../../types';
import { useAttendees, useConstraints } from '../../store';
import { dayName, formatSlot } from '../../lib/recommend';
import { WORK_HOURS, STATUS_ICON } from './constants';
import styles from './result.module.css';

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(' ');

const DAYS = [0, 1, 2, 3, 4];

interface SelectedCell {
  attendeeId: string;
  day: number;
  hour: number;
}

const STATUS_CELL_CLASS: Record<Availability, string | undefined> = {
  available: styles.cellAvailable,
  avoid: styles.cellAvoid,
  unavailable: styles.cellUnavailable,
};

/** 셀 사유 텍스트 */
function reasonOf(cell: ConstraintCell | undefined, status: Availability): string {
  if (status === 'available') return '가능';
  if (status === 'avoid') return cell?.reasonText || '회피';
  return cell?.reason || cell?.reasonText || '불가';
}

export default function TransparencyBoard() {
  const attendees = useAttendees();
  const constraints = useConstraints();

  const [expanded, setExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  const cellOf = (attendeeId: string, day: number, hour: number) =>
    constraints.find(
      (c) => c.attendeeId === attendeeId && c.slot.day === day && c.slot.startHour === hour,
    );

  /** 단일 셀 버튼 렌더 */
  const renderCell = (attendeeId: string, name: string, day: number, hour: number): ReactNode => {
    const cell = cellOf(attendeeId, day, hour);
    const status: Availability = cell?.status ?? 'available';
    const reason = reasonOf(cell, status);
    const isSel =
      selected?.attendeeId === attendeeId && selected.day === day && selected.hour === hour;
    return (
      <button
        key={`${attendeeId}-${day}-${hour}`}
        type="button"
        className={cx(styles.cell, STATUS_CELL_CLASS[status], isSel && styles.cellSelected)}
        title={`${name} · ${formatSlot({ day, startHour: hour })} — ${reason}`}
        aria-label={`${name} ${formatSlot({ day, startHour: hour })} ${reason}`}
        onClick={() => setSelected({ attendeeId, day, hour })}
      >
        {STATUS_ICON[status]}
      </button>
    );
  };

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.boardToggle}
        onClick={() => setExpanded(true)}
        aria-expanded={false}
      >
        <span>모두의 상황 보기</span>
        <span className={styles.boardToggleCaret}>펼치기 ▼</span>
      </button>
    );
  }

  // ===== 전체 격자(데스크탑) 컬럼 목록 =====
  const allCols = DAYS.flatMap((d) => WORK_HOURS.map((h) => ({ day: d, hour: h })));

  return (
    <div className={styles.board}>
      <button
        type="button"
        className={styles.boardToggle}
        onClick={() => setExpanded(false)}
        aria-expanded
      >
        <span>모두의 상황</span>
        <span className={styles.boardToggleCaret}>접기 ▲</span>
      </button>

      <p className={styles.sectionHint}>
        나만 불편하면 양보가 쉬워집니다 — 서로의 상황이 보이면 자연스럽게 시간이 맞춰져요.
      </p>

      {/* 요일 탭 (모바일) */}
      <div className={styles.dayTabs} role="tablist" aria-label="요일 선택">
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={selectedDay === d}
            className={cx(styles.dayTab, selectedDay === d && styles.dayTabActive)}
            onClick={() => setSelectedDay(d)}
          >
            {dayName(d).charAt(0)}
          </button>
        ))}
      </div>

      {/* 단일 일자 격자 (모바일 기본) */}
      <div className={styles.gridSingle}>
        <span className={styles.gridRowLabel}>{dayName(selectedDay)}</span>
        {WORK_HOURS.map((h) => (
          <span key={`h-${h}`} className={styles.gridHeadCell}>
            {h}
          </span>
        ))}
        {attendees.map((a) => (
          <Row key={a.id}>
            <span className={styles.gridRowLabel} title={a.name}>
              {a.name}
            </span>
            {WORK_HOURS.map((h) => renderCell(a.id, a.name, selectedDay, h))}
          </Row>
        ))}
      </div>

      {/* 전체 격자 (768px↑, 가로 스크롤) */}
      <div className={styles.gridFull}>
        <div className={styles.gridFullInner}>
          <span className={styles.gridRowLabel} />
          {DAYS.map((d) => (
            <span key={`dl-${d}`} className={styles.dayGroupLabel}>
              {dayName(d)}
            </span>
          ))}
          <span className={styles.gridRowLabel} />
          {allCols.map((col) => (
            <span key={`fh-${col.day}-${col.hour}`} className={styles.gridHeadCell}>
              {col.hour}
            </span>
          ))}
          {attendees.map((a) => (
            <Row key={`f-${a.id}`}>
              <span className={styles.gridRowLabel} title={a.name}>
                {a.name}
              </span>
              {allCols.map((col) => renderCell(a.id, a.name, col.day, col.hour))}
            </Row>
          ))}
        </div>
      </div>

      {selected && (
        <p className={styles.cellReason} role="status">
          {(() => {
            const a = attendees.find((x) => x.id === selected.attendeeId);
            const cell = cellOf(selected.attendeeId, selected.day, selected.hour);
            const status: Availability = cell?.status ?? 'available';
            return `${a?.name ?? ''} · ${formatSlot({
              day: selected.day,
              startHour: selected.hour,
            })} — ${reasonOf(cell, status)}`;
          })()}
        </p>
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem}>{STATUS_ICON.available} 가능</span>
        <span className={styles.legendItem}>{STATUS_ICON.avoid} 회피</span>
        <span className={styles.legendItem}>{STATUS_ICON.unavailable} 불가</span>
      </div>
    </div>
  );
}

/** CSS grid 의 직접 자식이 되도록 Fragment 로 묶지 않고 펼치기 위한 헬퍼 */
function Row({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
