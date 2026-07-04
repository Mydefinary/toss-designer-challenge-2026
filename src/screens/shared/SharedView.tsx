/**
 * 공유 열람 화면 (/shared/:id) — 읽기 전용.
 * 마운트 시 getShare(id) 로 스냅샷을 불러와 재계산 없이 그대로 렌더한다.
 * 순위 카드(드릴다운 토글) + 순위별 👍/👎 + 모두의 상황(TransparencyBoard) + 코멘트 패널.
 * 모든 네트워크 호출은 try/catch 로 감싸 실패해도 화면이 깨지지 않고 토스트로 안내한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Attendee, ConstraintCell, MeetingConfig, RankedCandidate } from '../../types';
import { Button } from '../../components/ui';
import RankCard from '../result/RankCard';
import TransparencyBoard from '../result/TransparencyBoard';
import RankDetail from '../confirm/RankDetail';
import CommentPanel from './CommentPanel';
import {
  getComments,
  getShare,
  postComment,
  type ShareComment,
} from '../../lib/shareApi';
import styles from './shared.module.css';

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

const AUTHOR_KEY = 'meetsync.commentAuthor';

/** 스냅샷 로컬 타입 — getShare().snapshot 을 방어적으로 캐스팅한다 */
interface SharedSnapshot {
  scenarioId?: string;
  scenarioMeta?: { id: string; name: string; purpose: string };
  config: MeetingConfig;
  attendees: Attendee[];
  constraints: ConstraintCell[];
  candidates: RankedCandidate[];
}

/** config 누락 시 기본값 (RankCard 가 location/durationMinutes 를 참조하므로 최소값 보장) */
const DEFAULT_CONFIG: MeetingConfig = {
  title: '공유된 회의',
  durationMinutes: 60,
  dateRange: { start: '', end: '' },
  location: 'online',
  rooms: [],
};

/** 임의 JSON 스냅샷을 안전하게 SharedSnapshot 으로 변환 (필드 없으면 기본값/빈 배열) */
function coerceSnapshot(raw: unknown): SharedSnapshot {
  const s = (raw ?? {}) as Partial<SharedSnapshot>;
  return {
    scenarioId: s.scenarioId,
    scenarioMeta: s.scenarioMeta,
    config: { ...DEFAULT_CONFIG, ...(s.config ?? {}) },
    attendees: Array.isArray(s.attendees) ? s.attendees : [],
    constraints: Array.isArray(s.constraints) ? s.constraints : [],
    candidates: Array.isArray(s.candidates) ? s.candidates : [],
  };
}

type Status = 'loading' | 'error' | 'loaded';

export default function SharedView() {
  const { id } = useParams<{ id: string }>();

  const [status, setStatus] = useState<Status>('loading');
  const [errorKind, setErrorKind] = useState<'notfound' | 'network'>('network');
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [comments, setComments] = useState<ShareComment[]>([]);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [author, setAuthor] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 표시 이름 프리필 (localStorage)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTHOR_KEY);
      if (saved) setAuthor(saved);
    } catch {
      // 저장소 접근 불가는 무시
    }
  }, []);

  // 토스트 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(msg);
    timerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const reloadComments = useCallback(async () => {
    if (!id) return;
    try {
      setComments(await getComments(id));
    } catch {
      showToast('코멘트를 불러오지 못했어요');
    }
  }, [id, showToast]);

  const load = useCallback(async () => {
    if (!id) {
      setErrorKind('notfound');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const rec = await getShare(id);
      setSnapshot(coerceSnapshot(rec.snapshot));
      setStatus('loaded');
      // 코멘트는 비필수 — 실패해도 열람은 유지
      try {
        setComments(await getComments(id));
      } catch {
        // 조용히 무시(작성 시 재조회로 복구)
      }
    } catch (e) {
      const msg = (e as Error).message;
      setErrorKind(msg.includes('404') ? 'notfound' : 'network');
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAuthorChange = (v: string) => {
    setAuthor(v);
    try {
      localStorage.setItem(AUTHOR_KEY, v);
    } catch {
      // 저장 실패는 무시
    }
  };

  const handleVote = async (rank: number, vote: 'up' | 'down') => {
    if (!id) return;
    if (!author.trim()) {
      showToast('먼저 표시할 이름을 입력해주세요');
      return;
    }
    try {
      await postComment(id, { author: author.trim(), rank, vote });
      await reloadComments();
    } catch (e) {
      showToast(`의견 전송 실패: ${(e as Error).message}`);
    }
  };

  const handleSubmitComment = async (rank: number | null, text: string): Promise<boolean> => {
    if (!id) return false;
    if (!author.trim()) {
      showToast('먼저 표시할 이름을 입력해주세요');
      return false;
    }
    if (!text.trim()) {
      showToast('코멘트를 입력해주세요');
      return false;
    }
    try {
      await postComment(id, { author: author.trim(), rank, text: text.trim() });
      await reloadComments();
      return true;
    } catch (e) {
      showToast(`코멘트 전송 실패: ${(e as Error).message}`);
      return false;
    }
  };

  const votesFor = (rank: number, vote: 'up' | 'down') =>
    comments.filter((c) => c.rank === rank && c.vote === vote).length;

  // ===== 상태별 렌더 =====

  if (status === 'loading') {
    return (
      <div className={styles.screen}>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
        <p className={styles.centerHint}>불러오는 중…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.stateBox}>
        <p className={styles.stateTitle}>
          {errorKind === 'notfound' ? '존재하지 않는 공유 링크예요' : '불러오지 못했어요'}
        </p>
        <p className={styles.stateHint}>
          {errorKind === 'notfound'
            ? '링크가 만료되었거나 주소가 올바르지 않아요.'
            : '네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.'}
        </p>
        {errorKind === 'network' && (
          <Button variant="secondary" onClick={() => void load()}>
            다시 시도
          </Button>
        )}
      </div>
    );
  }

  // status === 'loaded'
  const snap = snapshot!;
  const { config, candidates, attendees, constraints, scenarioMeta } = snap;
  const ranks = candidates.map((c) => c.rank);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.badge}>공유된 상황 · 읽기 전용</span>
        <h1 className={styles.title}>{config.title}</h1>
        {scenarioMeta?.name && <p className={styles.subtitle}>{scenarioMeta.name}</p>}
      </header>

      <section className={styles.section} aria-label="추천 순위">
        <h2 className={styles.sectionTitle}>추천 시간 {candidates.length}순위</h2>
        {candidates.length === 0 ? (
          <p className={styles.sectionHint}>공유 시점에 추천 후보가 없었어요.</p>
        ) : (
          <div className={styles.rankList}>
            {candidates.map((c) => {
              const yields = Array.isArray(c.yielding) ? c.yielding : [];
              const showDetail = c.rank === 1 || selectedRank === c.rank;
              return (
              <div key={c.rank} className={styles.rankItem}>
                <RankCard
                  candidate={c}
                  location={config.location}
                  durationMinutes={config.durationMinutes}
                  selected={selectedRank === c.rank}
                  onToggle={() =>
                    setSelectedRank((prev) => (prev === c.rank ? null : c.rank))
                  }
                />
                {yields.length === 0 ? (
                  <div className={styles.yieldBannerPositive}>
                    양보 없이 모두 가능한 시간이에요
                  </div>
                ) : (
                  <div className={styles.yieldBanner}>
                    <p>
                      {yields.length === 1 && (
                        <>
                          <strong className={styles.yieldNames}>
                            {(yields[0]?.attendee?.name || '참석자')}님
                          </strong>
                          이 {yields[0]?.reason || '회피'}를 양보해서 이 시간이 가능해졌어요
                        </>
                      )}
                      {yields.length === 2 && (
                        <>
                          <strong className={styles.yieldNames}>
                            {(yields[0]?.attendee?.name || '참석자')}·
                            {(yields[1]?.attendee?.name || '참석자')}님
                          </strong>
                          이 양보해서 이 시간이 가능해졌어요
                        </>
                      )}
                      {yields.length >= 3 && (
                        <>
                          <strong className={styles.yieldNames}>
                            {(yields[0]?.attendee?.name || '참석자')}님 외 {yields.length - 1}명
                          </strong>
                          이 양보해서 이 시간이 가능해졌어요
                        </>
                      )}
                    </p>
                    <div className={styles.yieldReasons}>
                      {yields.map((y, i) => (
                        <span key={i} className={styles.yieldReasonItem}>
                          {(y.attendee?.name || '참석자')}님 {y.reason || '회피'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {showDetail && (
                  <div className={styles.rankDetailWrap}>
                    <RankDetail candidate={c} />
                  </div>
                )}
                <div className={styles.voteRow}>
                  <span className={styles.voteLabel}>{c.rank}순위 의견</span>
                  <button
                    type="button"
                    className={styles.voteBtn}
                    onClick={() => handleVote(c.rank, 'up')}
                    aria-label={`${c.rank}순위 찬성`}
                  >
                    👍 <span className={styles.voteCount}>{votesFor(c.rank, 'up')}</span>
                  </button>
                  <button
                    type="button"
                    className={cx(styles.voteBtn, styles.voteBtnDown)}
                    onClick={() => handleVote(c.rank, 'down')}
                    aria-label={`${c.rank}순위 반대`}
                  >
                    👎 <span className={styles.voteCount}>{votesFor(c.rank, 'down')}</span>
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.section} aria-label="모두의 상황">
        <h2 className={styles.sectionTitle}>모두의 상황</h2>
        <TransparencyBoard attendees={attendees} constraints={constraints} />
      </section>

      <CommentPanel
        author={author}
        onAuthorChange={handleAuthorChange}
        ranks={ranks}
        comments={comments}
        onSubmit={handleSubmitComment}
      />

      {toast && (
        <div className={styles.toast} role="status">
          <span aria-hidden="true">✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
