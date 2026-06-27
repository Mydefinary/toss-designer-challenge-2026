/**
 * (d) 완화 제안 패널 — relaxations 가 비어있지 않을 때만 렌더(예: 시나리오 3).
 * 카드 클릭 → applyRelaxation(s). 적용 이력이 있으면 되돌리기 노출.
 */
import type { RelaxationSuggestion } from '../../types';
import { Button, Card } from '../../components/ui';
import { useMeetingStore, useMeetingActions, useRelaxations } from '../../store';
import { signed } from './constants';
import styles from './result.module.css';

export default function RelaxationPanel() {
  const relaxations = useRelaxations();
  const { applyRelaxation, undoRelaxation } = useMeetingActions();
  const appliedCount = useMeetingStore((s) => s.appliedRelaxations.length);

  if (relaxations.length === 0) return null;

  return (
    <section className={styles.section} aria-label="제약 완화 제안">
      <h2 className={styles.sectionTitle}>지금은 가능한 시간이 부족해요</h2>
      <p className={styles.sectionHint}>무엇을 풀면 모두가 모일 수 있을까요? 하나를 눌러 적용해보세요.</p>

      {relaxations.map((s: RelaxationSuggestion, i) => (
        <Card
          key={i}
          elevated
          className={styles.relaxCard}
          role="button"
          tabIndex={0}
          onClick={() => applyRelaxation(s)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              applyRelaxation(s);
            }
          }}
        >
          <p className={styles.relaxDesc}>{s.description}</p>
          <p className={styles.relaxMeta}>
            후보 {signed(s.gain)} · 부담 {s.cost}
          </p>
        </Card>
      ))}

      {appliedCount > 0 && (
        <div className={styles.relaxUndoRow}>
          <Button variant="ghost" size="sm" onClick={() => undoRelaxation()}>
            되돌리기
          </Button>
        </div>
      )}
    </section>
  );
}
