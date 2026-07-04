/**
 * 화면 4 — 확정·공유 (트랙 D).
 * 확정된 순위를 요약하고(1순위 강조, 2~5순위는 예비), 링크/텍스트로 공유한다.
 * 예비 순위의 의미("1순위가 안 되면 자동 이동")를 분명히 전달한다.
 */
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card } from '../components/ui';
import { useCandidates, useConfig, useScenarioMeta } from '../store';
import { dayName, formatRange } from '../lib/recommend';
import ShareSection from './confirm/ShareSection';
import RankDetail from './confirm/RankDetail';
import { buildSummaryText } from './confirm/summary';
import styles from './confirm/confirm.module.css';

export default function ConfirmScreen() {
  const navigate = useNavigate();
  const candidates = useCandidates();
  const config = useConfig();
  const meta = useScenarioMeta();

  const top = candidates[0];

  // 직접 /confirm 진입 등으로 후보가 없을 때
  if (!top) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>아직 확정된 후보가 없어요</p>
        <Button onClick={() => navigate('/result')}>추천 결과로 가기</Button>
      </div>
    );
  }

  const backups = candidates.slice(1);

  // 공유 링크 — 해시 라우팅 + 시나리오/1순위 슬롯
  const shareUrl =
    `${window.location.origin}${window.location.pathname}` +
    `#/confirm?s=${meta.id}&top=${top.startSlot.day}-${top.startSlot.blockIndex}`;

  // 사람이 읽는 요약 텍스트 — 순위별 참석/양보/불참 상세 포함
  const summaryText = buildSummaryText(candidates, config, shareUrl);

  return (
    <div className={styles.screen}>
      <header>
        <h1 className={styles.title}>최적 일정을 결정했어요</h1>
        <p className={styles.subtitle}>
          {config.title} · {meta.name}
        </p>
      </header>

      <section className={styles.section} aria-label="확정 순위">
        <Card emphasized className={styles.topCard}>
          <div className={styles.topLabelRow}>
            <span className={styles.topBadge}>최적 1순위</span>
            <Badge tone="success" icon="●">
              {top.satisfied.length}명 참석
            </Badge>
          </div>
          <p className={styles.topTime}>{dayName(top.startSlot.day)} {formatRange(top.startSlot, config.durationMinutes)}</p>
          <RankDetail candidate={top} />
        </Card>

        {backups.length > 0 && (
          <>
            <p className={styles.autoMoveNote}>
              1순위가 어려워지면 2순위로 자동 이동해요. 아래는 예비 순위입니다.
            </p>
            <div className={styles.rankList}>
              {backups.map((c) => (
                <Card key={c.rank} className={styles.backupCard}>
                  <Badge tone="neutral">예비 {c.rank}순위</Badge>
                  <p className={styles.backupTime}>{dayName(c.startSlot.day)} {formatRange(c.startSlot, config.durationMinutes)}</p>
                  <RankDetail candidate={c} />
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      <ShareSection shareUrl={shareUrl} summaryText={summaryText} />

      <Button fullWidth size="lg" onClick={() => navigate('/operate')}>
        운영 화면으로 (이슈 대응)
      </Button>
    </div>
  );
}
