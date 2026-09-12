import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, MAX_IMAGE_COUNT, screenUploads } from './uploadGuard';
import type { UploadCandidate } from './uploadGuard';

function candidate(overrides: Partial<UploadCandidate> = {}): UploadCandidate {
  return {
    name: 'screenshot.png',
    type: 'image/png',
    size: 1_024,
    ...overrides,
  };
}

describe('screenUploads — 형식', () => {
  it('png · jpeg · webp를 통과시킨다', () => {
    const { accepted, rejected } = screenUploads([
      candidate({ name: 'a.png', type: 'image/png' }),
      candidate({ name: 'b.jpg', type: 'image/jpeg' }),
      candidate({ name: 'c.webp', type: 'image/webp' }),
    ]);

    expect(accepted).toHaveLength(3);
    expect(rejected).toHaveLength(0);
  });

  it('이미지가 아닌 것을 막는다', () => {
    const { accepted, rejected } = screenUploads([
      candidate({ name: 'note.pdf', type: 'application/pdf' }),
    ]);

    expect(accepted).toHaveLength(0);
    expect(rejected).toEqual([{ kind: 'type', name: 'note.pdf' }]);
  });

  it('HEIC를 막는다 — OCR 제공자가 받지 못하면 통과가 곧 뒤늦은 실패다', () => {
    const { rejected } = screenUploads([
      candidate({ name: 'IMG_0001.heic', type: 'image/heic' }),
    ]);

    expect(rejected).toEqual([{ kind: 'type', name: 'IMG_0001.heic' }]);
  });

  it('브라우저가 형식을 모를 때만 확장자로 판단한다', () => {
    const { accepted } = screenUploads([
      candidate({ name: 'shot.PNG', type: '' }),
    ]);

    expect(accepted).toHaveLength(1);
  });

  it('형식이 안 맞으면 확장자로 구제하지 않는다', () => {
    // `.png`로 이름만 바꾼 파일이 여기서 통과하면 OCR이 대신 실패한다.
    const { accepted, rejected } = screenUploads([
      candidate({ name: 'movie.png', type: 'video/mp4' }),
    ]);

    expect(accepted).toHaveLength(0);
    expect(rejected).toEqual([{ kind: 'type', name: 'movie.png' }]);
  });
});

describe('screenUploads — 용량', () => {
  it('상한을 넘으면 막고 크기와 상한을 함께 돌려준다', () => {
    const size = MAX_IMAGE_BYTES + 1;
    const { accepted, rejected } = screenUploads([
      candidate({ name: 'huge.png', size }),
    ]);

    expect(accepted).toHaveLength(0);
    expect(rejected).toEqual([
      { kind: 'size', name: 'huge.png', size, limit: MAX_IMAGE_BYTES },
    ]);
  });

  it('상한과 같은 크기는 통과한다', () => {
    const { accepted } = screenUploads([candidate({ size: MAX_IMAGE_BYTES })]);

    expect(accepted).toHaveLength(1);
  });
});

describe('screenUploads — 장수', () => {
  it('상한까지만 받고 나머지를 이유와 함께 막는다', () => {
    const picked = Array.from({ length: MAX_IMAGE_COUNT + 2 }, (_, index) =>
      candidate({ name: `s${String(index)}.png` }),
    );

    const { accepted, rejected } = screenUploads(picked);

    expect(accepted).toHaveLength(MAX_IMAGE_COUNT);
    expect(rejected).toHaveLength(2);
    expect(rejected[0]).toEqual({
      kind: 'count',
      name: `s${String(MAX_IMAGE_COUNT)}.png`,
      limit: MAX_IMAGE_COUNT,
    });
  });

  it('이미 담긴 장수를 합쳐서 센다 — 한 장씩 나눠 고르면 통과하는 상한은 상한이 아니다', () => {
    const { accepted, rejected } = screenUploads(
      [candidate({ name: 'one-more.png' })],
      MAX_IMAGE_COUNT,
    );

    expect(accepted).toHaveLength(0);
    expect(rejected).toEqual([
      { kind: 'count', name: 'one-more.png', limit: MAX_IMAGE_COUNT },
    ]);
  });

  it('형식·용량으로 막힌 건은 장수를 차지하지 않는다', () => {
    // 자리를 차지하면 통과할 수 있었던 뒤쪽 장이 엉뚱하게 상한에 걸린다.
    const { accepted } = screenUploads(
      [
        candidate({ name: 'bad.pdf', type: 'application/pdf' }),
        candidate({ name: 'good.png' }),
      ],
      MAX_IMAGE_COUNT - 1,
    );

    expect(accepted.map(image => image.name)).toEqual(['good.png']);
  });
});

describe('screenUploads — 버리지 않는다', () => {
  it('막은 건의 수와 통과한 건의 수를 합치면 고른 수다', () => {
    const picked = [
      candidate({ name: 'ok.png' }),
      candidate({ name: 'bad.pdf', type: 'application/pdf' }),
      candidate({ name: 'huge.png', size: MAX_IMAGE_BYTES + 1 }),
    ];

    const { accepted, rejected } = screenUploads(picked);

    expect(accepted.length + rejected.length).toBe(picked.length);
  });

  it('통과한 건은 넘긴 객체 그대로다 — 도메인이 모양을 바꾸지 않는다', () => {
    const only = candidate();
    const { accepted } = screenUploads([only]);

    expect(accepted[0]).toBe(only);
  });
});
