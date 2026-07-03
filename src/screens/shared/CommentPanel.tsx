/**
 * 공유 열람 화면의 코멘트 패널 — 표시 이름 입력 + 대상(전체/순위) 선택 + 코멘트 작성 + 목록.
 * 네트워크 호출은 부모(SharedView)의 onSubmit 이 담당하며 성공 시 true 를 반환한다.
 * 목록은 createdAt 오름차순으로 정렬해 표시한다.
 */
import { useState } from 'react';
import { Button } from '../../components/ui';
import type { ShareComment } from '../../lib/shareApi';
import styles from './shared.module.css';

interface CommentPanelProps {
  author: string;
  onAuthorChange: (v: string) => void;
  /** 코멘트 대상으로 고를 수 있는 순위 목록 */
  ranks: number[];
  comments: ShareComment[];
  /** 코멘트 전송 — 성공하면 true (부모가 author/네트워크 검증 및 토스트 처리) */
  onSubmit: (rank: number | null, text: string) => Promise<boolean>;
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

function rankLabel(rank: number | null): string {
  return rank == null ? '전체' : `${rank}순위`;
}

function voteIcon(vote: 'up' | 'down' | null): string {
  return vote === 'up' ? '👍' : vote === 'down' ? '👎' : '';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CommentPanel({
  author,
  onAuthorChange,
  ranks,
  comments,
  onSubmit,
}: CommentPanelProps) {
  const [target, setTarget] = useState<string>('all'); // 'all' | 순위 문자열
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const rank = target === 'all' ? null : Number(target);
      const ok = await onSubmit(rank, text);
      if (ok) setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={styles.section} aria-label="코멘트">
      <h2 className={styles.sectionTitle}>의견 남기기</h2>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="comment-author">
          표시 이름
        </label>
        <input
          id="comment-author"
          className={styles.input}
          value={author}
          onChange={(e) => onAuthorChange(e.target.value)}
          placeholder="이름을 입력하세요"
          maxLength={20}
        />
      </div>

      <div className={styles.composer}>
        <select
          className={styles.targetSelect}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="코멘트 대상"
        >
          <option value="all">전체</option>
          {ranks.map((r) => (
            <option key={r} value={String(r)}>
              {r}순위
            </option>
          ))}
        </select>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="코멘트를 입력하세요"
          rows={2}
        />
      </div>

      <Button variant="secondary" fullWidth disabled={sending} onClick={handleSend}>
        {sending ? '보내는 중...' : '코멘트 남기기'}
      </Button>

      <div className={styles.commentList}>
        {sorted.length === 0 ? (
          <p className={styles.sectionHint}>아직 남긴 의견이 없어요. 첫 의견을 남겨보세요.</p>
        ) : (
          sorted.map((c) => (
            <div key={c.id} className={styles.commentItem}>
              <div className={styles.commentHead}>
                <span className={styles.commentAuthor}>{c.author}</span>
                <span className={cx(styles.commentTag, c.rank == null && styles.commentTagAll)}>
                  {rankLabel(c.rank)}
                </span>
                {c.vote && <span className={styles.commentVote}>{voteIcon(c.vote)}</span>}
                <span className={styles.commentTime}>{formatTime(c.createdAt)}</span>
              </div>
              {c.text && <p className={styles.commentText}>{c.text}</p>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
