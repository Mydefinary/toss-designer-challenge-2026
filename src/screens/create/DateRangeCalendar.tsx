/** 후보 기간 선택 — 월 그리드 달력. 외부 라이브러리 없이 직접 구현. UTC 버그 방지를 위해 toISOString 미사용 */
import { useState } from 'react';
import { businessDayCount } from '../../lib/recommend';
import styles from './DateRangeCalendar.module.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

/** 'YYYY-MM-DD' → [year, month0(0-based), day] (로컬 타임 기준, UTC 파싱 금지) */
function parseISO(iso: string): { y: number; m: number; d: number } {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 0;
  const month1 = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return { y, m: month1 - 1, d };
}

/** (year, month0, day) → 'YYYY-MM-DD'. month0 은 0-based, ISO 합성 시 +1 */
function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface DateRangeCalendarProps {
  /** 현재 선택 범위 (ISO 문자열) */
  dateRange: { start: string; end: string };
  /** 범위 확정 콜백 — 스토어 setDateRange 연결 */
  onChange: (start: string, end: string) => void;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

export function DateRangeCalendar({ dateRange, onChange }: DateRangeCalendarProps) {
  // 표시 중인 연·월 — dateRange.start 가 속한 달에서 시작
  const initial = parseISO(dateRange.start);
  const [view, setView] = useState<{ year: number; month: number }>({
    year: initial.y,
    month: initial.m,
  });
  // 범위 선택 중간 상태 — 첫 클릭으로 임시 시작일 보관 (null 이면 새 범위 시작 대기)
  const [selecting, setSelecting] = useState<string | null>(null);

  const { year, month } = view;
  // 이 달의 1일 요일(0=일)과 총 일수
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 그리드 셀 — 선행 빈칸 + 날짜 + 후행 빈칸(7의 배수로 정렬)
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () =>
    setView(({ year: y, month: m }) => (m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 }));
  const goNext = () =>
    setView(({ year: y, month: m }) => (m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 }));

  const handleClick = (iso: string) => {
    if (selecting === null) {
      // 첫 클릭 — 임시 시작일 보관 + 단일 선택으로 표시
      setSelecting(iso);
      onChange(iso, iso);
    } else {
      // 두 번째 클릭 — 종료일. 시작보다 이르면 swap
      let start = selecting;
      let end = iso;
      if (end < start) [start, end] = [end, start];
      onChange(start, end);
      setSelecting(null);
    }
  };

  const businessDays = businessDayCount(dateRange);

  return (
    <div className={styles.calendar}>
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={goPrev} aria-label="이전 달">
          ‹
        </button>
        <span className={styles.navLabel} aria-live="polite">
          {year}년 {MONTH_NAMES[month]}
        </span>
        <button type="button" className={styles.navBtn} onClick={goNext} aria-label="다음 달">
          ›
        </button>
      </div>

      <div className={styles.weekRow} aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={cx(styles.weekday, (i === 0 || i === 6) && styles.weekendLabel)}>
            {w}
          </span>
        ))}
      </div>

      <div className={styles.grid} role="grid">
        {cells.map((day, idx) => {
          if (day === null) {
            return <span key={`blank-${idx}`} className={styles.blank} />;
          }
          const iso = toISO(year, month, day);
          const dow = new Date(year, month, day).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isStart = iso === dateRange.start;
          const isEnd = iso === dateRange.end;
          const isBetween = iso > dateRange.start && iso < dateRange.end;
          const inRange = isStart || isEnd || isBetween;

          let stateLabel = '';
          if (isStart) stateLabel = ', 시작일 선택됨';
          else if (isEnd) stateLabel = ', 종료일 선택됨';
          else if (isBetween) stateLabel = ', 범위 내';

          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              className={cx(
                styles.day,
                isWeekend && styles.weekend,
                inRange && styles.inRange,
                (isStart || isEnd) && styles.edge,
                isBetween && styles.between,
              )}
              disabled={isWeekend}
              aria-pressed={inRange}
              aria-label={`${year}년 ${month + 1}월 ${day}일${stateLabel}`}
              onClick={() => handleClick(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className={styles.summary}>
        영업일 <strong>{businessDays}일</strong>
      </p>
    </div>
  );
}
