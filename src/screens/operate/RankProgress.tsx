import styles from './RankProgress.module.css';

export interface RankProgressProps {
  /** 총 순위 수 (M) */
  total: number;
  /** 현재 순위 인덱스 (0-based) */
  currentIndex: number;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

/**
 * 확정 랭킹 1..M 진행 인디케이터 (토스 스타일 점).
 * 지나온 순위=옅게, 현재=블루, 남은 순위=회색. 색상만이 아니라 라벨로도 위치를 노출.
 */
export function RankProgress({ total, currentIndex }: RankProgressProps) {
  if (total <= 0) return null;
  const dots = Array.from({ length: total }, (_, i) => i);
  return (
    <div
      className={styles.wrap}
      role="img"
      aria-label={`총 ${total}순위 중 현재 ${currentIndex + 1}순위`}
    >
      <div className={styles.track}>
        {dots.map((i) => {
          const state = i < currentIndex ? 'passed' : i === currentIndex ? 'current' : 'remaining';
          return (
            <span key={i} className={styles.cell}>
              <span className={cx(styles.dot, styles[state])} aria-hidden="true">
                {i + 1}
              </span>
            </span>
          );
        })}
      </div>
      <p className={styles.caption}>
        지나온 순위 {currentIndex}개 · 남은 대안 {Math.max(0, total - currentIndex - 1)}개
      </p>
    </div>
  );
}

export default RankProgress;
