import { describe, it, expect, vi, afterEach } from 'vitest';
import { suggestAlternative } from './alternativeApi';
import type { MeetingConfig, Attendee, ConstraintCell } from '../types';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetch(response: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  } as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

// suggestAlternative 시그니처에 맞춘 샘플 인자 (presetsApi.test.ts 의 config/attendee 형태 재사용)
const sampleConfig: MeetingConfig = {
  title: '주간회의',
  durationMinutes: 60,
  dateRange: { start: '2026-01-05', end: '2026-01-09' },
  location: 'offline',
  rooms: [],
  roomBusy: [],
};

const sampleAttendees: Attendee[] = [{ id: 'a1', name: '민수', role: 'required' }];

const sampleConstraints: ConstraintCell[] = [];

const sampleArgs = {
  config: sampleConfig,
  attendees: sampleAttendees,
  constraints: sampleConstraints,
  durationMinutes: 60 as const,
  dateRange: { start: '2026-01-05', end: '2026-01-09' },
};

describe('alternativeApi', () => {
  it('suggestAlternative 는 POST 로 대체안을 반환한다', async () => {
    const fn = mockFetch({
      suggestions: [{ title: 't', detail: 'd', cost: 'low' }],
      source: 'claude',
    });
    const result = await suggestAlternative(sampleArgs);
    expect(result.source).toBe('claude');
    expect(result.suggestions).toHaveLength(1);
    const [url, init] = fn.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(String(url)).toContain('/api/meetsync/suggest-alternative');
    const body = JSON.parse(init.body as string);
    expect(body.durationMinutes).toBe(60);
    expect(body.dateRange.start).toBe('2026-01-05');
    expect(body.attendees).toHaveLength(1);
    expect(body.config).toBeTruthy();
    expect(Array.isArray(body.constraints)).toBe(true);
  });

  it('suggestAlternative 는 503 응답에서 에러를 던진다', async () => {
    mockFetch({}, false, 503);
    await expect(suggestAlternative(sampleArgs)).rejects.toThrow();
  });
});
