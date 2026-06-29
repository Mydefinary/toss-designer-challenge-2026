/**
 * 화면 2 — 제약 입력 v2.
 * 상단 모드 탭으로 버튼 격자 입력(ButtonPanel)과 자연어 채팅(ConstraintChat)을 전환한다.
 * 두 모드 모두 같은 store(useConstraints)를 구독·갱신한다.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { ModeTabs, type InputMode } from './constraints/ModeTabs';
import { ButtonPanel } from './constraints/ButtonPanel';
import { ConstraintChat } from './constraints/ConstraintChat';
import styles from './constraints/ConstraintsScreen.module.css';

export default function ConstraintsScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<InputMode>('button');

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>제약 입력</h1>
        <p className={styles.subtitle}>버튼으로 고르거나, 자연어로 입력해 시간을 정해요.</p>
      </header>

      {/* 입력 방식 전환 */}
      <ModeTabs mode={mode} onChange={setMode} />

      {/* 모드별 패널 — 둘 다 같은 store 구독 */}
      {mode === 'button' ? <ButtonPanel /> : <ConstraintChat />}

      {/* 하단 CTA */}
      <div className={styles.cta}>
        <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/result')}>
          추천 결과 보기
        </Button>
      </div>
    </>
  );
}
