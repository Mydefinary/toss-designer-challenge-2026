/**
 * 상태 선택 바텀시트(모바일). 한 셀의 가능/회피/불가를 고른다.
 * - 가능/회피: 즉시 저장 후 닫힘.
 * - 불가: 즉시 status=unavailable 저장 후 사유 칩을 인라인으로 노출(닫지 않음).
 *   사유는 선택이며, '기타'는 자유 텍스트 입력.
 * ReasonPicker 에 의존하지 않고 사유 UI 를 직접 구성한다.
 */
import { useEffect, useState } from 'react';
import type { Availability, ConstraintCell, Slot, UnavailableReason } from '../../types';
import { formatSlot } from '../../lib/recommend';
import { useMeetingActions } from '../../store';
import { Chip } from '../../components/ui';
import styles from './StatusPopover.module.css';

/** 태그 사유(5종) — '기타'는 별도 텍스트 입력 칩으로 처리 */
const TAG_REASONS: UnavailableReason[] = ['외근', '미출근', '퇴근후', '휴가', '회의'];

const CHOICES: { status: Availability; label: string; icon: string }[] = [
  { status: 'available', label: '가능', icon: '●' },
  { status: 'avoid', label: '회피', icon: '▲' },
  { status: 'unavailable', label: '불가', icon: '✕' },
];

const CHOICE_CLASS: Record<Availability, string | undefined> = {
  available: styles.optAvailable,
  avoid: styles.optAvoid,
  unavailable: styles.optUnavailable,
};

export interface StatusPopoverProps {
  attendeeId: string;
  slot: Slot;
  cell: ConstraintCell;
  onClose: () => void;
}

export function StatusPopover({ attendeeId, slot, cell, onClose }: StatusPopoverProps) {
  const { setConstraint } = useMeetingActions();

  // 현재 선택 상태(하이라이트) — 초기값은 셀 상태
  const [status, setStatus] = useState<Availability>(cell.status);
  // 선택된 사유(하이라이트)
  const [reason, setReason] = useState<UnavailableReason | undefined>(cell.reason);
  // '기타' 텍스트 입력 노출 여부 + 값
  const [showOther, setShowOther] = useState<boolean>(cell.reason === '기타');
  const [otherText, setOtherText] = useState<string>(cell.reasonText ?? '');

  // 불가가 초기 상태면 사유 UI 를 기본 노출
  const showReasonUI = status === 'unavailable';

  // ESC 로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function chooseStatus(next: Availability) {
    if (next === 'unavailable') {
      // 불가: 사유 없이 일단 저장하고 사유 UI 를 연다(닫지 않음)
      setStatus('unavailable');
      setReason(undefined);
      setShowOther(false);
      setConstraint({ attendeeId, slot, status: 'unavailable' });
      return;
    }
    // 가능/회피: 즉시 저장 후 닫기
    setConstraint({ attendeeId, slot, status: next });
    onClose();
  }

  function pickReason(r: UnavailableReason) {
    setReason(r);
    setShowOther(false);
    setConstraint({ attendeeId, slot, status: 'unavailable', reason: r });
    onClose();
  }

  function pickOther() {
    setReason('기타');
    setShowOther(true);
    setConstraint({
      attendeeId,
      slot,
      status: 'unavailable',
      reason: '기타',
      ...(otherText ? { reasonText: otherText } : {}),
    });
  }

  function changeOther(value: string) {
    setOtherText(value);
    setConstraint({
      attendeeId,
      slot,
      status: 'unavailable',
      reason: '기타',
      ...(value ? { reasonText: value } : {}),
    });
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={`${formatSlot(slot)} 상태 선택`}>
        <div className={styles.handle} aria-hidden="true" />

        <div className={styles.head}>
          <span className={styles.title}>{formatSlot(slot)}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 3단계 상태 선택 */}
        <div className={styles.choices} role="group" aria-label="상태 선택">
          {CHOICES.map((c) => {
            const selected = status === c.status;
            return (
              <button
                key={c.status}
                type="button"
                className={`${styles.choice} ${CHOICE_CLASS[c.status]} ${selected ? styles.choiceSelected : ''}`}
                aria-pressed={selected}
                aria-label={c.label}
                onClick={() => chooseStatus(c.status)}
              >
                <span className={styles.choiceIcon} aria-hidden="true">
                  {c.icon}
                </span>
                <span className={styles.choiceLabel}>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* 불가 사유 — 선택일 때만 노출 */}
        {showReasonUI && (
          <div className={styles.reasonArea}>
            <p className={styles.hint}>사유는 비워둬도 저장돼요.</p>
            <div className={styles.chips}>
              {TAG_REASONS.map((r) => (
                <Chip key={r} tone="unavailable" selected={reason === r} onClick={() => pickReason(r)}>
                  {r}
                </Chip>
              ))}
              <Chip tone="unavailable" selected={reason === '기타'} onClick={pickOther}>
                기타
              </Chip>
            </div>

            {showOther && (
              <div className={styles.otherRow}>
                <input
                  className={styles.input}
                  type="text"
                  value={otherText}
                  placeholder="직접 사유를 입력하세요 (선택)"
                  onChange={(e) => changeOther(e.target.value)}
                  aria-label="기타 사유 입력"
                  autoFocus
                />
                <button type="button" className={styles.confirm} onClick={onClose}>
                  확인
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
