import { describe, expect, it, vi } from 'vitest';
import type { SavedSpot } from '@/shared/spot';
import {
  canonicalSpotAddress,
  parseStoredSpot,
  readStoredSpot,
  readStoredSpots,
  softDeleteStoredSpot,
  toStoredSpotRow,
  writeStoredSpot,
} from './spotStorage';

const OWNER_ID = '5f6d1c2e-0000-4000-8000-000000000001';
const SPOT_ID = '5f6d1c2e-0000-4000-8000-000000000002';
const ROW = {
  id: SPOT_ID,
  owner_id: OWNER_ID,
  name: '피롤츠 커피하우스',
  canonical_address: '서울 용산구 한강대로 56-1',
  road_address: '서울 용산구 한강대로 56-1',
  jibun_address: '서울 용산구 한강로3가 40-999',
  latitude: 37.5299,
  longitude: 126.9648,
  sido: '서울특별시',
  sigugun: '용산구',
  category: 'cafe',
  origin: 'manual',
  deleted_at: null,
  created_at: '2026-09-12T07:00:00Z',
};
const SPOT: SavedSpot = {
  id: SPOT_ID,
  name: ROW.name,
  roadAddress: ROW.road_address,
  jibunAddress: ROW.jibun_address,
  coordinates: { latitude: ROW.latitude, longitude: ROW.longitude },
  region: { sido: ROW.sido, sigugun: ROW.sigugun },
  category: 'cafe',
  origin: 'manual',
};
const { id: _id, ...NEW_SPOT } = SPOT;

describe('Supabase 스팟 행 변환', () => {
  it('외부 행을 공용 SavedSpot 계약으로 좁힌다', () => {
    expect(parseStoredSpot(ROW)).toEqual(SPOT);
    expect(parseStoredSpot({ ...ROW, latitude: '37.5' })).toBeNull();
    expect(parseStoredSpot({ ...ROW, category: 'pub' })).toBeNull();
  });

  it('대표 주소는 도로명을 우선하고 없으면 지번을 쓴다', () => {
    expect(canonicalSpotAddress(NEW_SPOT)).toBe(ROW.road_address);
    expect(canonicalSpotAddress({ ...NEW_SPOT, roadAddress: null })).toBe(
      ROW.jibun_address,
    );
  });

  it('쓰기 행에 ownerId·대표 주소·활성 상태를 넣는다', () => {
    expect(
      toStoredSpotRow(NEW_SPOT, OWNER_ID, '2026-09-12T08:00:00.000Z'),
    ).toMatchObject({
      owner_id: OWNER_ID,
      name: ROW.name,
      canonical_address: ROW.road_address,
      road_address: ROW.road_address,
      jibun_address: ROW.jibun_address,
      saved_at: '2026-09-12T08:00:00.000Z',
      deleted_at: null,
    });
  });
});

describe('브라우저 소유자 범위 저장', () => {
  const ownerId = () => Promise.resolve(OWNER_ID);

  it('목록과 단건 읽기에 현재 브라우저 ownerId를 넘긴다', async () => {
    const selectMany = vi.fn((_owner: string) =>
      Promise.resolve({ ok: true as const, rows: [ROW] }),
    );
    const selectOne = vi.fn((_id: string, _owner: string) =>
      Promise.resolve({ ok: true as const, row: ROW }),
    );

    await expect(
      readStoredSpots({ ownerId, select: selectMany }),
    ).resolves.toEqual({
      ok: true,
      spots: [SPOT],
    });
    await expect(
      readStoredSpot(SPOT_ID, { ownerId, select: selectOne }),
    ).resolves.toEqual({
      ok: true,
      spot: SPOT,
    });
    expect(selectMany).toHaveBeenCalledWith(OWNER_ID);
    expect(selectOne).toHaveBeenCalledWith(SPOT_ID, OWNER_ID);
  });

  it('목록의 깨진 행만 제외하고 나머지는 유지한다', async () => {
    const select = () =>
      Promise.resolve({
        ok: true as const,
        rows: [ROW, { ...ROW, id: 'broken', category: 'pub' }],
      });
    await expect(readStoredSpots({ ownerId, select })).resolves.toEqual({
      ok: true,
      spots: [SPOT],
    });
  });

  it('단건 없음은 null, 깨진 행은 invalid_row로 구분한다', async () => {
    const missing = () => Promise.resolve({ ok: true as const, row: null });
    const invalid = () =>
      Promise.resolve({ ok: true as const, row: { ...ROW, latitude: 'x' } });
    await expect(
      readStoredSpot(SPOT_ID, { ownerId, select: missing }),
    ).resolves.toEqual({ ok: true, spot: null });
    await expect(
      readStoredSpot(SPOT_ID, { ownerId, select: invalid }),
    ).resolves.toEqual({ ok: false, error: { kind: 'invalid_row' } });
  });

  it('같은 상호명·대표 주소는 upsert해 삭제된 기존 id를 복구한다', async () => {
    const upsert = vi.fn(
      (_row: Readonly<Record<string, unknown>>, _unique: string) =>
        Promise.resolve({ ok: true as const, row: ROW }),
    );
    const now = () => new Date('2026-09-12T08:00:00.000Z');
    await expect(
      writeStoredSpot(NEW_SPOT, { ownerId, upsert, now }),
    ).resolves.toEqual({
      ok: true,
      spot: SPOT,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: OWNER_ID,
        saved_at: '2026-09-12T08:00:00.000Z',
        deleted_at: null,
      }),
      'owner_id,name,canonical_address',
    );
  });

  it('저장소 오류와 계약 밖 반환 행을 구분한다', async () => {
    const failed = () =>
      Promise.resolve({
        ok: false as const,
        error: { kind: 'query' as const, message: 'unique target missing' },
      });
    const invalid = () =>
      Promise.resolve({ ok: true as const, row: { ...ROW, origin: 'import' } });
    await expect(
      writeStoredSpot(NEW_SPOT, { ownerId, upsert: failed }),
    ).resolves.toEqual({
      ok: false,
      error: { kind: 'query', message: 'unique target missing' },
    });
    await expect(
      writeStoredSpot(NEW_SPOT, { ownerId, upsert: invalid }),
    ).resolves.toEqual({ ok: false, error: { kind: 'invalid_row' } });
  });

  it('현재 사용자의 활성 행만 시각을 남겨 소프트 삭제한다', async () => {
    const update = vi.fn((_id: string, _owner: string, _deletedAt: string) =>
      Promise.resolve({ ok: true as const, row: ROW }),
    );
    const now = () => new Date('2026-09-12T08:00:00.000Z');
    await expect(
      softDeleteStoredSpot(SPOT_ID, { ownerId, update, now }),
    ).resolves.toEqual({
      ok: true,
      deleted: true,
    });
    expect(update).toHaveBeenCalledWith(
      SPOT_ID,
      OWNER_ID,
      '2026-09-12T08:00:00.000Z',
    );
  });

  it('이미 없거나 삭제된 행은 deleted=false다', async () => {
    const update = () => Promise.resolve({ ok: true as const, row: null });
    await expect(
      softDeleteStoredSpot(SPOT_ID, { ownerId, update }),
    ).resolves.toEqual({ ok: true, deleted: false });
  });

  it('소유자 쿠키를 읽지 못하면 저장소를 호출하지 않고 이유를 보존한다', async () => {
    const select = vi.fn(() =>
      Promise.resolve({ ok: true as const, rows: [ROW] }),
    );
    const brokenOwner = () => Promise.reject(new Error('owner cookie missing'));
    await expect(
      readStoredSpots({ ownerId: brokenOwner, select }),
    ).resolves.toEqual({
      ok: false,
      error: { kind: 'query', message: 'owner cookie missing' },
    });
    expect(select).not.toHaveBeenCalled();
  });
});
