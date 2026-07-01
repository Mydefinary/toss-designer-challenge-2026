/**
 * 브러시 팔레트 — 격자 위에서 현재 칠할 상태(가능 ●/회피 ▲/불가 ✕)를 고른다.
 * '불가' 브러시를 고르면 사유(외근·미출근·퇴근후·휴가·회의·기타)를 인라인으로 선택한다.
 * 팝오버/모달 없이 현재 화면에서 즉시 동작. 색만으로 구분하지 않고 아이콘+라벨을 병행한다.
 */
import type { Availability, UnavailableReason } from '../../types';
import { Chip } from '../../components/ui';
import styles from './BrushPalette.module.css';

/** 태그 사유(5종) + '기타'(자유 텍스트) */
const TAG_REASONS: UnavailableReason[] = ['외근', '미출근', '퇴근후', '휴가', '회의', '기타'];

const BRUSHES: { status: Availability; label: string; icon: string }[] = [
  { status: 'available', label: '가능', icon: '●' },
  { status: 'avoid', label: '회피', icon: '▲' },
  { status: 'unavailable', label: '불가', icon: '✕' },
];

const BRUSH_CLASS: Record<Availability, string | undefined> = {
  available: styles.available,
  avoid: styles.avoid,
  unavailable: styles.unavailable,
};

export interface BrushPaletteProps {
  brush: Availability;
  onBrush: (status: Availability) => void;
  reason?: UnavailableReason;
  onReason: (reason: UnavailableReason) => void;
  otherText: string;
  onOtherText: (text: string) => void;
}

export function BrushPalette({ brush, onBrush, reason, onReason, otherText, onOtherText }: BrushPaletteProps) {
  return (
    <div className={styles.palette}>
      {/* 2단계 사용법 안내 — 브러시가 '칠하는 도구'임을 표에 앞서 알린다 */}
      <div className={styles.head}>
        <span className={styles.headTitle}>칠할 상태 고르기</span>
        <span className={styles.headSteps}>① 상태를 고른 뒤 → ② 아래 표의 칸을 클릭·드래그</span>
      </div>

      <div className={styles.brushes} role="group" aria-label="칠할 상태(브러시) 선택">
        {BRUSHES.map((b) => {
          const selected = brush === b.status;
          return (
            <button
              key={b.status}
              type="button"
              className={`${styles.brush} ${BRUSH_CLASS[b.status]} ${selected ? styles.brushSelected : ''}`}
              aria-pressed={selected}
              aria-label={`${b.label} 브러시${selected ? ' (선택됨)' : ''}`}
              onClick={() => onBrush(b.status)}
            >
              <span className={styles.brushIcon} aria-hidden="true">
                {b.icon}
              </span>
              <span className={styles.brushLabel}>{b.label}</span>
            </button>
          );
        })}
      </div>

      {/* 불가 브러시일 때만 사유 선택 인라인 노출 */}
      {brush === 'unavailable' && (
        <div className={styles.reasonArea}>
          <span className={styles.reasonHint}>불가 사유 (선택)</span>
          <div className={styles.chips} role="group" aria-label="불가 사유 선택">
            {TAG_REASONS.map((r) => (
              <Chip key={r} tone="unavailable" selected={reason === r} onClick={() => onReason(r)}>
                {r}
              </Chip>
            ))}
          </div>
          {reason === '기타' && (
            <input
              className={styles.input}
              type="text"
              value={otherText}
              placeholder="직접 사유를 입력하세요 (선택)"
              aria-label="기타 사유 입력"
              onChange={(e) => onOtherText(e.target.value)}
            />
          )}
        </div>
      )}

      {/* 상태 범례 — 색만이 아니라 아이콘+라벨을 병행 표기 */}
      <ul className={styles.legend} aria-label="상태 범례">
        <li>
          <span className={`${styles.legendIcon} ${styles.available}`} aria-hidden="true">●</span>가능
        </li>
        <li>
          <span className={`${styles.legendIcon} ${styles.avoid}`} aria-hidden="true">▲</span>회피
        </li>
        <li>
          <span className={`${styles.legendIcon} ${styles.unavailable}`} aria-hidden="true">✕</span>불가
        </li>
        <li>
          <span className={`${styles.legendIcon} ${styles.lunchSwatch}`} aria-hidden="true"></span>점심 · 기본 불가(클릭해 변경)
        </li>
      </ul>
    </div>
  );
}
