/**
 * 공유/클립보드용 요약 텍스트 빌더 — 순수 함수.
 * 각 순위별로 참석/양보/불참을 역할과 함께 상세히 렌더한다. 빈 그룹은 그 줄 자체를 생략.
 */
import type { AttendeeRole, MeetingConfig, RankedCandidate } from '../../types';
import { dayName, formatRange } from '../../lib/recommend';

/** 역할 → 한국어 라벨 */
function roleLabel(role: AttendeeRole): string {
  return role === 'required' ? '필수참석' : '선택참석';
}

/** 한 순위의 시간 표기 — "화요일 14:00–15:00" */
function timeText(candidate: RankedCandidate, config: MeetingConfig): string {
  return `${dayName(candidate.startSlot.day)} ${formatRange(candidate.startSlot, config.durationMinutes)}`;
}

export function buildSummaryText(
  candidates: RankedCandidate[],
  config: MeetingConfig,
  shareUrl: string,
): string {
  const lines: string[] = [`[MEETSYNC] 회의 시간 후보 · ${config.title}`];

  for (const c of candidates) {
    const prefix = c.rank === 1 ? '■ 최적(1순위)' : `■ 예비(${c.rank}순위)`;
    lines.push(`${prefix} ${timeText(c, config)}`);

    if (c.satisfied.length > 0) {
      const parts = c.satisfied.map((a) => `${a.name}(${roleLabel(a.role)})`);
      lines.push(`  참석: ${parts.join(', ')}`);
    }
    if (c.yielding.length > 0) {
      const parts = c.yielding.map(
        (y) => `${y.attendee.name}(${roleLabel(y.attendee.role)}) — ${y.reason}`,
      );
      lines.push(`  양보: ${parts.join(', ')}`);
    }
    if (c.absent.length > 0) {
      const parts = c.absent.map((a) => `${a.name}(${roleLabel(a.role)})`);
      lines.push(`  불참: ${parts.join(', ')}`);
    }
  }

  lines.push(`공유 링크: ${shareUrl}`);
  return lines.join('\n');
}
