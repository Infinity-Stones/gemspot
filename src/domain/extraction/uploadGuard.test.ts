import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, screenUpload } from './uploadGuard';
import type { UploadCandidate } from './uploadGuard';

function candidate(overrides: Partial<UploadCandidate> = {}): UploadCandidate {
  return {
    name: 'screenshot.png',
    type: 'image/png',
    size: 1_024,
    ...overrides,
  };
}

describe('screenUpload — 형식', () => {
  it('png · jpeg · webp를 통과시킨다', () => {
    for (const [name, type] of [
      ['a.png', 'image/png'],
      ['b.jpg', 'image/jpeg'],
      ['c.webp', 'image/webp'],
    ]) {
      expect(screenUpload(candidate({ name, type }))).toBeNull();
    }
  });

  it('이미지가 아닌 것을 막는다', () => {
    const rejection = screenUpload(
      candidate({ name: 'note.pdf', type: 'application/pdf' }),
    );

    expect(rejection).toEqual({ kind: 'type', name: 'note.pdf' });
  });

  it('HEIC를 막는다 — OCR 제공자가 받지 못하면 통과가 곧 뒤늦은 실패다', () => {
    const rejection = screenUpload(
      candidate({ name: 'IMG_0001.heic', type: 'image/heic' }),
    );

    expect(rejection).toEqual({ kind: 'type', name: 'IMG_0001.heic' });
  });

  it('브라우저가 형식을 모를 때만 확장자로 판단한다', () => {
    expect(screenUpload(candidate({ name: 'shot.PNG', type: '' }))).toBeNull();
  });

  it('형식이 안 맞으면 확장자로 구제하지 않는다', () => {
    // `.png`로 이름만 바꾼 파일이 여기서 통과하면 OCR이 대신 실패한다.
    const rejection = screenUpload(
      candidate({ name: 'movie.png', type: 'video/mp4' }),
    );

    expect(rejection).toEqual({ kind: 'type', name: 'movie.png' });
  });
});

describe('screenUpload — 용량', () => {
  it('상한을 넘으면 막고 크기와 상한을 함께 돌려준다', () => {
    const size = MAX_IMAGE_BYTES + 1;

    const rejection = screenUpload(candidate({ name: 'huge.png', size }));

    expect(rejection).toEqual({
      kind: 'size',
      name: 'huge.png',
      size,
      limit: MAX_IMAGE_BYTES,
    });
  });

  it('상한과 같은 크기는 통과한다', () => {
    expect(screenUpload(candidate({ size: MAX_IMAGE_BYTES }))).toBeNull();
  });
});

describe('screenUpload — 한 장', () => {
  it('형식을 먼저 본다 — 읽을 수 없는 파일이 크기까지 갈 이유가 없다', () => {
    const rejection = screenUpload(
      candidate({
        name: 'huge.pdf',
        type: 'application/pdf',
        size: MAX_IMAGE_BYTES + 1,
      }),
    );

    expect(rejection).toEqual({ kind: 'type', name: 'huge.pdf' });
  });

  it('막을 이유가 없으면 null이다 — 통과한 건을 도메인이 다시 만들지 않는다', () => {
    expect(screenUpload(candidate())).toBeNull();
  });
});
