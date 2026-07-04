/**
 * (d) 완화 제안 패널 — relaxations 가 비어있지 않을 때만 규칙 카드를 렌더(예: 시나리오 3).
 * 카드 클릭 → applyRelaxation(s). 적용 이력이 있으면 되돌리기 노출.
 * 후보가 하나도 없을 때는 Claude 대체안(AI 대안)을 조용히 제안한다(실패는 숨김).
 */
import { useEffect, useRef, useState } from 'react';
import type { RelaxationSuggestion } from '../../types';
import { Badge, Button, Card } from '../../components/ui';
import {
  useMeetingStore,
  useMeetingActions,
  useRelaxations,
  useCandidates,
  useConfig,
  useAttendees,
  useConstraints,
} from '../../store';
import { suggestAlternative, type AlternativeSuggestion } from '../../lib/alternativeApi';
import { signed } from './constants';
import styles from './result.module.css';

// 비용 등급을 한국어 뱃지(톤/라벨)로 변환: low=낮음(available/초록), medium=보통(avoid/주황), high=높음(unavailable/빨강)
function costBadge(cost: AlternativeSuggestion['cost']): { tone: 'available' | 'avoid' | 'unavailable'; label: string } {
  if (cost === 'low') return { tone: 'available', label: '비용 낮음' };
  if (cost === 'medium') return { tone: 'avoid', label: '비용 보통' };
  return { tone: 'unavailable', label: '비용 높음' };
}

export default function RelaxationPanel() {
  const relaxations = useRelaxations();
  const candidates = useCandidates();
  const config = useConfig();
  const attendees = useAttendees();
  const constraints = useConstraints();
  const { applyRelaxation, undoRelaxation } = useMeetingActions();
  const appliedCount = useMeetingStore((s) => s.appliedRelaxations.length);

  const [ai, setAi] = useState<{ suggestions: AlternativeSuggestion[]; loading: boolean; failed: boolean }>({ suggestions: [], loading: false, failed: false });
  const requestedRef = useRef(false);

  useEffect(() => {
    // 새 deps 조합마다 한 번은 재요청할 수 있도록 가드를 먼저 해제한다.
    requestedRef.current = false;

    // 후보가 있으면 절대 Claude 대안을 호출하지 않는다.
    if (candidates.length > 0) {
      return;
    }

    // 후보가 하나도 없을 때만 Claude 대안을 요청한다. 같은 렌더 주기 중복 호출 방지.
    if (requestedRef.current) {
      return;
    }
    requestedRef.current = true;

    let cancelled = false;
    setAi((p) => ({ ...p, loading: true, failed: false }));

    (async () => {
      try {
        const res = await suggestAlternative({
          config,
          attendees,
          constraints,
          durationMinutes: config.durationMinutes,
          dateRange: config.dateRange,
        });
        if (!cancelled) setAi({ suggestions: res.suggestions ?? [], loading: false, failed: false });
      } catch {
        // 실패 시 AI 섹션은 조용히 숨김 — 토스트/재throw 없음.
        if (!cancelled) setAi({ suggestions: [], loading: false, failed: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidates.length, config, attendees, constraints]);

  const hasAi = ai.suggestions.length > 0;

  const aiSection = hasAi ? (
    <div className={styles.aiSection}>
      {ai.suggestions.map((s, i) => {
        const b = costBadge(s.cost);
        return (
          <Card key={i} className={styles.aiCard}>
            <p className={styles.aiTitle}>{s.title}</p>
            <p className={styles.aiDetail}>{s.detail}</p>
            <Badge tone={b.tone}>{b.label}</Badge>
          </Card>
        );
      })}
    </div>
  ) : null;

  if (relaxations.length === 0 && !hasAi) return null;

  if (relaxations.length === 0 && hasAi) {
    return (
      <section className={styles.section} aria-label="제약 완화 제안">
        <h2 className={styles.sectionTitle}>지금은 가능한 시간이 부족해요</h2>
        <p className={styles.sectionHint}>무엇을 풀면 모두가 모일 수 있을까요? 하나를 눌러 적용해보세요.</p>
        {aiSection}
      </section>
    );
  }

  const top = relaxations[0] as RelaxationSuggestion;

  return (
    <section className={styles.section} aria-label="제약 완화 제안">
      <h2 className={styles.sectionTitle}>지금은 가능한 시간이 부족해요</h2>
      <p className={styles.sectionHint}>무엇을 풀면 모두가 모일 수 있을까요? 하나를 눌러 적용해보세요.</p>

      <p className={styles.relaxTopLabel}>가장 간단한 방법</p>
      <Card
        className={`${styles.relaxCard} ${styles.relaxTopCard}`}
        elevated
        role="button"
        tabIndex={0}
        onClick={() => applyRelaxation(top)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyRelaxation(top); } }}
      >
        <p className={styles.relaxDesc}>{top.description}</p>
        <p className={styles.relaxMeta}>후보 {signed(top.gain)} · 부담 {top.cost}</p>
      </Card>

      {relaxations.slice(1).map((s: RelaxationSuggestion, i) => (
        <Card key={i} elevated className={styles.relaxCard} role="button" tabIndex={0}
          onClick={() => applyRelaxation(s)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyRelaxation(s); } }}>
          <p className={styles.relaxDesc}>{s.description}</p>
          <p className={styles.relaxMeta}>후보 {signed(s.gain)} · 부담 {s.cost}</p>
        </Card>
      ))}

      {appliedCount > 0 && (
        <div className={styles.relaxUndoRow}>
          <Button variant="ghost" size="sm" onClick={() => undoRelaxation()}>되돌리기</Button>
        </div>
      )}

      {aiSection}
    </section>
  );
}
