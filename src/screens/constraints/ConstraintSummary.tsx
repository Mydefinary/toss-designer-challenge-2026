/**
 * 현재 제약 요약 — 채팅(자연어) 탭 하단 고정 패널.
 * store(useAttendees + useConstraints)에서 참석자별로 불가/회피 셀을 집계해
 * 사람이 읽기 좋은 문장형 요약을 보여준다. (로컬 복제 없이 파생만, useMemo)
 * 공통 상단의 SlotGrid 격자·요약 뱃지와는 별개의 텍스트 요약이다.
 */
import { useMemo } from 'react';
import { useAttendees, useConstraints } from '../../store';
import { dayName, blockStartLabel } from '../../lib/recommend';
import type { ConstraintCell } from '../../types';
import styles from './ConstraintSummary.module.css';

/** 한 참석자의 제약 한 줄 요약 데이터 */
interface AttendeeLine {
  id: string;
  name: string;
  /** 사람이 읽는 요약 문장(제약 없으면 undefined) */
  text?: string;
}

/** 요일(day) 오름차순 → 시작시각(blockIndex) 오름차순 정렬 */
function bySlot(a: ConstraintCell, b: ConstraintCell): number {
  return a.slot.day - b.slot.day || a.slot.blockIndex - b.slot.blockIndex;
}

/** 불가 셀의 사유 라벨 — reasonText 우선, 없으면 reason 태그 */
function reasonLabel(cell: ConstraintCell): string | undefined {
  if (cell.reasonText && cell.reasonText.trim()) return cell.reasonText.trim();
  return cell.reason;
}

/** 셀 묶음 → "요일 시작시각(사유)" 대표 표기. 최대 2개 요일까지, 나머지는 "외 N일" */
function summarizeCells(cells: ConstraintCell[]): string {
  const sorted = [...cells].sort(bySlot);
  // 요일별로 첫 셀만 대표로 뽑는다 (요일 순서 유지)
  const perDay = new Map<number, ConstraintCell>();
  for (const c of sorted) if (!perDay.has(c.slot.day)) perDay.set(c.slot.day, c);
  const days = [...perDay.values()];

  const parts = days.slice(0, 2).map((c) => {
    const r = reasonLabel(c);
    const base = `${dayName(c.slot.day)} ${blockStartLabel(c.slot.blockIndex)}`;
    return r ? `${base}(${r})` : base;
  });
  let label = parts.join(', ');
  if (days.length > 2) label += ` 외 ${days.length - 2}일`;
  return label;
}

export function ConstraintSummary() {
  const attendees = useAttendees();
  const constraints = useConstraints();

  // 참석자별 불가/회피 집계 — 파생만, 복제 금지
  const lines = useMemo<AttendeeLine[]>(() => {
    return attendees.map((a) => {
      const unavailable = constraints.filter((c) => c.attendeeId === a.id && c.status === 'unavailable');
      const avoid = constraints.filter((c) => c.attendeeId === a.id && c.status === 'avoid');

      if (unavailable.length === 0 && avoid.length === 0) {
        return { id: a.id, name: a.name };
      }

      const segments: string[] = [];
      if (unavailable.length > 0) {
        segments.push(`불가 ${unavailable.length}칸 — ${summarizeCells(unavailable)}`);
      }
      if (avoid.length > 0) {
        segments.push(`회피 ${avoid.length}칸 — ${summarizeCells(avoid)}`);
      }
      return { id: a.id, name: a.name, text: segments.join(' · ') };
    });
  }, [attendees, constraints]);

  const hasAny = lines.some((l) => l.text);

  return (
    <section className={styles.panel} aria-label="현재 제약 요약">
      <h3 className={styles.heading}>현재 제약 요약</h3>

      {!hasAny ? (
        <p className={styles.empty}>아직 반영된 제약이 없어요. 문장으로 제약을 알려주세요.</p>
      ) : (
        <ul className={styles.list}>
          {lines.map((l) => (
            <li key={l.id} className={styles.item}>
              <span className={styles.name}>{l.name}</span>
              <span className={styles.detail}>{l.text ?? '제약 없음'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
