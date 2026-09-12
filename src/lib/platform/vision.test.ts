import { describe, expect, it, vi } from 'vitest';
import type { VisionCaller } from './vision';
import { createReadSpotsFromImage } from './vision';

const image = {
  bytes: new Uint8Array([1]),
  mimeType: 'image/png',
};

describe('createReadSpotsFromImage', () => {
  it('기본 30초를 기다리고 명시한 제한 시간은 우선한다', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const caller: VisionCaller = () => Promise.resolve('{"spots":[]}');
    const read = createReadSpotsFromImage({ apiKey: 'k', caller });

    await read(image);
    await read({ ...image, timeoutMs: 1_234 });

    expect(timeout).toHaveBeenNthCalledWith(1, 30_000);
    expect(timeout).toHaveBeenNthCalledWith(2, 1_234);
    timeout.mockRestore();
  });
});
