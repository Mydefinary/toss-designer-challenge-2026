/**
 * 상단 모드 탭 — 버튼 격자 입력 ↔ 자연어 채팅 입력 전환.
 * 토스 세그먼트(필) 스타일. 선택 세그먼트만 흰 배경 + 그림자.
 */
import styles from './ModeTabs.module.css';

export type InputMode = 'button' | 'chat';

export interface ModeTabsProps {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
}

const TABS: { value: InputMode; label: string }[] = [
  { value: 'button', label: '버튼으로 선택' },
  { value: 'chat', label: '자연어로 입력' },
];

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className={styles.bar} role="tablist" aria-label="제약 입력 방식">
      {TABS.map((tab) => {
        const selected = tab.value === mode;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.segment} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
