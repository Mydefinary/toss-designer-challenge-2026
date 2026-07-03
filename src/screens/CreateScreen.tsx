/** 화면 1 — 회의 생성. 제목·회의 길이·후보 기간·장소·참석자 입력 후 제약 화면으로 이동. */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig, useAttendees, useMeetingActions } from '../store';
import { Button, Card, Badge } from '../components/ui';
import type { MeetingLocation } from '../types';
import { SegmentToggle, type SegmentOption } from './create/SegmentToggle';
import { AttendeeRow } from './create/AttendeeRow';
import { DurationPicker } from './create/DurationPicker';
import { DateRangeCalendar } from './create/DateRangeCalendar';
import { RoomList } from './create/RoomList';
import styles from './create/CreateScreen.module.css';

const LOCATION_OPTIONS: SegmentOption<MeetingLocation>[] = [
  { value: 'offline', label: '오프라인' },
  { value: 'online', label: '온라인' },
];

export default function CreateScreen() {
  const config = useConfig();
  const attendees = useAttendees();
  const {
    setConfig,
    setDuration,
    setDateRange,
    addRoom,
    removeRoom,
    setAttendeeRole,
    setAttendeeName,
    addAttendee,
    removeAttendee,
  } = useMeetingActions();
  const navigate = useNavigate();

  // 인원 경계 — 최소 2명·최대 12명 (경계에서 버튼 비활성)
  const canRemove = attendees.length > 2;
  const canAdd = attendees.length < 12;

  // 필수/선택 인원 요약 — 참석자 변경 시에만 재계산
  const { requiredCount, optionalCount } = useMemo(() => {
    let required = 0;
    for (const a of attendees) if (a.role === 'required') required += 1;
    return { requiredCount: required, optionalCount: attendees.length - required };
  }, [attendees]);

  const rooms = config.rooms ?? [];

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>회의 만들기</h1>
        <p className={styles.subtitle}>제목과 참석자를 정하면 제약 입력으로 넘어가요.</p>
      </header>

      {/* 1. 회의 제목 */}
      <Card className={styles.section}>
        <label className={styles.fieldLabel} htmlFor="meeting-title">
          회의 제목
        </label>
        <input
          id="meeting-title"
          className={styles.titleInput}
          type="text"
          value={config.title}
          placeholder="예: 4분기 전략 회의"
          onChange={(e) => setConfig({ title: e.target.value })}
        />
      </Card>

      {/* 2. 회의 길이 */}
      <Card className={styles.section}>
        <span className={styles.sectionTitle}>회의 길이</span>
        <DurationPicker value={config.durationMinutes} onChange={setDuration} />
      </Card>

      {/* 3. 후보 기간 — 월 달력에서 범위 선택 */}
      <Card className={styles.section}>
        <span className={styles.sectionTitle}>후보 기간</span>
        <DateRangeCalendar dateRange={config.dateRange} onChange={setDateRange} />
      </Card>

      {/* 4. 온라인/오프라인 토글 + 오프라인이면 회의실 목록 */}
      <Card className={styles.section}>
        <span className={styles.sectionTitle}>회의 장소</span>
        <SegmentToggle
          ariaLabel="회의 장소"
          options={LOCATION_OPTIONS}
          value={config.location}
          onChange={(location: MeetingLocation) => setConfig({ location })}
        />
        {config.location === 'offline' ? (
          <RoomList rooms={rooms} onAdd={addRoom} onRemove={removeRoom} />
        ) : (
          <p className={styles.hint}>장소 무관 · 링크로 진행</p>
        )}
      </Card>

      {/* 5. 참석자 — 이름 편집·역할 토글·추가/삭제 (최소 2·최대 12명) */}
      <Card className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>참석자 {attendees.length}명</span>
          <Badge tone="neutral">
            필수참석 {requiredCount}명 · 선택참석 {optionalCount}명
          </Badge>
        </div>
        <p className={styles.hint}>필수참석: 빠지면 회의 무의미 · 선택참석: 없어도 회의 성립</p>
        <ul className={styles.attendeeList}>
          {attendees.map((a) => (
            <AttendeeRow
              key={a.id}
              attendee={a}
              onRoleChange={setAttendeeRole}
              onNameChange={setAttendeeName}
              onRemove={removeAttendee}
              canRemove={canRemove}
            />
          ))}
        </ul>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={() => addAttendee()}
          disabled={!canAdd}
        >
          + 참석자 추가
        </Button>
        {!canAdd && <p className={styles.hint}>참석자는 최대 12명까지 추가할 수 있어요.</p>}
      </Card>

      {/* 6. 하단 CTA */}
      <div className={styles.cta}>
        <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/constraints')}>
          제약 입력하러 가기
        </Button>
      </div>
    </>
  );
}
