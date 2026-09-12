import { describe, expect, it, vi } from 'vitest';
import type { ImageTextCaller } from './ocr';
import { createReadImageText } from './ocr';

const input = {
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  mimeType: 'image/png',
};

describe('createReadImageText', () => {
  it('SDK가 준 글자를 그대로 돌려준다', async () => {
    const caller: ImageTextCaller = vi.fn(() =>
      Promise.resolve('피롤츠 커피하우스\n서울 용산구 한강대로 56-1, 2층'),
    );
    const read = createReadImageText({ apiKey: 'k', model: 'm', caller });

    await expect(read(input)).resolves.toEqual({
      ok: true,
      text: '피롤츠 커피하우스\n서울 용산구 한강대로 56-1, 2층',
    });
  });

  it('줄바꿈을 보존한다 — 짝짓기 규칙이 줄 순서에 기댄다', async () => {
    const read = createReadImageText({
      apiKey: 'k',
      caller: () => Promise.resolve('가게\n주소'),
    });
    const result = await read(input);

    expect(result.ok && result.text.split('\n')).toEqual(['가게', '주소']);
  });

  it('이미지를 base64로 실어 보낸다', async () => {
    const caller: ImageTextCaller = vi.fn(() => Promise.resolve(''));
    const read = createReadImageText({ apiKey: 'k', model: 'm', caller });

    await read(input);

    expect(caller).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'm',
        mimeType: 'image/png',
        dataBase64: 'iVBORw==',
      }),
    );
  });

  it('키가 없으면 SDK를 만들지도 부르지도 않고 no_api_key', async () => {
    const read = createReadImageText({ apiKey: null });

    await expect(read(input)).resolves.toEqual({
      ok: false,
      error: { kind: 'no_api_key' },
    });
  });
});

describe('createReadImageText — 빈 결과와 실패를 가른다', () => {
  it('글자가 없는 사진은 실패가 아니라 빈 문자열이다', async () => {
    // 재시도해야 할 때와 직접 입력해야 할 때를 화면이 구분할 수 있어야 한다.
    const read = createReadImageText({
      apiKey: 'k',
      caller: () => Promise.resolve(''),
    });

    await expect(read(input)).resolves.toEqual({ ok: true, text: '' });
  });

  it('공백만 온 응답도 빈 결과다', async () => {
    const read = createReadImageText({
      apiKey: 'k',
      caller: () => Promise.resolve('  \n\n  '),
    });

    await expect(read(input)).resolves.toEqual({ ok: true, text: '' });
  });

  it('응답 자체가 없으면 실패다', async () => {
    const read = createReadImageText({
      apiKey: 'k',
      caller: () => Promise.resolve(undefined),
    });
    const result = await read(input);

    expect(!result.ok && result.error.kind).toBe('parse');
  });
});

describe('createReadImageText — 던지는 실패', () => {
  it('timeout과 network를 가른다', async () => {
    const timeoutErr = Object.assign(new Error('t'), { name: 'TimeoutError' });
    const timedOut = createReadImageText({
      apiKey: 'k',
      caller: () => Promise.reject(timeoutErr),
    });
    const failed = createReadImageText({
      apiKey: 'k',
      caller: () => Promise.reject(new Error('boom')),
    });

    const r1 = await timedOut(input);
    const r2 = await failed(input);

    expect(!r1.ok && r1.error.kind).toBe('timeout');
    expect(!r2.ok && r2.error.kind).toBe('network');
  });
});
