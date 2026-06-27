/** 화면 2 — 제약 입력 (스텁). 본문 UI 는 트랙 C 가 채운다. */
import { useConstraints, useAttendees } from '../store';

export default function ConstraintsScreen() {
  const constraints = useConstraints();
  const attendees = useAttendees();
  return (
    <>
      <div className="screen-stub">ConstraintsScreen — 제약 입력</div>
      <p className="stub-meta">
        제약 셀 {constraints.length}개 · 참석자 {attendees.length}명
      </p>
    </>
  );
}
