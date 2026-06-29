/**
 * (b) 순위 카드 1..5 — 시간/충족 인원/양보·불참/회의실/점수.
 * 클릭 시 드릴다운(c) 토글. 1순위는 강조.
 */
import type { MeetingLocation, RankedCandidate } from '../../types';
import { Badge, AvatarStack, Card, Chip } from '../../components/ui';
import { formatSlot } from '../../lib/recommend';
import SlotDrilldown from './SlotDrilldown';
import styles from './result.module.css';

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(' ');

interface RankCardProps {
  candidate: RankedCandidate;
  selected: boolean;
  location: MeetingLocation;
  onToggle: () => void;
}

export default function RankCard({
  candidate,
  selected,
  location,
  onToggle,
}: RankCardProps) {
  const isTop = candidate.rank === 1;
  const isOnline = location === 'online';

  // 회의실 배지: 온라인이면 회의실 무관
  const roomBadge = isOnline ? (
    <Badge tone="available">온라인</Badge>
  ) : candidate.roomAvailable ? (
    <Badge tone="success" icon="●">
      회의실 가능
    </Badge>
  ) : (
    <Badge tone="unavailable" icon="✕">
      회의실 없음
    </Badge>
  );

  return (
    <Card emphasized={selected} className={styles.rankCard}>
      <button
        type="button"
        className={styles.summaryBtn}
        onClick={onToggle}
        aria-expanded={selected}
      >
        <div className={styles.summaryHead}>
          <span className={cx(styles.rankBadge, isTop && styles.rankBadgeTop)}>
            {candidate.rank}순위
          </span>
          <span className={styles.score}>점수 {candidate.score.toFixed(1)}</span>
        </div>

        <p className={cx(styles.slotTime, isTop && styles.slotTimeTop)}>
          {formatSlot(candidate.startSlot)}
        </p>

        {candidate.satisfied.length > 0 && (
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>참석 가능 {candidate.satisfied.length}명</span>
            <AvatarStack
              size="sm"
              items={candidate.satisfied.map((a) => ({
                name: a.name,
                avatarColor: a.avatarColor,
              }))}
            />
          </div>
        )}

        {(candidate.yielding.length > 0 || candidate.absent.length > 0) && (
          <div className={styles.chipRow}>
            {candidate.yielding.map((y, i) => (
              <Chip key={`y-${i}`} tone="avoid" icon="▲">
                {y.attendee.name}님 {y.reason} 양보
              </Chip>
            ))}
            {candidate.absent.map((a, i) => (
              <Chip key={`a-${i}`} tone="unavailable" icon="✕">
                {a.name}님 불참
              </Chip>
            ))}
          </div>
        )}

        <div className={styles.metaRow}>{roomBadge}</div>

        <p className={styles.expandHint}>
          {selected ? '접기 ▲' : '점수 근거 보기 ▼'}
        </p>
      </button>

      <div className={cx(styles.drilldown, selected && styles.drilldownOpen)}>
        <SlotDrilldown candidate={candidate} />
      </div>
    </Card>
  );
}
