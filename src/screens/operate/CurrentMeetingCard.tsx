import { Card, Badge, AvatarStack, Chip } from '../../components/ui';
import { formatRange } from '../../lib/recommend';
import type { MeetingConfig, RankedCandidate } from '../../types';
import styles from './CurrentMeetingCard.module.css';

export interface CurrentMeetingCardProps {
  config: MeetingConfig;
  current: RankedCandidate;
  /** 현재 순위 인덱스 (0-based) */
  currentIndex: number;
  /** 총 순위 수 */
  total: number;
}

/**
 * 현재 운영 중인 순위 카드 — 시간/장소/참석·양보·불참을 한눈에.
 * 회의실 상태는 색상 배지 + 텍스트로 함께 노출(색상 단독 정보 금지).
 */
export function CurrentMeetingCard({ config, current, currentIndex, total }: CurrentMeetingCardProps) {
  const isOnline = config.location === 'online';
  const present = [
    ...current.satisfied.map((a) => ({ name: a.name, avatarColor: a.avatarColor })),
    ...current.yielding.map((y) => ({ name: y.attendee.name, avatarColor: y.attendee.avatarColor })),
  ];

  return (
    <Card emphasized className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{config.title}</h2>
        <Badge tone="neutral">
          현재 {currentIndex + 1}순위 / 총 {total}순위
        </Badge>
      </div>

      <div className={styles.timeBlock}>
        <span className={styles.timeLabel}>확정 시간</span>
        <span className={styles.time}>{formatRange(current.startSlot, config.durationMinutes)}</span>
      </div>

      <div className={styles.locationRow}>
        <span className={styles.metaLabel}>장소</span>
        <span className={styles.locationValue}>{isOnline ? '온라인' : '오프라인'}</span>
        {isOnline ? (
          <Badge tone="neutral">장소 무관</Badge>
        ) : current.roomAvailable ? (
          <Badge tone="success">회의실 가능</Badge>
        ) : (
          <Badge tone="unavailable">회의실 없음</Badge>
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.metaLabel}>참석</span>
        {present.length > 0 ? (
          <div className={styles.presentRow}>
            <AvatarStack items={present} size="sm" max={6} />
            <span className={styles.presentCount}>{present.length}명 참석</span>
          </div>
        ) : (
          <span className={styles.emptyInline}>참석 인원 정보 없음</span>
        )}
      </div>

      {current.yielding.length > 0 && (
        <div className={styles.section}>
          <span className={styles.metaLabel}>양보</span>
          <div className={styles.chipRow}>
            {current.yielding.map((y) => (
              <Chip key={y.attendee.id} tone="avoid" icon="▲">
                {y.attendee.name}님 — {y.reason} 양보
              </Chip>
            ))}
          </div>
        </div>
      )}

      {current.absent.length > 0 && (
        <div className={styles.section}>
          <span className={styles.metaLabel}>불참</span>
          <div className={styles.chipRow}>
            {current.absent.map((a) => (
              <Chip key={a.id} tone="unavailable" icon="✕">
                {a.name}님 불참
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default CurrentMeetingCard;
