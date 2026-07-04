import type { KeyboardEvent } from 'react';
import { Card, Badge, AvatarStack, Chip } from '../../components/ui';
import { formatRange, dayName } from '../../lib/recommend';
import type { MeetingConfig, RankedCandidate } from '../../types';
import styles from './RankCard.module.css';

export interface RankCardProps {
  config: MeetingConfig;
  candidate: RankedCandidate;
  /** 순위 인덱스 (0-based) */
  index: number;
  /** 최종 선택 상태 */
  selected: boolean;
  /** 선택 콜백 — 인덱스 전달 */
  onSelect: (index: number) => void;
}

/**
 * 확정 순위 후보 1개를 라디오 카드로 렌더.
 * 카드 루트 자체가 role="radio" — 클릭/Space/Enter 로 최종 선택.
 * 회의실 상태는 색상 배지 + 텍스트로 함께 노출(색상 단독 정보 금지).
 */
export function RankCard({ config, candidate, index, selected, onSelect }: RankCardProps) {
  const isOnline = config.location === 'online';
  // 참석(satisfied) + 양보(yielding)를 present 로 합쳐 인원/아바타 표시
  const present = [
    ...candidate.satisfied.map((a) => ({ name: a.name, avatarColor: a.avatarColor })),
    ...candidate.yielding.map((y) => ({
      name: y.attendee.name,
      avatarColor: y.attendee.avatarColor,
    })),
  ];

  const timeText = `${dayName(candidate.startSlot.day)} ${formatRange(
    candidate.startSlot,
    config.durationMinutes,
  )}`;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onSelect(index);
    }
  };

  return (
    <Card
      emphasized={selected}
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      data-rank-index={index}
      aria-label={`${index + 1}순위 ${timeText}${selected ? ' — 최종 선택됨' : ''}`}
      onClick={() => onSelect(index)}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.header}>
        <span className={styles.rankBadge}>{index + 1}순위</span>
        {selected && <Badge tone="success">최종 선택</Badge>}
      </div>

      <div className={styles.timeRow}>
        <span className={styles.time}>{timeText}</span>
        <span className={styles.score}>점수 {candidate.score}</span>
      </div>

      <div className={styles.locationRow}>
        <span className={styles.metaLabel}>장소</span>
        {isOnline ? (
          <Badge tone="neutral">장소 무관</Badge>
        ) : candidate.roomAvailable ? (
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

      {candidate.yielding.length > 0 && (
        <div className={styles.section}>
          <span className={styles.metaLabel}>양보</span>
          <div className={styles.chipRow}>
            {candidate.yielding.map((y) => (
              <Chip key={y.attendee.id} tone="avoid" icon="▲">
                {y.attendee.name}님 — {y.reason} 양보
              </Chip>
            ))}
          </div>
        </div>
      )}

      {candidate.absent.length > 0 && (
        <div className={styles.section}>
          <span className={styles.metaLabel}>불참</span>
          <div className={styles.chipRow}>
            {candidate.absent.map((a) => (
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

export default RankCard;
