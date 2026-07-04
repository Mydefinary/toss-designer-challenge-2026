/**
 * (a) 투명성 보드 — 히트맵. 색 + 아이콘(●▲✕)으로 색맹 대비.
 * 축 전환: 열=참석자(가변 인원, 가로에 다 들어감), 행=시간 블럭(09:00–18:00, 세로 스크롤).
 * 요일은 상단 탭으로 하루씩 선택. 참석자 수만큼만 가로를 쓰므로 모바일에서 가로 넘침이 없다.
 * 기본 접힘 — "모두의 상황 보기" 토글로 펼친다.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Attendee, Availability, ConstraintCell, MeetingConfig } from '../../types';
import { useAttendees, useConstraints, useConfig } from '../../store';
import { Avatar } from '../../components/ui';
import { dayName, formatBlock, blockStartLabel, slotKey, isLunchBlock, VALID_BLOCKS } from '../../lib/recommend';
import { STATUS_ICON } from './constants';
import styles from './result.module.css';

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(' ');

const DAYS = [0, 1, 2, 3, 4];

/** 통합 회의실 열의 가상 참석자 id — 선택 셀 판정용 (실제 참석자 아님) */
const ROOM_COL_ID = '__room__';

interface SelectedCell {
  attendeeId: string;
  day: number;
  blockIndex: number;
}

const STATUS_CELL_CLASS: Record<Availability, string | undefined> = {
  available: styles.cellAvailable,
  avoid: styles.cellAvoid,
  unavailable: styles.cellUnavailable,
};

/** 셀 사유 텍스트 */
function reasonOf(cell: ConstraintCell | undefined, status: Availability): string {
  if (status === 'available') return '가능';
  if (status === 'avoid') return cell?.reasonText || '회피';
  return cell?.reason || cell?.reasonText || '불가';
}

interface TransparencyBoardProps {
  /** 주어지면 store 대신 이 참석자 목록을 사용(공유 열람 등 읽기전용 스냅샷용) */
  attendees?: Attendee[];
  /** 주어지면 store 대신 이 제약 목록을 사용 */
  constraints?: ConstraintCell[];
  /** 주어지면 store 대신 이 설정을 사용(location·roomBusy). 없으면 store useConfig() */
  config?: MeetingConfig;
}

export default function TransparencyBoard({
  attendees: attendeesProp,
  constraints: constraintsProp,
  config: configProp,
}: TransparencyBoardProps = {}) {
  // 훅은 조건 없이 항상 호출하고, props 가 주어지면 그 값으로 대체한다.
  const storeAttendees = useAttendees();
  const storeConstraints = useConstraints();
  const storeConfig = useConfig();
  const attendees = attendeesProp ?? storeAttendees;
  const constraints = constraintsProp ?? storeConstraints;
  const config = configProp ?? storeConfig;

  // 오프라인일 때만 통합 회의실 열을 추가. roomBusy 는 기존 시드 호환 방어 접근
  const showRoom = config.location === 'offline';
  const roomBusy = showRoom ? new Set(config.roomBusy ?? []) : null;

  const [expanded, setExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  const cellOf = (attendeeId: string, day: number, blockIndex: number) =>
    constraints.find(
      (c) => c.attendeeId === attendeeId && c.slot.day === day && c.slot.blockIndex === blockIndex,
    );

  /** 단일 셀 버튼 렌더 */
  const renderCell = (
    attendeeId: string,
    name: string,
    day: number,
    blockIndex: number,
  ): ReactNode => {
    const cell = cellOf(attendeeId, day, blockIndex);
    // 점심 블럭은 명시 제약이 없으면 기본 불가(사유 '점심')로 표시
    const lunchAuto = !cell && isLunchBlock(blockIndex);
    const status: Availability = cell?.status ?? (lunchAuto ? 'unavailable' : 'available');
    const reason = lunchAuto ? '점심' : reasonOf(cell, status);
    const isSel =
      selected?.attendeeId === attendeeId &&
      selected.day === day &&
      selected.blockIndex === blockIndex;
    return (
      <button
        key={`${attendeeId}-${day}-${blockIndex}`}
        type="button"
        className={cx(styles.cell, STATUS_CELL_CLASS[status], lunchAuto && styles.cellLunch, isSel && styles.cellSelected)}
        title={`${name} · ${formatBlock({ day, blockIndex })} — ${reason}`}
        aria-label={`${name} ${formatBlock({ day, blockIndex })} ${reason}`}
        onClick={() => setSelected({ attendeeId, day, blockIndex })}
      >
        {STATUS_ICON[status]}
      </button>
    );
  };

  /** 회의실 통합 셀 렌더 — 가용(●)/예약(✕). roomBusy 미포함이면 가용 */
  const renderRoomCell = (day: number, blockIndex: number): ReactNode => {
    const busy = roomBusy!.has(slotKey({ day, blockIndex }));
    const stateLabel = busy ? '예약' : '가용';
    const isSel =
      selected?.attendeeId === ROOM_COL_ID &&
      selected.day === day &&
      selected.blockIndex === blockIndex;
    return (
      <button
        key={`room-${day}-${blockIndex}`}
        type="button"
        className={cx(
          styles.cell,
          busy ? styles.cellUnavailable : styles.cellAvailable,
          isSel && styles.cellSelected,
        )}
        title={`회의실 · ${formatBlock({ day, blockIndex })} — ${stateLabel}`}
        aria-label={`회의실 ${formatBlock({ day, blockIndex })} ${stateLabel}`}
        onClick={() => setSelected({ attendeeId: ROOM_COL_ID, day, blockIndex })}
      >
        {busy ? STATUS_ICON.unavailable : STATUS_ICON.available}
      </button>
    );
  };

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.boardToggle}
        onClick={() => setExpanded(true)}
        aria-expanded={false}
      >
        <span>모두의 상황 보기</span>
        <span className={styles.boardToggleCaret}>펼치기 ▼</span>
      </button>
    );
  }

  return (
    <div className={styles.board}>
      <button
        type="button"
        className={styles.boardToggle}
        onClick={() => setExpanded(false)}
        aria-expanded
      >
        <span>모두의 상황</span>
        <span className={styles.boardToggleCaret}>접기 ▲</span>
      </button>

      <p className={styles.sectionHint}>
        나만 불편하면 양보가 쉬워집니다 — 서로의 상황이 보이면 자연스럽게 시간이 맞춰져요.
      </p>

      {/* 요일 탭 (모바일) */}
      <div className={styles.dayTabs} role="tablist" aria-label="요일 선택">
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={selectedDay === d}
            className={cx(styles.dayTab, selectedDay === d && styles.dayTabActive)}
            onClick={() => setSelectedDay(d)}
          >
            {dayName(d).charAt(0)}
          </button>
        ))}
      </div>

      {/* 축 전환 격자 — 열=참석자, 행=시간블럭. 세로 스크롤, 가로는 참석자 수만큼만 */}
      <div className={styles.axisScroll}>
        <div
          className={styles.axisGrid}
          style={{
            gridTemplateColumns: `52px repeat(${attendees.length + (showRoom ? 1 : 0)}, minmax(0, 1fr))`,
          }}
        >
          {/* 헤더행 — 좌상단 코너(요일) + 참석자 열 헤더(아바타·이름) + (오프라인) 회의실 열 */}
          <span className={styles.axisCorner} title={dayName(selectedDay)}>
            {dayName(selectedDay).charAt(0)}
          </span>
          {attendees.map((a) => (
            <span key={`ch-${a.id}`} className={styles.axisColHead} title={`${a.name} · ${a.role === 'required' ? '필수참석' : '선택참석'}`}>
              <Avatar name={a.name} avatarColor={a.avatarColor} size="sm" />
              <span className={styles.axisColName}>{a.name}</span>
            </span>
          ))}
          {showRoom && (
            <span className={styles.axisColHead} title="회의실 (통합 · 하나라도 비면 가용)">
              <span className={styles.roomHeadIcon} aria-hidden="true">🔒</span>
              <span className={styles.axisColName}>회의실</span>
            </span>
          )}
          {/* 각 시간 블럭 행 — 행 헤더(시작시각) + 참석자별 셀 + (오프라인) 회의실 셀 */}
          {VALID_BLOCKS.map((b) => (
            <Row key={`row-${b}`}>
              <span className={styles.axisRowHead}>{blockStartLabel(b)}</span>
              {attendees.map((a) => renderCell(a.id, a.name, selectedDay, b))}
              {showRoom && renderRoomCell(selectedDay, b)}
            </Row>
          ))}
        </div>
      </div>

      {selected && (
        <p className={styles.cellReason} role="status">
          {(() => {
            // 회의실 열 셀 — 가용/예약 표시
            if (selected.attendeeId === ROOM_COL_ID && roomBusy) {
              const busy = roomBusy.has(slotKey({ day: selected.day, blockIndex: selected.blockIndex }));
              return `회의실 · ${formatBlock({
                day: selected.day,
                blockIndex: selected.blockIndex,
              })} — ${busy ? '예약' : '가용'}`;
            }
            const a = attendees.find((x) => x.id === selected.attendeeId);
            const cell = cellOf(selected.attendeeId, selected.day, selected.blockIndex);
            const lunchAuto = !cell && isLunchBlock(selected.blockIndex);
            const status: Availability = cell?.status ?? (lunchAuto ? 'unavailable' : 'available');
            return `${a?.name ?? ''} · ${formatBlock({
              day: selected.day,
              blockIndex: selected.blockIndex,
            })} — ${lunchAuto ? '점심' : reasonOf(cell, status)}`;
          })()}
        </p>
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem}>{STATUS_ICON.available} 가능</span>
        <span className={styles.legendItem}>{STATUS_ICON.avoid} 회피</span>
        <span className={styles.legendItem}>{STATUS_ICON.unavailable} 불가</span>
        {showRoom && (
          <>
            <span className={styles.legendItem}>{STATUS_ICON.available} 회의실 가용</span>
            <span className={styles.legendItem}>{STATUS_ICON.unavailable} 회의실 예약</span>
          </>
        )}
      </div>
    </div>
  );
}

/** CSS grid 의 직접 자식이 되도록 Fragment 로 묶지 않고 펼치기 위한 헬퍼 */
function Row({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
