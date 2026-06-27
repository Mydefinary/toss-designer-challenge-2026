/**
 * 화면 2 — 제약 입력.
 * 참석자별 요일(5)×시간(8) 3단계 상태(가능/회피/불가)를 격자로 토글.
 * 제약은 절대 로컬 복제하지 않고 store(useConstraints)에서 파생한다.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConstraints, useAttendees, useMeetingActions } from '../store';
import { makeConstraintLookup, formatSlot } from '../lib/recommend';
import { Button, Badge } from '../components/ui';
import type { Availability, Slot, UnavailableReason } from '../types';
import { AttendeeTabs } from './constraints/AttendeeTabs';
import { SlotGrid } from './constraints/SlotGrid';
import { ReasonPicker } from './constraints/ReasonPicker';
import styles from './constraints/ConstraintsScreen.module.css';

/** 셀 탭 순환: 가능 → 회피 → 불가 → 가능 */
const NEXT_STATUS: Record<Availability, Availability> = {
  available: 'avoid',
  avoid: 'unavailable',
  unavailable: 'available',
};

export default function ConstraintsScreen() {
  const constraints = useConstraints();
  const attendees = useAttendees();
  const { setConstraint } = useMeetingActions();
  const navigate = useNavigate();

  // 선택 참석자 — 첫 참석자 기본. 시나리오 변경 등으로 사라지면 첫 참석자로 폴백.
  const [picked, setPicked] = useState<string>('');
  const selectedId = attendees.some((a) => a.id === picked) ? picked : (attendees[0]?.id ?? '');

  // 사유 패널이 열린 셀(불가 편집 중). 없으면 null.
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);

  // store 제약에서 파생한 조회 헬퍼 — 없으면 'available'
  const lookup = useMemo(() => makeConstraintLookup(constraints), [constraints]);

  // 선택 참석자 기준 요약(불가/회피 칸 수)
  const { avoidCount, unavailableCount } = useMemo(() => {
    let avoid = 0;
    let unavailable = 0;
    for (const c of constraints) {
      if (c.attendeeId !== selectedId) continue;
      if (c.status === 'avoid') avoid += 1;
      else if (c.status === 'unavailable') unavailable += 1;
    }
    return { avoidCount: avoid, unavailableCount: unavailable };
  }, [constraints, selectedId]);

  function selectAttendee(id: string) {
    setPicked(id);
    setEditingSlot(null); // 참석자 전환 시 사유 패널 닫기
  }

  function handleCellClick(slot: Slot) {
    const current = lookup(selectedId, slot).status;
    const next = NEXT_STATUS[current];
    // 불가로 진입하면 일단 사유 없이 저장 후 사유 패널을 연다.
    setConstraint({ attendeeId: selectedId, slot, status: next });
    if (next === 'unavailable') setEditingSlot(slot);
    else setEditingSlot(null);
  }

  function handleReason(reason: UnavailableReason, reasonText?: string) {
    if (!editingSlot) return;
    setConstraint({
      attendeeId: selectedId,
      slot: editingSlot,
      status: 'unavailable',
      reason,
      ...(reasonText ? { reasonText } : {}),
    });
  }

  const editingCell = editingSlot ? lookup(selectedId, editingSlot) : null;

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>제약 입력</h1>
        <p className={styles.subtitle}>참석자별로 가능·회피·불가 시간을 칸을 눌러 정해요.</p>
      </header>

      {/* 1. 참석자 탭 */}
      <AttendeeTabs attendees={attendees} selectedId={selectedId} onSelect={selectAttendee} />

      {/* 범례 + 요약 */}
      <div className={styles.legendRow}>
        <div className={styles.legend}>
          <span className={styles.legendItem} data-tone="available">
            ● 가능
          </span>
          <span className={styles.legendItem} data-tone="avoid">
            ▲ 회피
          </span>
          <span className={styles.legendItem} data-tone="unavailable">
            ✕ 불가
          </span>
        </div>
        <Badge tone={unavailableCount + avoidCount > 0 ? 'unavailable' : 'neutral'}>
          불가 {unavailableCount}칸 · 회피 {avoidCount}칸
        </Badge>
      </div>

      {/* 2. 주간 격자 */}
      <SlotGrid
        attendeeId={selectedId}
        lookup={lookup}
        onCellClick={handleCellClick}
        editingSlot={editingSlot}
      />

      {/* 3. 불가 사유 패널 — 편집 중인 셀이 있을 때만 */}
      {editingSlot && editingCell && (
        <ReasonPicker
          key={`${editingSlot.day}-${editingSlot.startHour}`}
          slot={editingSlot}
          reason={editingCell.reason}
          reasonText={editingCell.reasonText}
          onSelect={handleReason}
          onClose={() => setEditingSlot(null)}
        />
      )}

      <p className={styles.guide}>
        칸을 누르면 가능 → 회피 → 불가 순으로 바뀌어요.
        {editingSlot ? ` 지금 ${formatSlot(editingSlot)} 사유를 고르는 중이에요.` : ''}
      </p>

      {/* 4. 하단 CTA */}
      <div className={styles.cta}>
        <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/result')}>
          추천 결과 보기
        </Button>
      </div>
    </>
  );
}
