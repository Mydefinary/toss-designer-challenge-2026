/**
 * 하단 확정 버튼 위에 놓이는 저장/공유 액션 (2열 그리드).
 * 저장과 공유를 분리한다: [저장]은 스냅샷을 서버에 저장하고, [공유]는 링크를 클립보드에 복사한다.
 * 공유 시 아직 저장된 shareId가 없으면 ensureShareId()가 내부에서 먼저 저장한 뒤 링크를 만든다(자동 저장).
 * 결과는 토스트로 알리며, 토스트 타이머는 언마운트 시 정리한다. 백엔드(VITE_API_BASE) 미설정이면 두 버튼 모두 비활성.
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

export default function ShareActions() {
  const scenarioMeta = useScenarioMeta();
  const scenarioId = useMeetingStore((s) => s.scenarioId);
  const config = useConfig();
  const attendees = useAttendees();
  const constraints = useConstraints();
  const candidates = useCandidates();

  const enabled = isShareEnabled();
  const [shareId, setShareId] = useState<string | null>(null);
  const [savingState, setSavingState] = useState(false);
  const [sharingState, setSharingState] = useState(false);
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

  // 이미 저장한 shareId가 있으면 그대로 쓰고, 없으면 스냅샷을 저장해 id를 확보한다(공유의 자동 저장).
  const ensureShareId = async () => {
    if (shareId) return shareId;
    // 스냅샷 — 열람 화면(/shared/:id)이 재계산 없이 그대로 렌더할 수 있게 전부 담는다.
    const snapshot = { scenarioId, scenarioMeta, config, attendees, constraints, candidates };
    const { id } = await createShare(snapshot);
    setShareId(id);
    return id;
  };

  const handleSave = async () => {
    if (!enabled || savingState) return;
    setSavingState(true);
    try {
      // 저장은 항상 새 스냅샷을 만들어 저장한다(재저장 허용).
      const snapshot = { scenarioId, scenarioMeta, config, attendees, constraints, candidates };
      const { id } = await createShare(snapshot);
      setShareId(id);
      showToast('저장됐어요');
    } catch (e) {
      showToast(`저장에 실패했어요: ${(e as Error).message}`);
    } finally {
      setSavingState(false);
    }
  };

  const handleShare = async () => {
    if (!enabled || sharingState) return;
    setSharingState(true);
    try {
      const id = await ensureShareId();
      const url = `${window.location.origin}${window.location.pathname}#/shared/${id}`;
      const ok = await copyText(url);
      showToast(ok ? '링크를 복사했어요' : '링크를 만들었어요 (복사는 실패)');
    } catch (e) {
      showToast(`공유에 실패했어요: ${(e as Error).message}`);
    } finally {
      setSharingState(false);
    }
  };

  return (
    <>
      <div className={styles.shareActions}>
        <Button
          variant="secondary"
          fullWidth
          size="md"
          disabled={!enabled || savingState}
          onClick={handleSave}
        >
          {savingState ? '저장 중...' : shareId ? '저장됨' : '저장'}
        </Button>
        <Button
          variant="primary"
          fullWidth
          size="md"
          disabled={!enabled || sharingState}
          onClick={handleShare}
        >
          {sharingState ? '공유 중...' : '공유'}
        </Button>
      </div>

      {toast && (
        <div className={styles.shareToast} role="status">
          <span aria-hidden="true">✓</span>
          {toast}
        </div>
      )}
    </>
  );
}
