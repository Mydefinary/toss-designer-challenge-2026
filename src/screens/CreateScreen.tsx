/** 화면 1 — 회의 생성. 제목·고정정보·장소·참석자 입력 후 제약 화면으로 이동. */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig, useAttendees, useMeetingActions } from '../store';
import { Button, Card, Badge } from '../components/ui';
import type { MeetingLocation } from '../types';
import { SegmentToggle, type SegmentOption } from './create/SegmentToggle';
import { AttendeeRow } from './create/AttendeeRow';
import styles from './create/CreateScreen.module.css';

const LOCATION_OPTIONS: SegmentOption<MeetingLocation>[] = [
  { value: 'offline', label: '오프라인' },
  { value: 'online', label: '온라인' },
];

export default function CreateScreen() {
  const config = useConfig();
  const attendees = useAttendees();
  const { setConfig, setAttendeeRole } = useMeetingActions();
  const navigate = useNavigate();

  // 필수/선택 인원 요약 — 참석자 변경 시에만 재계산
  const { requiredCount, optionalCount } = useMemo(() => {
    let required = 0;
    for (const a of attendees) if (a.role === 'required') required += 1;
    return { requiredCount: required, optionalCount: attendees.length - required };
  }, [attendees]);

  const roomCount = config.rooms?.length ?? 0;

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

      {/* 2·3. 편집 불가 고정 정보 — 회의 길이 / 후보 기간 */}
      <Card className={styles.section}>
        <div className={styles.fixedRow}>
          <div className={styles.fixedText}>
            <span className={styles.fixedLabel}>회의 길이</span>
            <span className={styles.fixedValue}>1시간</span>
          </div>
          <Badge tone="neutral">1시간 고정 · 변경 불가</Badge>
        </div>
        <div className={styles.divider} />
        <div className={styles.fixedRow}>
          <div className={styles.fixedText}>
            <span className={styles.fixedLabel}>후보 기간</span>
            <span className={styles.fixedValue}>다음 주 · 영업일 월~금</span>
          </div>
          <Badge tone="neutral">{config.rangeDays}일 고정</Badge>
        </div>
      </Card>

      {/* 4. 온라인/오프라인 토글 */}
      <Card className={styles.section}>
        <span className={styles.sectionTitle}>회의 장소</span>
        <SegmentToggle
          ariaLabel="회의 장소"
          options={LOCATION_OPTIONS}
          value={config.location}
          onChange={(location: MeetingLocation) => setConfig({ location })}
        />
        <p className={styles.hint}>
          {config.location === 'offline'
            ? roomCount > 0
              ? `회의실 ${roomCount}곳 가용`
              : '지정 회의실 없음'
            : '장소 무관 · 링크로 진행'}
        </p>
      </Card>

      {/* 5. 참석자 6명 — 필수/선택 토글 */}
      <Card className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>참석자 {attendees.length}명</span>
          <Badge tone="neutral">
            필수 {requiredCount}명 · 선택 {optionalCount}명
          </Badge>
        </div>
        <p className={styles.hint}>필수: 빠지면 회의 무의미 · 선택: 없어도 회의 성립</p>
        <ul className={styles.attendeeList}>
          {attendees.map((a) => (
            <AttendeeRow key={a.id} attendee={a} onRoleChange={setAttendeeRole} />
          ))}
        </ul>
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
