/**
 * 화면 5 — 운영·이슈 대응 (부록A 시나리오5 "이슈 대응" 맥락).
 * 확정된 1~5순위를 전부 카드로 나열하고, 그중 하나를 라디오로 최종 선택한다.
 * 이슈가 생기면 다른 순위를 다시 최종으로 선택해 즉시 전환한다(재조율/완화 없음).
 * (오케스트레이션 only — 표시·상호작용은 operate/ 서브컴포넌트)
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useConfig,
  useScenarioMeta,
  useIssueLog,
  useFinalChoice,
  useMeetingActions,
  useMeetingStore,
} from '../store';
import { formatRange, dayName } from '../lib/recommend';
import type { MeetingConfig, RankedCandidate } from '../types';
import { Button, Card } from '../components/ui';
import { useMeetingLoader } from './useMeetingLoader';
import { RankCard } from './operate/RankCard';
import { HistoryTimeline } from './operate/HistoryTimeline';
import styles from './operate/OperateScreen.module.css';

/** 재공유용 요약 텍스트 생성 — 최종 선택 후보 기준 */
function buildSummary(
  config: MeetingConfig,
  final: RankedCandidate,
  finalIndex: number,
): string {
  const locationText =
    config.location === 'online'
      ? '온라인'
      : `오프라인(${final.roomAvailable ? '회의실 가능' : '회의실 없음'})`;
  const satisfied = final.satisfied.map((a) => a.name).join(', ') || '없음';
  const yielding =
    final.yielding.map((y) => `${y.attendee.name}(${y.reason})`).join(', ') || '없음';
  const absent = final.absent.map((a) => a.name).join(', ') || '없음';

  return [
    `[MEETSYNC] ${config.title}`,
    `최종 시간: ${dayName(final.startSlot.day)} ${formatRange(final.startSlot, config.durationMinutes)} (${finalIndex + 1}순위)`,
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
  const { fallback } = useMeetingLoader();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const config = useConfig();
  const meta = useScenarioMeta();
  const issueLog = useIssueLog();
  const finalCandidate = useFinalChoice();
  const { setFinalChoice } = useMeetingActions();
  const confirmedRanking = useMeetingStore((s) => s.confirmedRanking);
  const finalChoice = useMeetingStore((s) => s.finalChoice);

  const listRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  if (fallback) return fallback;

  const banner = (
    <div className={styles.banner}>
      <div className={styles.bannerTop}>
        <span className={styles.bannerTag}>부록A · 시나리오5 이슈 대응</span>
        <span className={styles.bannerName}>{meta.name}</span>
      </div>
      <p className={styles.bannerGuide}>
        확정된 1~5순위 중 하나를 최종으로 선택하세요. 이슈가 생기면 다른 순위를 다시 선택해
        즉시 전환합니다(재조율 없음).
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
            <Button variant="primary" size="lg" onClick={() => navigate(`/m/${id}/result`)}>
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
  // 최종 후보 — 훅 우선, 없으면 finalChoice 인덱스로 폴백
  const final = finalCandidate ?? confirmedRanking[finalChoice];

  // 확정됐지만 표시할 후보가 없는 경우(빈 랭킹 / 인덱스 이탈) 안전 메시지
  if (total === 0 || !final) {
    return (
      <div className={styles.container}>
        {banner}
        <Card elevated className={styles.safeMessage}>
          <p className={styles.safeTitle}>표시할 확정 순위가 없습니다</p>
          <p className={styles.safeDesc}>
            확정된 후보가 비어 있습니다. 추천 결과에서 다시 확정해 주세요.
          </p>
          <div className={styles.guideAction}>
            <Button variant="primary" onClick={() => navigate(`/m/${id}/result`)}>
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

  /** 해당 인덱스 카드로 키보드 포커스 이동(roving tabindex) */
  const focusCard = (index: number) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-rank-index="${index}"]`);
    el?.focus();
  };

  /** radiogroup 키보드 탐색 — 이동=선택(setFinalChoice) */
  const handleListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        next = finalChoice - 1;
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        next = finalChoice + 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = total - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const clamped = Math.max(0, Math.min(total - 1, next));
    if (clamped !== finalChoice) setFinalChoice(clamped);
    focusCard(clamped);
  };

  const handleReshare = async () => {
    const ok = await copyText(buildSummary(config, final, finalChoice));
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      {banner}

      {/* 1. 확정된 1~5순위 — 라디오 그룹으로 최종 선택 */}
      <div
        ref={listRef}
        className={styles.rankList}
        role="radiogroup"
        aria-label="확정된 회의 순위 — 최종 선택"
        onKeyDown={handleListKeyDown}
      >
        {confirmedRanking.map((candidate, index) => (
          <RankCard
            key={index}
            config={config}
            candidate={candidate}
            index={index}
            selected={index === finalChoice}
            onSelect={setFinalChoice}
          />
        ))}
      </div>

      <p className={styles.helper}>
        이슈가 생기면 완화 없이 다른 순위를 다시 선택해 즉시 전환합니다.
      </p>

      {/* 2. 최종 선택 재공유 */}
      <div className={styles.actions}>
        <Button variant="secondary" fullWidth onClick={handleReshare} aria-live="polite">
          {copied ? (
            <span className={styles.copied}>복사됨 ✓</span>
          ) : (
            '최종 선택 재공유 (요약 복사)'
          )}
        </Button>
      </div>

      {/* 3. 변경 이력 타임라인 */}
      <section className={styles.section} aria-label="변경 이력">
        <h3 className={styles.sectionTitle}>변경 이력</h3>
        <HistoryTimeline log={issueLog} />
      </section>
    </div>
  );
}
