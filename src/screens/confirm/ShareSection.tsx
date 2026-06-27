/**
 * 공유 영역 — 공유 링크 복사 + 요약 텍스트 복사 + 성공 토스트.
 * 토스트 타이머는 언마운트/재설정 시 정리해 누수를 막는다.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { copyText } from './clipboard';
import styles from './confirm.module.css';

interface ShareSectionProps {
  shareUrl: string;
  summaryText: string;
}

export default function ShareSection({ shareUrl, summaryText }: ShareSectionProps) {
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

  const handleCopy = async (text: string, okMsg: string) => {
    const ok = await copyText(text);
    showToast(ok ? okMsg : '복사에 실패했어요');
  };

  return (
    <section className={styles.section} aria-label="공유">
      <h2 className={styles.sectionTitle}>팀에 공유하기</h2>

      <Card className={styles.shareCard}>
        <pre className={styles.preBlock}>{summaryText}</pre>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => handleCopy(summaryText, '텍스트가 복사됐어요')}
        >
          텍스트 복사
        </Button>
      </Card>

      <Card className={styles.shareCard}>
        <p className={styles.linkBlock}>{shareUrl}</p>
        <Button fullWidth onClick={() => handleCopy(shareUrl, '링크가 복사됐어요')}>
          공유 링크 복사
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
