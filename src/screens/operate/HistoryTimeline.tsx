import type { IssueLogEntry } from '../../store';
import styles from './HistoryTimeline.module.css';

export interface HistoryTimelineProps {
  log: IssueLogEntry[];
}

const KIND_CLASS: Record<IssueLogEntry['kind'], string> = {
  confirm: 'confirm',
  'rank-move': 'rankMove',
  relax: 'relax',
  'undo-relax': 'undoRelax',
};

const KIND_LABEL: Record<IssueLogEntry['kind'], string> = {
  confirm: '확정',
  'rank-move': '순위 이동',
  relax: '완화',
  'undo-relax': '완화 취소',
};

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * 변경 이력 — 토스 스타일 세로 타임라인. 최신이 위.
 * 종류별 색 점 + 종류 라벨(색상 단독 의존 방지).
 */
export function HistoryTimeline({ log }: HistoryTimelineProps) {
  if (log.length === 0) {
    return <p className={styles.empty}>아직 변경 이력이 없습니다</p>;
  }

  const items = [...log].reverse();

  return (
    <ol className={styles.timeline}>
      {items.map((entry, i) => (
        <li key={`${entry.at}-${i}`} className={styles.item}>
          <span
            className={`${styles.dot} ${styles[KIND_CLASS[entry.kind]]}`}
            aria-hidden="true"
          />
          <div className={styles.content}>
            <div className={styles.metaRow}>
              <span className={styles.kind}>{KIND_LABEL[entry.kind]}</span>
              <time className={styles.time}>{formatTime(entry.at)}</time>
            </div>
            <p className={styles.desc}>
              {entry.kind === 'rank-move' &&
              entry.fromRank != null &&
              entry.toRank != null ? (
                <>
                  <strong className={styles.rankMove}>
                    {entry.fromRank}순위 → {entry.toRank}순위
                  </strong>{' '}
                  {entry.description.replace(/^\d+순위 → \d+순위 이동:\s*/, '')}
                </>
              ) : (
                entry.description
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default HistoryTimeline;
