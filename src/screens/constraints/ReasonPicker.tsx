/**
 * 불가 사유 선택 인라인 패널.
 * 사유 태그 5종 + '기타'(자유 텍스트). 선택 즉시 상위로 setConstraint 호출.
 * slotKey 로 key 를 부여해 셀이 바뀌면 remount → 초기값 재시드.
 */
import { useState } from 'react';
import type { Slot, UnavailableReason } from '../../types';
import { formatSlot } from '../../lib/recommend';
import { Chip } from '../../components/ui';
import styles from './ReasonPicker.module.css';

/** 태그 사유(5) + 기타 */
const REASONS: UnavailableReason[] = ['외근', '미출근', '퇴근후', '휴가', '회의', '기타'];

export interface ReasonPickerProps {
  slot: Slot;
  /** 현재 셀에 저장된 사유 */
  reason?: UnavailableReason;
  /** 현재 셀의 자유 텍스트('기타') */
  reasonText?: string;
  /** 사유 확정 — reasonText 는 '기타'일 때만 전달 */
  onSelect: (reason: UnavailableReason, reasonText?: string) => void;
  onClose: () => void;
}

export function ReasonPicker({ slot, reason, reasonText, onSelect, onClose }: ReasonPickerProps) {
  const [text, setText] = useState(reasonText ?? '');

  function pick(r: UnavailableReason) {
    if (r === '기타') onSelect('기타', text);
    else onSelect(r);
  }

  function onText(value: string) {
    setText(value);
    onSelect('기타', value);
  }

  const showInput = reason === '기타';

  return (
    <div className={styles.panel} role="group" aria-label="불가 사유 선택">
      <div className={styles.head}>
        <div className={styles.titles}>
          <span className={styles.title}>불가 사유</span>
          <span className={styles.slot}>{formatSlot(slot)}</span>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="사유 패널 닫기">
          ✕
        </button>
      </div>

      <div className={styles.chips}>
        {REASONS.map((r) => (
          <Chip
            key={r}
            tone="unavailable"
            selected={reason === r}
            onClick={() => pick(r)}
          >
            {r}
          </Chip>
        ))}
      </div>

      {showInput && (
        <input
          className={styles.input}
          type="text"
          value={text}
          placeholder="직접 사유를 입력하세요 (선택)"
          onChange={(e) => onText(e.target.value)}
          autoFocus
        />
      )}

      <p className={styles.hint}>사유는 비워둬도 저장돼요. 패널을 닫아도 불가는 유지돼요.</p>
    </div>
  );
}
