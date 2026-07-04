/**
 * 앱 셸 — 모바일 퍼스트 레이아웃 + 헤더(워드마크·목록 이동·스텝 인디케이터).
 * 시나리오 선택기는 제거했다. 회의 흐름(/m/:id/*) 경로에서만 스텝 네비와 "목록" 뒤로가기를 노출한다.
 * '/' 또는 '/shared/*' 에서는 스텝 네비를 렌더하지 않는다.
 */
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './AppShell.module.css';

/** 회의 흐름 5단계 세그먼트 (스텝 순서) */
const STEP_SEGMENTS = ['create', 'constraints', 'result', 'confirm', 'operate'] as const;

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // /m/:id/<segment> 매칭 — 회의 흐름 여부와 현재 스텝 판정
  const match = location.pathname.match(
    /^\/m\/([^/]+)\/(create|constraints|result|confirm|operate)$/,
  );
  const id = match?.[1] ?? null;
  const segment = match?.[2] ?? null;
  const currentStep = segment
    ? STEP_SEGMENTS.indexOf(segment as (typeof STEP_SEGMENTS)[number]) + 1
    : 0;
  const inMeetingFlow = id !== null;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.topRow}>
          {/* 자체 워드마크 — 클릭 시 목록으로 */}
          <button
            type="button"
            className={styles.wordmarkBtn}
            onClick={() => navigate('/')}
          >
            <span className={styles.wordmark}>
              <span className={styles.mark} aria-hidden="true" />
              <span>
                MEET<span className={styles.brandText}>SYNC</span>
              </span>
            </span>
          </button>

          {/* 회의 흐름에서만 목록 뒤로가기 */}
          {inMeetingFlow && (
            <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>
              ← 목록
            </button>
          )}
        </div>

        {/* 스텝 인디케이터 1~5 — 회의 흐름에서만 */}
        {inMeetingFlow && (
          <nav className={styles.steps} aria-label="진행 단계">
            {STEP_SEGMENTS.map((seg, i) => {
              const n = i + 1;
              const cls =
                n === currentStep
                  ? `${styles.step} ${styles.stepActive}`
                  : n < currentStep
                    ? `${styles.step} ${styles.stepDone}`
                    : styles.step;
              return (
                <button
                  key={seg}
                  type="button"
                  className={cls}
                  aria-current={n === currentStep ? 'step' : undefined}
                  onClick={() => navigate(`/m/${id}/${STEP_SEGMENTS[i]}`)}
                >
                  {n}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main className={styles.body}>{children}</main>
    </div>
  );
}

export default AppShell;
