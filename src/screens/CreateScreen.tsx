/** 화면 1 — 회의 생성 (스텁). 본문 UI 는 트랙 C 가 채운다. */
import { useConfig, useAttendees } from '../store';

export default function CreateScreen() {
  const config = useConfig();
  const attendees = useAttendees();
  return (
    <>
      <div className="screen-stub">CreateScreen — 회의 생성</div>
      <p className="stub-meta">
        제목: {config.title} · 참석자 {attendees.length}명
      </p>
    </>
  );
}
