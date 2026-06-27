/** 화면 3 — 추천 결과 (스텁). 본문 UI 는 트랙 D 가 채운다. */
import { useCandidates } from '../store';
import { formatSlot } from '../lib/recommend';

export default function ResultScreen() {
  const candidates = useCandidates();
  const top = candidates[0];
  return (
    <>
      <div className="screen-stub">ResultScreen — 추천 결과</div>
      <p className="stub-meta">
        후보 {candidates.length}개{top ? ` · 1순위 ${formatSlot(top.slot)}` : ''}
      </p>
    </>
  );
}
