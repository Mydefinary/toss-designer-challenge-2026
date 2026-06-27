/**
 * (c) 슬롯 드릴다운 — 이 시간이 왜 (부)적합한지 긍정/부정 근거를 함께 제시.
 * useConstraints + useAttendees + 내보낸 가중치 상수로 슬롯 점수를 재구성한다.
 */
import type { Attendee, ConstraintCell, RankedCandidate } from '../../types';
import { useAttendees, useConstraints } from '../../store';
import {
  W_REQUIRED,
  W_OPTIONAL,
  SAT_AVAILABLE,
  SAT_AVOID,
  ROOM_PENALTY,
} from '../../lib/recommend';
import { signed } from './constants';
import styles from './result.module.css';

interface BreakdownLine {
  text: string;
  value: string;
  tone: 'pos' | 'neg' | 'room' | 'zero';
}

/** 슬롯에서 한 참석자의 셀을 찾는다 (없으면 가능) */
function cellOf(
  constraints: ConstraintCell[],
  attendeeId: string,
  day: number,
  startHour: number,
): ConstraintCell | undefined {
  return constraints.find(
    (c) =>
      c.attendeeId === attendeeId &&
      c.slot.day === day &&
      c.slot.startHour === startHour,
  );
}

function buildLines(
  candidate: RankedCandidate,
  attendees: Attendee[],
  constraints: ConstraintCell[],
): BreakdownLine[] {
  const { day, startHour } = candidate.slot;
  const lines: BreakdownLine[] = [];

  for (const a of attendees) {
    const weight = a.role === 'required' ? W_REQUIRED : W_OPTIONAL;
    const cell = cellOf(constraints, a.id, day, startHour);
    const status = cell?.status ?? 'available';

    if (status === 'available') {
      lines.push({
        text: `${a.name} 가능`,
        value: signed(SAT_AVAILABLE * weight),
        tone: 'pos',
      });
    } else if (status === 'avoid') {
      const reason = cell?.reasonText || '회피';
      lines.push({
        text: `${a.name} 회피(${reason})`,
        value: signed(SAT_AVOID * weight),
        tone: 'neg',
      });
    } else {
      // unavailable — 점수 기여 없음(불참)
      lines.push({ text: `${a.name} 불참`, value: '±0', tone: 'zero' });
    }
  }

  if (!candidate.roomAvailable) {
    lines.push({ text: '회의실 없음', value: signed(ROOM_PENALTY), tone: 'room' });
  }

  return lines;
}

const TONE_CLASS: Record<BreakdownLine['tone'], string | undefined> = {
  pos: styles.bdPos,
  neg: styles.bdNeg,
  room: styles.bdRoom,
  zero: styles.bdZero,
};

export default function SlotDrilldown({ candidate }: { candidate: RankedCandidate }) {
  const attendees = useAttendees();
  const constraints = useConstraints();
  const lines = buildLines(candidate, attendees, constraints);

  return (
    <div className={styles.drilldownInner}>
      <p className={styles.breakdownTitle}>이 시간의 점수 근거</p>
      <ul className={styles.breakdownList}>
        {lines.map((line, i) => (
          <li key={i} className={styles.breakdownItem}>
            <span>{line.text}</span>
            <span className={TONE_CLASS[line.tone]}>{line.value}</span>
          </li>
        ))}
      </ul>
      <div className={styles.breakdownTotal}>
        <span>합계 점수</span>
        <span>{candidate.score.toFixed(1)}</span>
      </div>

      {candidate.yielding.length > 0 && (
        <p className={styles.reasonNote}>
          양보: {candidate.yielding.map((y) => `${y.attendee.name}님 ${y.reason}`).join(', ')}
        </p>
      )}
      {candidate.absent.length > 0 && (
        <p className={styles.reasonNote}>
          불참: {candidate.absent.map((a) => `${a.name}님`).join(', ')}
        </p>
      )}
      <p className={styles.reasonNote}>
        필수 참석자는 가중치 {W_REQUIRED}, 선택 참석자는 {W_OPTIONAL}로 반영돼요. 나만 조금
        불편하면 양보로 모두의 시간이 맞춰집니다.
      </p>
    </div>
  );
}
