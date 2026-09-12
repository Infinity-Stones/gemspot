import { describe, expect, it, vi } from 'vitest';
import type { GeminiCaller } from './llm';
import { createGenerateJson } from './llm';

const input = { system: 's', user: 'u', schema: { type: 'object' } };

describe('createGenerateJson', () => {
  it('SDK가 준 텍스트를 JSON으로 파싱해 돌려준다', async () => {
    const caller: GeminiCaller = vi.fn(() => Promise.resolve('{"a":1}'));
    const generate = createGenerateJson({ apiKey: 'k', model: 'm', caller });

    await expect(generate(input)).resolves.toEqual({ ok: true, data: { a: 1 } });
    expect(caller).toHaveBeenCalledWith(expect.objectContaining({ model: 'm', system: 's', user: 'u' }));
  });

  it('키가 없으면 SDK를 만들지도 부르지도 않고 no_api_key', async () => {
    const generate = createGenerateJson({ apiKey: null });
    await expect(generate(input)).resolves.toEqual({ ok: false, error: { kind: 'no_api_key' } });
  });

  it('빈 응답 · JSON 아닌 응답은 parse', async () => {
    const empty = createGenerateJson({ apiKey: 'k', caller: () => Promise.resolve(undefined) });
    const broken = createGenerateJson({ apiKey: 'k', caller: () => Promise.resolve('not json') });
    const r1 = await empty(input);
    const r2 = await broken(input);
    expect(!r1.ok && r1.error.kind).toBe('parse');
    expect(!r2.ok && r2.error.kind).toBe('parse');
  });

  it('SDK가 던지면 timeout과 network를 가른다', async () => {
    const timeoutErr = Object.assign(new Error('t'), { name: 'TimeoutError' });
    const timedOut = createGenerateJson({ apiKey: 'k', caller: () => Promise.reject(timeoutErr) });
    const failed = createGenerateJson({ apiKey: 'k', caller: () => Promise.reject(new Error('boom')) });
    const r1 = await timedOut(input);
    const r2 = await failed(input);
    expect(!r1.ok && r1.error.kind).toBe('timeout');
    expect(!r2.ok && r2.error.kind).toBe('network');
  });
});
