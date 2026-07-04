/**
 * 한 순위(1순위·예비 공통)의 상세 그룹 — 참석/양보/불참을 역할 배지와 함께 보여준다.
 * result/RankCard 의 톤을 따르되(AvatarStack + Chip avoid/unavailable) 사람마다 역할 배지를 덧붙인다.
 * 빈 그룹은 헤더까지 통째로 생략한다(모바일 우선, 과밀 방지).
 */
import type { ReactNode } from 'react';
import type { Attendee, RankedCandidate } from '../../types';
import { Badge, AvatarStack, Chip } from '../../components/ui';
import styles from './confirm.module.css';

/** 역할 배지 — 필수참석은 success(강조), 선택참석은 neutral. 전 화면 일관 사용 */
function RoleBadge({ role }: { role: Attendee['role'] }) {
  return role === 'required' ? (
    <Badge tone="success" className={styles.roleBadge}>필수참석</Badge>
  ) : (
    <Badge tone="neutral" className={styles.roleBadge}>선택참석</Badge>
  );
}

/** 그룹 섹션 — 라벨 + 내용. 비어 있으면 호출부에서 렌더하지 않는다 */
function GroupSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.detailGroup}>
      <p className={styles.detailLabel}>{label}</p>
      {children}
    </div>
  );
}

/** 사람 한 줄 — 이름 + 역할 배지 (필수는 시각적으로 강조) */
function PersonRow({ attendee }: { attendee: Attendee }) {
  const emphasized = attendee.role === 'required';
  return (
    <div className={styles.personRow}>
      <span className={emphasized ? styles.personNameRequired : styles.personName}>
        {attendee.name}
      </span>
      <RoleBadge role={attendee.role} />
    </div>
  );
}

export default function RankDetail({ candidate }: { candidate: RankedCandidate }) {
  const { satisfied, yielding, absent } = candidate;

  return (
    <div className={styles.rankDetail}>
      {satisfied.length > 0 && (
        <GroupSection label="참석">
          <AvatarStack
            size="sm"
            items={satisfied.map((a) => ({ name: a.name, avatarColor: a.avatarColor }))}
          />
          <div className={styles.personList}>
            {satisfied.map((a) => (
              <PersonRow key={a.id} attendee={a} />
            ))}
          </div>
        </GroupSection>
      )}

      {yielding.length > 0 && (
        <GroupSection label="양보">
          <div className={styles.detailChips}>
            {yielding.map((y, i) => (
              <div key={`y-${i}`} className={styles.chipWithRole}>
                <Chip tone="avoid" icon="▲">
                  {y.attendee.name}님 {y.reason} 양보
                </Chip>
                <RoleBadge role={y.attendee.role} />
              </div>
            ))}
          </div>
        </GroupSection>
      )}

      {absent.length > 0 && (
        <GroupSection label="불참">
          <div className={styles.detailChips}>
            {absent.map((a, i) => (
              <div key={`a-${i}`} className={styles.chipWithRole}>
                <Chip tone="unavailable" icon="✕">
                  {a.name}님 불참 · 선택참석이라 이번엔 불참
                </Chip>
                <RoleBadge role={a.role} />
              </div>
            ))}
          </div>
        </GroupSection>
      )}
    </div>
  );
}
