/**
 * 화면 2 — 제약 입력 v2.
 * 상단 모드 탭으로 버튼 격자 입력(ButtonPanel)과 자연어 채팅(ConstraintChat)을 전환한다.
 * 두 모드 모두 같은 store(useConstraints)를 구독·갱신한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui';
import { useMeetingActions } from '../store';
import { createPreset } from '../lib/presetsApi';
import { useMeetingLoader } from './useMeetingLoader';
import { ModeTabs, type InputMode } from './constraints/ModeTabs';
import { ButtonPanel } from './constraints/ButtonPanel';
import { ConstraintChat } from './constraints/ConstraintChat';
import styles from './constraints/ConstraintsScreen.module.css';

export default function ConstraintsScreen() {
  const { fallback } = useMeetingLoader();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<InputMode>('button');

  const { getMeetingData } = useMeetingActions();
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetToast, setPresetToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 토스트 타이머 정리
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setPresetToast(msg);
    toastTimer.current = setTimeout(() => setPresetToast(null), 2600);
  }, []);

  // 저장 폼 열기 — 기본 이름을 현재 회의 제목으로 채운다
  const openPresetForm = useCallback(() => {
    setPresetName(getMeetingData().config.title ?? '');
    setPresetOpen(true);
  }, [getMeetingData]);

  const handleSavePreset = useCallback(async () => {
    const name = presetName.trim();
    if (!name || presetSaving) return; // 빈 이름/중복 저장 방지
    setPresetSaving(true);
    try {
      await createPreset(name, getMeetingData());
      setPresetOpen(false);
      showToast('프리셋으로 저장했어요');
    } catch (e) {
      showToast(`프리셋 저장에 실패했어요: ${(e as Error).message}`);
    } finally {
      setPresetSaving(false);
    }
  }, [presetName, presetSaving, getMeetingData, showToast]);

  if (fallback) return fallback;

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
        <Button variant="primary" size="lg" fullWidth onClick={() => navigate(`/m/${id}/result`)}>
          추천 결과 보기
        </Button>
      </div>

      {/* 프리셋으로 저장 */}
      <div className={styles.presetSave}>
        {!presetOpen ? (
          <Button variant="secondary" size="md" fullWidth onClick={openPresetForm}>
            프리셋으로 저장
          </Button>
        ) : (
          <div className={styles.presetForm}>
            <input
              className={styles.presetInput}
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="프리셋 이름"
              aria-label="프리셋 이름"
              autoFocus
            />
            <div className={styles.presetFormButtons}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={presetName.trim().length === 0 || presetSaving}
                onClick={() => void handleSavePreset()}
              >
                {presetSaving ? '저장 중…' : '저장'}
              </Button>
              <Button
                variant="ghost"
                size="md"
                fullWidth
                disabled={presetSaving}
                onClick={() => setPresetOpen(false)}
              >
                취소
              </Button>
            </div>
          </div>
        )}
      </div>

      {presetToast && (
        <div className={styles.presetToast} role="status">
          <span aria-hidden="true">✓</span>
          {presetToast}
        </div>
      )}
    </>
  );
}
