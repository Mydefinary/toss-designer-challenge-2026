/**
 * 화면 0 — 회의 목록(홈).
 * 내 ownerToken 으로 만든 회의를 나열하고, 빈 회의 또는 예시 시나리오로 새 회의를 만든다.
 * 카드를 누르면 해당 회의의 생성 화면(/m/:id/create)으로 진입한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Chip } from '../../components/ui';
import {
  listMeetings,
  createMeeting,
  uuid,
  type MeetingSummary,
  type MeetingData,
} from '../../lib/meetingsApi';
import { listPresets, getPreset, deletePreset, type PresetSummary } from '../../lib/presetsApi';
import { scenarios, defaultScenario } from '../../data/scenarios';
import type { Attendee } from '../../types';
import styles from './MeetingListScreen.module.css';

type Status = 'loading' | 'error' | 'ready';

/** 목록 아이템 — 서버 요약 + 낙관적 생성 중 플래그(있으면 임시 카드) */
type ListItem = MeetingSummary & { pending?: boolean };

/** 빈 회의 기본 데이터 — 참석자 2명·제약 없음 */
function minimalData(): MeetingData {
  const attendees: Attendee[] = [
    { id: uuid(), name: '참석자 1', role: 'required', avatarColor: '#0064FF' },
    { id: uuid(), name: '참석자 2', role: 'optional', avatarColor: '#7B61FF' },
  ];
  return {
    config: {
      title: '제목 없는 회의',
      durationMinutes: 60,
      dateRange: structuredClone(defaultScenario.config.dateRange),
      location: 'offline',
      rooms: [],
    },
    attendees,
    constraints: [],
  };
}

/** createdAt/updatedAt 을 ko-KR 로 표기(유효하지 않으면 '-') */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR');
}

export default function MeetingListScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [list, setList] = useState<ListItem[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [presetStatus, setPresetStatus] = useState<Status>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const meetings = await listMeetings();
      setList(meetings);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    setStatus('loading');
    listMeetings()
      .then((meetings) => {
        if (ignore) return;
        setList(meetings);
        setStatus('ready');
      })
      .catch(() => {
        if (ignore) return;
        setStatus('error');
      });
    return () => {
      ignore = true;
    };
  }, []);

  // 프리셋 목록 로드 (회의 목록과 별개 상태로 관리)
  useEffect(() => {
    let ignore = false;
    setPresetStatus('loading');
    listPresets()
      .then((ps) => {
        if (ignore) return;
        setPresets(ps);
        setPresetStatus('ready');
      })
      .catch(() => {
        if (ignore) return;
        setPresetStatus('error');
      });
    return () => {
      ignore = true;
    };
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

  const handleCreate = useCallback(
    async (title: string, data: MeetingData) => {
      // temp: 접두사로 서버 실제 id와 충돌 불가, 임시 카드 식별 용이
      const tempId = `temp:${uuid()}`;
      const now = new Date().toISOString();
      const optimistic: ListItem = {
        id: tempId,
        title,
        createdAt: now,
        updatedAt: now,
        pending: true,
      };
      // 낙관적으로 임시 카드를 맨 앞에 붙이고 곧바로 생성 요청
      setList((prev) => [optimistic, ...prev]);
      setCreateError(null);
      try {
        const { id } = await createMeeting(title, data);
        // 서버가 준 실제 id로 교체하고 pending 해제
        setList((prev) =>
          prev.map((it) => (it.id === tempId ? { ...it, id, pending: false } : it)),
        );
        navigate(`/m/${id}/create`);
      } catch (e) {
        // 실패 시 임시 카드를 롤백하고 에러/토스트 안내
        setList((prev) => prev.filter((it) => it.id !== tempId));
        setCreateError(`회의를 만들지 못했어요: ${(e as Error).message}`);
        showToast(`회의를 만들지 못했어요: ${(e as Error).message}`);
      }
    },
    [navigate, showToast],
  );

  // 프리셋으로 새 회의 만들기 — 전체 레코드를 받아 그대로 회의 생성(참석자/장소/제약 정합 유지)
  const handleUsePreset = useCallback(
    async (summary: PresetSummary) => {
      try {
        const record = await getPreset(summary.id);
        const title = summary.name.trim() ? summary.name : '제목 없는 회의';
        // handleCreate 가 낙관적 카드 + createMeeting + 이동을 처리한다
        await handleCreate(title, record.data);
      } catch (e) {
        showToast(`프리셋을 불러오지 못했어요: ${(e as Error).message}`);
      }
    },
    [handleCreate, showToast],
  );

  // 프리셋 삭제 — 목록에서 즉시 제거(행 클릭 전파 방지는 호출부에서)
  const handleDeletePreset = useCallback(
    async (id: string) => {
      try {
        await deletePreset(id);
        setPresets((prev) => prev.filter((p) => p.id !== id));
      } catch (e) {
        showToast(`프리셋을 삭제하지 못했어요: ${(e as Error).message}`);
      }
    },
    [showToast],
  );

  // 생성 컨트롤(빈 회의 + 예시로 시작) — ready/empty 상태 모두에서 노출
  const controls = (
    <div className={styles.controls}>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => void handleCreate('제목 없는 회의', minimalData())}
      >
        + 회의 만들기
      </Button>

      <div className={styles.exampleBlock}>
        <span className={styles.sectionTitle}>예시로 시작</span>
        <div className={styles.chipRow}>
          {scenarios.map((sc) => (
            <Chip
              key={sc.id}
              onClick={() => {
                void handleCreate(sc.config.title, {
                  config: structuredClone(sc.config),
                  attendees: structuredClone(sc.attendees),
                  constraints: structuredClone(sc.constraints),
                });
              }}
            >
              {sc.name}
            </Chip>
          ))}
        </div>
      </div>

      {createError && <p className={styles.errorText}>{createError}</p>}
    </div>
  );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>내 회의</h1>
        <p className={styles.headerSubtitle}>새 회의를 만들거나 이어서 진행해요.</p>
      </header>

      {status === 'loading' && <p className={styles.hint}>불러오는 중…</p>}

      {status === 'error' && (
        <div className={styles.stateBox}>
          <p className={styles.errorText}>회의 목록을 불러오지 못했어요.</p>
          <Button variant="secondary" onClick={() => void load()}>
            다시 시도
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {list.length === 0 ? (
            <p className={styles.hint}>아직 만든 회의가 없어요. 새 회의를 만들어보세요.</p>
          ) : (
            <div className={styles.cardList}>
              {list.map((m) => {
                const title = m.title.trim() ? m.title : '제목 없는 회의';
                // 생성 중인 임시 카드 — 클릭 불가, "만드는 중…" 표시
                if (m.pending) {
                  return (
                    <Card
                      key={m.id}
                      className={`${styles.meetingCard} ${styles.meetingCardPending}`}
                    >
                      <span className={styles.meetingTitle}>{title}</span>
                      <span className={styles.meetingPendingLabel}>만드는 중…</span>
                    </Card>
                  );
                }
                return (
                  <Card
                    key={m.id}
                    className={styles.meetingCard}
                    onClick={() => navigate(`/m/${m.id}/create`)}
                  >
                    <span className={styles.meetingTitle}>{title}</span>
                    <span className={styles.meetingDates}>
                      만든 날 {formatDate(m.createdAt)} · 수정 {formatDate(m.updatedAt)}
                    </span>
                  </Card>
                );
              })}
            </div>
          )}
          {controls}

          <section className={styles.presetSection}>
            <span className={styles.sectionTitle}>프리셋에서 만들기</span>
            {presetStatus === 'loading' && <p className={styles.hint}>프리셋을 불러오는 중…</p>}
            {presetStatus === 'error' && (
              <p className={styles.errorText}>프리셋을 불러오지 못했어요.</p>
            )}
            {presetStatus === 'ready' &&
              (presets.length === 0 ? (
                <p className={styles.hint}>저장된 프리셋이 없어요.</p>
              ) : (
                <div className={styles.cardList}>
                  {presets.map((p) => {
                    const name = p.name.trim() ? p.name : '이름 없는 프리셋';
                    return (
                      <Card
                        key={p.id}
                        className={styles.presetCard}
                        onClick={() => void handleUsePreset(p)}
                      >
                        <div className={styles.presetInfo}>
                          <span className={styles.meetingTitle}>{name}</span>
                          <span className={styles.meetingDates}>
                            만든 날 {formatDate(p.createdAt)} · 수정 {formatDate(p.updatedAt)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeletePreset(p.id);
                          }}
                        >
                          삭제
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              ))}
          </section>

          {toast && (
            <div className={styles.toast} role="status">
              <span aria-hidden="true">✓</span>
              {toast}
            </div>
          )}
        </>
      )}
    </div>
  );
}
