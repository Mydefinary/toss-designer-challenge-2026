/**
 * 화면3 — "이 상황 공유하기".
 * 현재 검토 중인 상황(1~5순위 + 모두의 상황)을 스냅샷으로 저장해 공유 링크를 만든다.
 * 화면4의 '확정 결과 공유'와 달리 아직 확정 전 검토 상태를 그대로 공유하는 용도.
 * 백엔드(VITE_API_BASE) 미설정이면 버튼 비활성 + 안내.
 * 토스트 타이머는 confirm/ShareSection 패턴대로 언마운트 시 정리한다.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { copyText } from '../confirm/clipboard';
import { createShare, isShareEnabled } from '../../lib/shareApi';
import {
  useAttendees,
  useCandidates,
  useConfig,
  useConstraints,
  useMeetingStore,
  useScenarioMeta,
} from '../../store';
import styles from './result.module.css';

export default function ShareSituation() {
  const scenarioMeta = useScenarioMeta();
  const scenarioId = useMeetingStore((s) => s.scenarioId);
  const config = useConfig();
  const attendees = useAttendees();
  const constraints = useConstraints();
  const candidates = useCandidates();

  const enabled = isShareEnabled();
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(msg);
    timerRef.current = setTimeout(() => setToast(null), 2600);
  };

  const handleShare = async () => {
    if (!enabled || loading) return;
    setLoading(true);
    try {
      // 스냅샷 — 열람 화면(/shared/:id)이 재계산 없이 그대로 렌더할 수 있게 전부 담는다.
      const snapshot = { scenarioId, scenarioMeta, config, attendees, constraints, candidates };
      const { id } = await createShare(snapshot);
      const url = `${window.location.origin}${window.location.pathname}#/shared/${id}`;
      setShareUrl(url);
      const ok = await copyText(url);
      showToast(ok ? '공유 링크를 복사했어요' : '링크를 만들었어요 (복사는 실패)');
    } catch (e) {
      showToast(`공유에 실패했어요: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.section} aria-label="상황 공유">
      <h2 className={styles.sectionTitle}>이 상황 공유하기</h2>
      <Card className={styles.shareSituationCard}>
        <p className={styles.shareSituationDesc}>
          현재 검토 중인 상황(1~5순위 + 모두의 상황)을 그대로 공유합니다. 받는 사람은 읽기 전용으로
          열람하고 순위별 👍/👎와 코멘트를 남길 수 있어요.
        </p>

        {!enabled ? (
          <p className={styles.shareSituationHint}>백엔드 연결이 필요해요 (VITE_API_BASE 미설정)</p>
        ) : (
          shareUrl && <p className={styles.shareSituationLink}>{shareUrl}</p>
        )}

        <Button
          variant="secondary"
          fullWidth
          disabled={!enabled || loading}
          onClick={handleShare}
        >
          {loading ? '공유 중...' : shareUrl ? '공유 링크 다시 만들기' : '이 상황 공유하기'}
        </Button>
      </Card>

      {toast && (
        <div className={styles.shareToast} role="status">
          <span aria-hidden="true">✓</span>
          {toast}
        </div>
      )}
    </section>
  );
}
