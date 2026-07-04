import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listPresets, createPreset, getPreset, deletePreset, type PresetData } from './presetsApi';

// getOwnerToken 이 localStorage 를 읽으므로 고정 토큰을 반환하도록 스텁
beforeEach(() => {
  const store: Record<string, string> = { 'meetsync.ownerToken': 'test-token' };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
});

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

const sampleData: PresetData = {
  config: {
    title: '주간회의',
    durationMinutes: 60,
    dateRange: { start: '2026-01-05', end: '2026-01-09' },
    location: 'offline',
    rooms: [],
    roomBusy: [],
  },
  attendees: [{ id: 'a1', name: '민수', role: 'required' }],
  constraints: [],
};

describe('presetsApi', () => {
  it('listPresets 는 GET 으로 프리셋 배열을 반환한다', async () => {
    const fn = mockFetch({ presets: [{ id: 'p1', name: 'n', createdAt: 'c', updatedAt: 'u' }] });
    const result = await listPresets();
    expect(result).toHaveLength(1);
    expect(fn).toHaveBeenCalled();
    const [url, init] = fn.mock.calls[0]!;
    expect(String(url)).toContain('/api/meetsync/presets?ownerToken=test-token');
    expect(init?.method).toBeUndefined();
  });

  it('createPreset 는 POST 로 프리셋을 저장하고 id 를 반환한다', async () => {
    const fn = mockFetch({ id: 'newid' });
    const result = await createPreset('주간회의', sampleData);
    expect(result).toEqual({ id: 'newid' });
    const [url, init] = fn.mock.calls[0]!;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe('주간회의');
    expect(body.ownerToken).toBe('test-token');
    expect(body.data).toEqual(sampleData);
    expect(String(url).endsWith('/api/meetsync/presets')).toBe(true);
  });

  it('getPreset 는 GET 으로 단건 레코드를 반환한다', async () => {
    const fn = mockFetch({
      id: 'p1',
      name: 'n',
      data: sampleData,
      createdAt: 'c',
      updatedAt: 'u',
    });
    const result = await getPreset('p1');
    const [url] = fn.mock.calls[0]!;
    expect(String(url)).toContain('/api/meetsync/presets/p1');
    expect(result.data).toEqual(sampleData);
  });

  it('deletePreset 는 DELETE 로 삭제하고 빈 본문을 허용한다(json 미호출)', async () => {
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('should not parse');
      },
      text: async () => '',
    } as unknown as Response);
    vi.stubGlobal('fetch', fn);
    await expect(deletePreset('p1')).resolves.toBeUndefined();
    const [url, init] = fn.mock.calls[0]!;
    expect(init.method).toBe('DELETE');
    expect(String(url)).toContain('/api/meetsync/presets/p1?ownerToken=test-token');
  });

  it('deletePreset 는 non-2xx 응답에서 에러를 던진다', async () => {
    const fn = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => '',
    } as unknown as Response);
    vi.stubGlobal('fetch', fn);
    await expect(deletePreset('x')).rejects.toThrow();
  });
});
