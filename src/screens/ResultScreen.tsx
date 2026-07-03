/**
 * 화면 3 — 추천 결과 (트랙 D).
 * 정보 비대칭을 없애 자발적 양보를 끌어낸다(PRD 3.2).
 * 순서: 컨텍스트 헤더 → 순위 카드 → 투명성 보드(접힘) → 완화 패널 → 하단 확정 버튼.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useCandidates, useConfig, useMeetingActions } from '../store';
import ResultHeader from './result/ResultHeader';
import RankCard from './result/RankCard';
import TransparencyBoard from './result/TransparencyBoard';
import RelaxationPanel from './result/RelaxationPanel';
import ShareSituation from './result/ShareSituation';
import styles from './result/result.module.css';

export default function ResultScreen() {
  const navigate = useNavigate();
  const candidates = useCandidates();
  const config = useConfig();
  const { confirm } = useMeetingActions();

  // 펼쳐진 순위(드릴다운). null = 모두 접힘.
  const [selectedRank, setSelectedRank] = useState<number | null>(null);

  const isEmpty = candidates.length === 0;

  const handleConfirm = () => {
    confirm();
    navigate('/confirm');
  };

  return (
    <div className={styles.screen}>
      <ResultHeader />

      {!isEmpty && (
        <section className={styles.section} aria-label="추천 순위">
          <h2 className={styles.sectionTitle}>추천 시간 {candidates.length}순위</h2>
          <div className={styles.rankList}>
            {candidates.map((c) => (
              <RankCard
                key={c.rank}
                candidate={c}
                location={config.location}
                durationMinutes={config.durationMinutes}
                selected={selectedRank === c.rank}
                onToggle={() =>
                  setSelectedRank((prev) => (prev === c.rank ? null : c.rank))
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className={styles.section} aria-label="모두의 상황">
        <h2 className={styles.sectionTitle}>모두의 상황</h2>
        <TransparencyBoard />
      </section>

      <RelaxationPanel />

      <ShareSituation />

      <div className={styles.bottomBar}>
        {isEmpty && (
          <p className={styles.bottomEmpty}>
            가능한 시간이 없어요. 아래 완화 제안을 적용해보세요
          </p>
        )}
        <Button fullWidth size="lg" disabled={isEmpty} onClick={handleConfirm}>
          이 순위로 확정하기
        </Button>
      </div>
    </div>
  );
}
