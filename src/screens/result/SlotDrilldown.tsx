/**
 * (c) 슬롯 드릴다운 — 이 시간이 왜 (부)적합한지 긍정/부정 근거를 함께 제시.
 * 코어 v2: candidate 가 이미 보유한 합성상태(satisfied/yielding/absent)로 점수 내역을 재구성한다.
 * (다중 블럭 회의의 합성 상태가 그대로 반영되므로 슬롯 재조회가 필요 없다.)
 */
import type { RankedCandidate } from '../../types';
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

/** candidate 합성상태로 점수 내역을 재구성 (다중 블럭 합성과 정확히 일치) */
function buildLines(candidate: RankedCandidate): BreakdownLine[] {
  const lines: BreakdownLine[] = [];

  // 가능 — 가중치만큼 가산
  for (const a of candidate.satisfied) {
    const weight = a.role === 'required' ? W_REQUIRED : W_OPTIONAL;
    lines.push({
      text: `${a.name} 가능`,
      value: signed(SAT_AVAILABLE * weight),
      tone: 'pos',
    });
  }

  // 회피(양보) — 가중치만큼 감산
  for (const y of candidate.yielding) {
    const weight = y.attendee.role === 'required' ? W_REQUIRED : W_OPTIONAL;
    lines.push({
      text: `${y.attendee.name} 회피(${y.reason})`,
      value: signed(SAT_AVOID * weight),
      tone: 'neg',
    });
  }

  // 불참(선택자 불가) — 점수 기여 없음
  for (const a of candidate.absent) {
    lines.push({ text: `${a.name} 불참`, value: '±0', tone: 'zero' });
  }

  // 회의실 부재 패널티
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
  const lines = buildLines(candidate);

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

      {/* 양보/불참은 위 내역에 이미 표현되므로 가중치 안내만 남긴다 */}
      <p className={styles.reasonNote}>
        필수 참석자는 가중치 {W_REQUIRED}, 선택 참석자는 {W_OPTIONAL}로 반영돼요. 나만 조금
        불편하면 양보로 모두의 시간이 맞춰집니다.
      </p>
    </div>
  );
}
