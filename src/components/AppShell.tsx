/**
 * 앱 셸 — 모바일 퍼스트 레이아웃 + 헤더(워드마크·시나리오 선택·스텝 인디케이터).
 * 토스 로고를 쓰지 않고 자체 워드마크(MEETSYNC)를 쓰되 블루 톤만 차용한다.
 */
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './AppShell.module.css';
import { scenarios } from '../data/scenarios';
import { useMeetingStore, useScenarioMeta, useMeetingActions } from '../store';

/** pathname → 스텝 번호(1~5) */
const STEP_BY_PATH: Record<string, number> = {
  '/create': 1,
  '/constraints': 2,
  '/result': 3,
  '/confirm': 4,
  '/operate': 5,
};
const STEP_PATHS = ['/create', '/constraints', '/result', '/confirm', '/operate'];

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const meta = useScenarioMeta();
  const scenarioId = useMeetingStore((s) => s.scenarioId);
  const { loadScenario } = useMeetingActions();

  const currentStep = STEP_BY_PATH[location.pathname] ?? 1;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.topRow}>
          {/* 자체 워드마크 */}
          <span className={styles.wordmark}>
            <span className={styles.mark} aria-hidden="true" />
            <span>
              MEET<span className={styles.brandText}>SYNC</span>
            </span>
          </span>

          {/* 시나리오 선택 */}
          <select
            className={styles.scenarioSelect}
            value={scenarioId}
            onChange={(e) => loadScenario(e.target.value)}
            aria-label="시나리오 선택"
            title={meta.purpose}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 스텝 인디케이터 1~5 */}
        <nav className={styles.steps} aria-label="진행 단계">
          {STEP_PATHS.map((path, i) => {
            const n = i + 1;
            const cls =
              n === currentStep
                ? `${styles.step} ${styles.stepActive}`
                : n < currentStep
                  ? `${styles.step} ${styles.stepDone}`
                  : styles.step;
            return (
              <button
                key={path}
                type="button"
                className={cls}
                aria-current={n === currentStep ? 'step' : undefined}
                onClick={() => navigate(path)}
              >
                {n}
              </button>
            );
          })}
        </nav>
      </header>

      <main className={styles.body}>{children}</main>
    </div>
  );
}

export default AppShell;
