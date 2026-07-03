/**
 * 순위 목록 헤더용 "저장 공유" 버튼.
 * 기존 ShareSituation 의 공유 로직(스냅샷 저장 → 링크 생성 → 클립보드 복사 → 토스트)을 그대로 재사용한다.
 * 버튼 하나로 저장+공유를 완료한다. 백엔드(VITE_API_BASE) 미설정이면 비활성.
 * 토스트 타이머는 언마운트 시 정리한다.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui';
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

export default function ShareButton() {
  const scenarioMeta = useScenarioMeta();
  const scenarioId = useMeetingStore((s) => s.scenarioId);
  const config = useConfig();
  const attendees = useAttendees();
  const constraints = useConstraints();
  const candidates = useCandidates();

  const enabled = isShareEnabled();
  const [loading, setLoading] = useState(false);
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
      const ok = await copyText(url);
      showToast(ok ? '공유 링크를 복사했어요' : '링크를 만들었어요 (복사는 실패)');
    } catch (e) {
      showToast(`공유에 실패했어요: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={!enabled || loading}
        onClick={handleShare}
      >
        {loading ? '공유 중...' : '저장 공유'}
      </Button>

      {toast && (
        <div className={styles.shareToast} role="status">
          <span aria-hidden="true">✓</span>
          {toast}
        </div>
      )}
    </>
  );
}
