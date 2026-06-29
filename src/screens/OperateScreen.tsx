/**
 * 화면 5 — 운영·이슈 대응 (부록A 시나리오5 "이슈 대응" 맥락).
 * 확정된 1~5순위 백업을 바탕으로, 참석자 이슈 발생 시 다음 순위로 한 번에 전환하고
 * 변경 이력을 타임라인으로 남긴다. (오케스트레이션 only — 표시·상호작용은 operate/ 서브컴포넌트)
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useConfig,
  useScenarioMeta,
  useIssueLog,
  useMeetingActions,
  useMeetingStore,
} from '../store';
import { formatRange } from '../lib/recommend';
import type { MeetingConfig, RankedCandidate } from '../types';
import { Button, Card } from '../components/ui';
import { CurrentMeetingCard } from './operate/CurrentMeetingCard';
import { RankProgress } from './operate/RankProgress';
import { HistoryTimeline } from './operate/HistoryTimeline';
import styles from './operate/OperateScreen.module.css';

/** 재공유용 요약 텍스트 생성 */
function buildSummary(
  config: MeetingConfig,
  current: RankedCandidate,
  currentIndex: number,
): string {
  const locationText =
    config.location === 'online'
      ? '온라인'
      : `오프라인(${current.roomAvailable ? '회의실 가능' : '회의실 없음'})`;
  const satisfied = current.satisfied.map((a) => a.name).join(', ') || '없음';
  const yielding =
    current.yielding.map((y) => `${y.attendee.name}(${y.reason})`).join(', ') || '없음';
  const absent = current.absent.map((a) => a.name).join(', ') || '없음';

  return [
    `[MEETSYNC] ${config.title}`,
    `확정 시간: ${formatRange(current.startSlot, config.durationMinutes)} (현재 ${currentIndex + 1}순위)`,
    `장소: ${locationText}`,
    `참석: ${satisfied}`,
    `양보: ${yielding} / 불참: ${absent}`,
  ].join('\n');
}

/** 클립보드 복사 — Clipboard API 우선, 실패 시 textarea 폴백 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 폴백으로 진행
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function OperateScreen() {
  const navigate = useNavigate();
  const config = useConfig();
  const meta = useScenarioMeta();
  const issueLog = useIssueLog();
  const { moveToNextRank } = useMeetingActions();
  const confirmedRanking = useMeetingStore((s) => s.confirmedRanking);
  const currentRankIndex = useMeetingStore((s) => s.currentRankIndex);

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const banner = (
    <div className={styles.banner}>
      <div className={styles.bannerTop}>
        <span className={styles.bannerTag}>부록A · 시나리오5 이슈 대응</span>
        <span className={styles.bannerName}>{meta.name}</span>
      </div>
      <p className={styles.bannerGuide}>
        확정된 순위 백업으로 참석자 이슈에 즉시 대응합니다 — 재조율 없이 다음 순위로 전환하세요.
      </p>
    </div>
  );

  // ===== (A) 미확정 =====
  if (confirmedRanking === null) {
    return (
      <div className={styles.container}>
        {banner}
        <Card elevated className={styles.guideCard}>
          <h2 className={styles.guideTitle}>먼저 추천에서 회의를 확정하세요</h2>
          <p className={styles.guideDesc}>
            운영·이슈 대응은 확정된 1~5순위 백업이 있어야 동작합니다.
          </p>
          <div className={styles.guideAction}>
            <Button variant="primary" size="lg" onClick={() => navigate('/result')}>
              추천 결과로 이동
            </Button>
          </div>
        </Card>

        {issueLog.length > 0 && (
          <section className={styles.section} aria-label="변경 이력">
            <h3 className={styles.sectionTitle}>변경 이력</h3>
            <HistoryTimeline log={issueLog} />
          </section>
        )}
      </div>
    );
  }

  // ===== (B) 확정 =====
  const total = confirmedRanking.length;
  const current = confirmedRanking[currentRankIndex];

  // 확정됐지만 현재 후보를 찾을 수 없는 경우 (빈 랭킹 / 인덱스 이탈) 안전 메시지
  if (!current) {
    return (
      <div className={styles.container}>
        {banner}
        <Card elevated className={styles.safeMessage}>
          <p className={styles.safeTitle}>표시할 확정 순위가 없습니다</p>
          <p className={styles.safeDesc}>
            확정된 후보가 비어 있습니다. 추천 결과에서 다시 확정해 주세요.
          </p>
          <div className={styles.guideAction}>
            <Button variant="primary" onClick={() => navigate('/result')}>
              추천 결과로 이동
            </Button>
          </div>
        </Card>

        <section className={styles.section} aria-label="변경 이력">
          <h3 className={styles.sectionTitle}>변경 이력</h3>
          <HistoryTimeline log={issueLog} />
        </section>
      </div>
    );
  }

  const hasNextRank = currentRankIndex + 1 < total;

  const handleReshare = async () => {
    const ok = await copyText(buildSummary(config, current, currentRankIndex));
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      {banner}

      {/* 1. 현재 순위 카드 — 순위 전환 시 key 로 페이드/슬라이드 인 */}
      <div key={currentRankIndex} className={styles.promote}>
        <CurrentMeetingCard
          config={config}
          current={current}
          currentIndex={currentRankIndex}
          total={total}
        />
      </div>

      {/* 2. 순위 진행 인디케이터 */}
      <RankProgress total={total} currentIndex={currentRankIndex} />

      {/* 3·4. 핵심 액션 + 재공유 */}
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!hasNextRank}
          aria-disabled={!hasNextRank}
          aria-describedby={!hasNextRank ? 'no-next-notice' : undefined}
          onClick={moveToNextRank}
        >
          참석자 이슈 발생 → 다음 순위로 이동
        </Button>

        {hasNextRank ? (
          <p className={styles.helper}>
            다음 순위에는 다른 사람이 양보합니다 (재조율 없이 한 번에 전환).
          </p>
        ) : (
          <p id="no-next-notice" className={styles.notice} role="status">
            더 이상 대안 순위가 없습니다 — 재조율이 필요합니다.
          </p>
        )}

        <Button variant="secondary" fullWidth onClick={handleReshare} aria-live="polite">
          {copied ? (
            <span className={styles.copied}>복사됨 ✓</span>
          ) : (
            '현재 순위 재공유 (요약 복사)'
          )}
        </Button>
      </div>

      {/* 5. 변경 이력 타임라인 */}
      <section className={styles.section} aria-label="변경 이력">
        <h3 className={styles.sectionTitle}>변경 이력</h3>
        <HistoryTimeline log={issueLog} />
      </section>
    </div>
  );
}
