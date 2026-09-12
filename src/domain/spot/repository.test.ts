import { describe, expect, it, vi } from 'vitest';
import type {
  DeleteStoredSpotResult,
  ReadStoredSpotResult,
  ReadStoredSpotsResult,
  WriteStoredSpotResult,
} from '@/lib/platform/spotStorage';
import type { SavedSpot } from '@/shared/spot';
import { deleteSpot, findSpot, insertSpot, loadSpots } from './repository';

const SPOT: SavedSpot = {
  id: '5f6d1c2e-0000-4000-8000-000000000001',
  name: '피롤츠 커피하우스',
  roadAddress: '서울 용산구 한강대로 56-1',
  jibunAddress: null,
  coordinates: { latitude: 37.5299, longitude: 126.9648 },
  region: { sido: '서울특별시', sigugun: '용산구' },
  category: 'cafe',
  origin: 'ocr',
};

describe('loadSpots', () => {
  it('저장소가 설정되지 않았으면 빈 목록과 오류를 돌려준다', async () => {
    const read = (): Promise<ReadStoredSpotsResult> =>
      Promise.resolve({ ok: false, error: { kind: 'unconfigured' } });
    const result = await loadSpots({ read });
    expect(result).toEqual({
      spots: [],
      error: { kind: 'unconfigured' },
    });
  });

  it('읽기 실패는 빈 목록과 이유를 돌려주고, 성공한 빈 목록과 구분한다', async () => {
    const failed = (): Promise<ReadStoredSpotsResult> =>
      Promise.resolve({
        ok: false,
        error: { kind: 'query', message: 'permission denied' },
      });
    await expect(loadSpots({ read: failed })).resolves.toEqual({
      spots: [],
      error: { kind: 'query', message: 'permission denied' },
    });

    const empty = (): Promise<ReadStoredSpotsResult> =>
      Promise.resolve({ ok: true, spots: [] });
    await expect(loadSpots({ read: empty })).resolves.toEqual({
      spots: [],
      error: null,
    });
  });
});

describe('insertSpot', () => {
  it('도메인 모양을 저장 포트에 그대로 넘긴다', async () => {
    const { id: _id, ...newSpot } = SPOT;
    const write = vi.fn(
      (_spot: typeof newSpot): Promise<WriteStoredSpotResult> =>
        Promise.resolve({ ok: true, spot: SPOT }),
    );
    await expect(insertSpot(newSpot, { write })).resolves.toEqual({
      ok: true,
      spot: SPOT,
    });
    expect(write).toHaveBeenCalledWith(newSpot);
  });
});

describe('findSpot', () => {
  it('저장소 결과를 돌려주고, 설정되지 않았을 때도 시드 ID를 해석하지 않는다', async () => {
    const read = (id: string): Promise<ReadStoredSpotResult> =>
      Promise.resolve({ ok: true, spot: id === SPOT.id ? SPOT : null });
    await expect(findSpot(SPOT.id, { read })).resolves.toEqual(SPOT);

    const unconfigured = (): Promise<ReadStoredSpotResult> =>
      Promise.resolve({ ok: false, error: { kind: 'unconfigured' } });
    await expect(
      findSpot('seed-cafe-b', { read: unconfigured }),
    ).resolves.toBeNull();
  });

  it('저장소에 행이 없거나 읽기 오류면 null이다', async () => {
    const missing = (): Promise<ReadStoredSpotResult> =>
      Promise.resolve({ ok: true, spot: null });
    await expect(findSpot('missing', { read: missing })).resolves.toBeNull();

    const failed = (): Promise<ReadStoredSpotResult> =>
      Promise.resolve({
        ok: false,
        error: { kind: 'query', message: 'permission denied' },
      });
    await expect(findSpot(SPOT.id, { read: failed })).resolves.toBeNull();
  });
});

describe('deleteSpot', () => {
  it('삭제 포트 결과를 그대로 돌려준다', async () => {
    const remove = vi.fn((_id: string): Promise<DeleteStoredSpotResult> =>
      Promise.resolve({ ok: true, deleted: true }),
    );
    await expect(deleteSpot(SPOT.id, { remove })).resolves.toEqual({
      ok: true,
      deleted: true,
    });
    expect(remove).toHaveBeenCalledWith(SPOT.id);
  });
});
