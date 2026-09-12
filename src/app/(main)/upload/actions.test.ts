import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractFromImage, MAX_IMAGE_BYTES } from '@/domain/extraction';
import type * as ExtractionModule from '@/domain/extraction';
import { IDLE_EXTRACT_STATE } from './extractState';
import { extractAction } from './actions';

vi.mock('@/domain/extraction', async importOriginal => {
  const actual = await importOriginal<typeof ExtractionModule>();
  return { ...actual, extractFromImage: vi.fn() };
});

const extractFromImageMock = vi.mocked(extractFromImage);

function image(bytes: number): File {
  return new File([new Uint8Array(bytes)], 'screenshot.png', {
    type: 'image/png',
    lastModified: 1_757_289_600_000,
  });
}

function formDataWith(file: File): FormData {
  const formData = new FormData();
  formData.append('image', file);
  return formData;
}

describe('extractAction — 이미지 용량', () => {
  beforeEach(() => {
    extractFromImageMock.mockReset();
    extractFromImageMock.mockResolvedValue({ ok: true, candidates: [] });
  });

  it('10MB 이미지를 추출 단계까지 전달한다', async () => {
    const file = image(MAX_IMAGE_BYTES);

    await expect(
      extractAction(IDLE_EXTRACT_STATE, formDataWith(file)),
    ).resolves.toEqual({ status: 'done', candidates: [] });

    expect(extractFromImageMock).toHaveBeenCalledOnce();
    const call = extractFromImageMock.mock.calls[0];
    if (call === undefined) throw new Error('extractFromImage이 불리지 않았다');
    const [input] = call;
    expect(input.mimeType).toBe('image/png');
    expect(input.imageId).toBe(
      `screenshot.png:${String(MAX_IMAGE_BYTES)}:1757289600000`,
    );
    expect(input.bytes).toBeInstanceOf(Uint8Array);
    expect(input.bytes).toHaveLength(MAX_IMAGE_BYTES);
  });

  it('10MB를 넘는 이미지는 추출 서비스를 부르지 않고 거절한다', async () => {
    const result = await extractAction(
      IDLE_EXTRACT_STATE,
      formDataWith(image(MAX_IMAGE_BYTES + 1)),
    );

    expect(result).toEqual({
      status: 'invalid',
      message: '스크린샷은 장당 최대 10MB까지 올릴 수 있습니다.',
    });
    expect(extractFromImageMock).not.toHaveBeenCalled();
  });
});
