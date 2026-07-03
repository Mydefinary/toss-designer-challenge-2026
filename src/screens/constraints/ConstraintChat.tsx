/**
 * 자연어 채팅 모드 — 문장으로 제약을 입력한다.
 * 메시지 기록은 컴포넌트 로컬 상태(store 아님). 파싱 결과 셀은 store 에 반영.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAttendees, useConfig, useMeetingActions } from '../../store';
import { parseConstraints } from '../../lib/nlParserApi';
import { Button } from '../../components/ui';
import styles from './ConstraintChat.module.css';

type ChatRole = 'user' | 'system';
interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

const GREETING =
  '안녕하세요! 문장으로 제약을 알려주세요. 예를 들어 "민준은 화요일 오후 외근"처럼 적으면 시간표에 반영해 드려요.';

/** 간단 증가 카운터로 고유 id 생성(인덱스 키 충돌 방지) */
function makeIdFactory() {
  let n = 0;
  return () => {
    n += 1;
    return `m${n}`;
  };
}

export function ConstraintChat() {
  const attendees = useAttendees();
  const config = useConfig();
  const { setConstraint } = useMeetingActions();

  const nextId = useRef(makeIdFactory());
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: nextId.current(), role: 'system', text: GREETING },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 현재 참석자 이름으로 만든 예시 5개 — 로컬 파서(nlParser)가 확실히 인식하는 문형.
  // ①특정요일 종일 외근 불가 ②매일 점심직후 회피 ③특정요일 오전 미출근
  // ④매일 17시 이후 회피(퇴근) ⑤특정요일 휴가 불가
  const examples = useMemo(() => {
    const nameAt = (i: number) =>
      attendees.length > 0 ? attendees[i % attendees.length]!.name : '지훈';
    return [
      `${nameAt(0)} 화요일 종일 외근`,
      `${nameAt(1)} 매일 점심 직후 회피`,
      `${nameAt(2)} 월요일 오전 미출근`,
      `${nameAt(3)} 매일 17시 이후 회피`,
      `${nameAt(4)} 금요일 휴가`,
    ];
  }, [attendees]);

  // 새 메시지마다 로그 맨 아래로 스크롤
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function push(role: ChatRole, text: string) {
    setMessages((prev) => [...prev, { id: nextId.current(), role, text }]);
  }

  async function send() {
    const text = draft.trim();
    if (!text || loading) return;

    push('user', text);
    setDraft('');
    setLoading(true);
    const pendingId = nextId.current();
    setMessages((prev) => [...prev, { id: pendingId, role: 'system', text: '입력을 이해하는 중...' }]);

    try {
      const res = await parseConstraints(text, attendees, config);
      for (const cell of res.cells) setConstraint(cell);

      setMessages((prev) => {
        // 로딩 버블을 결과 메시지로 교체
        const replaced = prev.map((m) => (m.id === pendingId ? { ...m, text: res.message } : m));
        if (res.unresolved && res.unresolved.length > 0) {
          return [
            ...replaced,
            {
              id: nextId.current(),
              role: 'system' as ChatRole,
              text: `이 문장은 이해 못했어요: ${res.unresolved.join(', ')}`,
            },
          ];
        }
        return replaced;
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, text: '입력을 처리하지 못했어요. 다시 시도해 주세요.' } : m)),
      );
    } finally {
      setLoading(false);
    }
  }

  function useExample(example: string) {
    setDraft(example);
    inputRef.current?.focus();
  }

  return (
    <div className={styles.chat}>
      <div className={styles.log} ref={logRef} role="log" aria-live="polite">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.bubbleRow} ${m.role === 'user' ? styles.rowUser : styles.rowSystem}`}
          >
            <div className={`${styles.bubble} ${m.role === 'user' ? styles.user : styles.system}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* 예시 프롬프트 칩 */}
      <div className={styles.examples}>
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            className={styles.exampleChip}
            onClick={() => useExample(ex)}
            disabled={loading}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* 입력 행 */}
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={draft}
          placeholder="예) 민준은 화요일 오후 외근"
          aria-label="자연어 제약 입력"
          disabled={loading}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          variant="primary"
          size="md"
          onClick={() => void send()}
          disabled={loading || draft.trim().length === 0}
        >
          보내기
        </Button>
      </div>
    </div>
  );
}
