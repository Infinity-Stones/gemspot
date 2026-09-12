import { describe, expect, it, vi } from 'vitest';
import { postJson } from './httpClient';

function respondWith(body: unknown, init?: ResponseInit): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
        ...init,
      }),
    ),
  );
}

describe('postJson', () => {
  it('본문을 JSON으로 직렬화하고 content-type을 붙인다', async () => {
    const fetchImpl = respondWith({ ok: 1 });
    await postJson('https://example.test/x', { a: 1 }, { fetchImpl, headers: { appKey: 'k' } });

    const [, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({
      accept: 'application/json',
      'content-type': 'application/json',
      appKey: 'k',
    });
  });

  it('4xx는 status 실패로 접는다 — getJson과 같은 모양', async () => {
    const result = await postJson('https://example.test/x', {}, {
      fetchImpl: respondWith({}, { status: 400, statusText: 'Bad Request' }),
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: 'status', status: 400, message: '400 Bad Request' },
    });
  });

  it('전송 실패는 network', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    const result = await postJson('https://example.test/x', {}, { fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('network');
  });
});
