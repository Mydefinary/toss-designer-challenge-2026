/** 화면 4 — 확정·공유 (스텁). 본문 UI 는 트랙 D 가 채운다. */
import { useTopCandidate } from '../store';
import { formatSlot } from '../lib/recommend';

export default function ConfirmScreen() {
  const top = useTopCandidate();
  return (
    <>
      <div className="screen-stub">ConfirmScreen — 확정·공유</div>
      <p className="stub-meta">
        {top ? `확정 대상: ${formatSlot(top.slot)}` : '확정할 후보 없음'}
      </p>
    </>
  );
}
