/**
 * 공유 영역 — 공유 링크 복사 + 요약 텍스트 복사 + 성공 토스트.
 * 버튼 클릭 시 createShare(snapshot) 로 id를 발급받아 #/shared/{id} 링크를 생성한다.
 * (ensureShareId 패턴: 이미 발급된 id가 있으면 재사용)
 * 토스트 타이머는 언마운트/재설정 시 정리해 누수를 막는다.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { copyText } from './clipboard';
import { buildSummaryText } from './summary';
import { createShare, isShareEnabled } from '../../lib/shareApi';
import {
  useAttendees,
  useCandidates,
  useConfig,
  useConstraints,
  useMeetingStore,
  useScenarioMeta,
} from '../../store';
import styles from './confirm.module.css';

export default function ShareSection() {
  const scenarioMeta = useScenarioMeta();
  const scenarioId = useMeetingStore((s) => s.scenarioId);
  const config = useConfig();
  const attendees = useAttendees();
  const constraints = useConstraints();
  const candidates = useCandidates();

  const enabled = isShareEnabled();
  const [shareId, setShareId] = useState<string | null>(null);
  const [linkCopying, setLinkCopying] = useState(false);
  const [textCopying, setTextCopying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(msg);
    timerRef.current = setTimeout(() => setToast(null), 2000);
  };

  // 이미 발급된 shareId가 있으면 재사용, 없으면 스냅샷 저장 후 id 확보
  const ensureShareId = async (): Promise<string> => {
    if (shareId) return shareId;
    const snapshot = { scenarioId, scenarioMeta, config, attendees, constraints, candidates };
    const { id } = await createShare(snapshot);
    setShareId(id);
    return id;
  };

  const makeShareUrl = (id: string): string =>
    `${window.location.origin}${window.location.pathname}#/shared/${id}`;

  const handleCopyLink = async () => {
    if (!enabled || linkCopying) return;
    setLinkCopying(true);
    try {
      const id = await ensureShareId();
      const url = makeShareUrl(id);
      const ok = await copyText(url);
      showToast(ok ? '링크가 복사됐어요' : '링크를 만들었어요 (복사는 실패)');
    } catch (e) {
      showToast(`공유에 실패했어요: ${(e as Error).message}`);
    } finally {
      setLinkCopying(false);
    }
  };

  const handleCopyText = async () => {
    if (!enabled || textCopying) return;
    setTextCopying(true);
    try {
      const id = await ensureShareId();
      const url = makeShareUrl(id);
      const text = buildSummaryText(candidates, config, url);
      const ok = await copyText(text);
      showToast(ok ? '텍스트가 복사됐어요' : '텍스트 복사에 실패했어요');
    } catch (e) {
      showToast(`복사에 실패했어요: ${(e as Error).message}`);
    } finally {
      setTextCopying(false);
    }
  };

  // 미리보기용 요약 텍스트 (링크는 발급 전이면 placeholder)
  const previewText = buildSummaryText(
    candidates,
    config,
    shareId ? makeShareUrl(shareId) : '(복사 버튼을 누르면 링크가 생성됩니다)',
  );

  return (
    <section className={styles.section} aria-label="공유">
      <h2 className={styles.sectionTitle}>팀에 공유하기</h2>

      <Card className={styles.shareCard}>
        <pre className={styles.preBlock}>{previewText}</pre>
        <Button
          variant="secondary"
          fullWidth
          disabled={!enabled || textCopying}
          onClick={handleCopyText}
        >
          {textCopying ? '복사 중...' : '텍스트 복사'}
        </Button>
      </Card>

      <Card className={styles.shareCard}>
        <p className={styles.linkBlock}>
          {shareId ? makeShareUrl(shareId) : '버튼을 눌러 공유 링크를 생성하세요'}
        </p>
        <Button
          fullWidth
          disabled={!enabled || linkCopying}
          onClick={handleCopyLink}
        >
          {linkCopying ? '생성 중...' : '공유 링크 복사'}
        </Button>
      </Card>

      {toast && (
        <div className={styles.toast} role="status">
          <span aria-hidden="true">✓</span>
          {toast}
        </div>
      )}
    </section>
  );
}
