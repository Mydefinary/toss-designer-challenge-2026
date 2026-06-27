/** 화면 5 — 운영(이슈 대응) (스텁). 본문 UI 는 트랙 E 가 채운다. */
import { useCurrentCandidate, useIssueLog } from '../store';
import { formatSlot } from '../lib/recommend';

export default function OperateScreen() {
  const current = useCurrentCandidate();
  const issueLog = useIssueLog();
  return (
    <>
      <div className="screen-stub">OperateScreen — 운영(이슈 대응)</div>
      <p className="stub-meta">
        {current ? `현재 순위: ${formatSlot(current.slot)}` : '후보 없음'} · 로그 {issueLog.length}건
      </p>
    </>
  );
}
