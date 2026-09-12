import { describe, expect, it } from 'vitest';
import type { SelectAllResult } from '@/lib/platform/supabase';
import { isSpotCategory, isSpotCoordinates } from '@/shared/spot';
import { loadSpots, parseSpotRow } from './repository';
import { SEED_SPOTS } from './seed';

const ROW = {
  id: '5f6d1c2e-0000-4000-8000-000000000001',
  name: '피롤츠 커피하우스',
  road_address: '서울 용산구 한강대로 56-1',
  jibun_address: null,
  latitude: 37.5299,
  longitude: 126.9648,
  sido: '서울특별시',
  sigugun: '용산구',
  category: 'cafe',
  origin: 'ocr',
  created_at: '2026-09-12T05:00:00Z',
};

const reading = (result: SelectAllResult) => () => Promise.resolve(result);

describe('parseSpotRow — snake_case 행 → SavedSpot', () => {
  it('정상 행을 계약 모양으로 옮긴다', () => {
    expect(parseSpotRow(ROW)).toEqual({
      id: ROW.id,
      name: ROW.name,
      roadAddress: ROW.road_address,
      jibunAddress: null,
      coordinates: { latitude: 37.5299, longitude: 126.9648 },
      region: { sido: '서울특별시', sigugun: '용산구' },
      category: 'cafe',
      origin: 'ocr',
    });
  });

  it('좌표가 숫자가 아니거나 카테고리가 목록 밖이면 그 행만 버린다', () => {
    expect(parseSpotRow({ ...ROW, latitude: '37.5' })).toBeNull();
    expect(parseSpotRow({ ...ROW, category: 'pub' })).toBeNull();
    expect(parseSpotRow({ ...ROW, origin: 'import' })).toBeNull();
    expect(parseSpotRow('문자열')).toBeNull();
  });

  it('빈 문자열 주소 · 지역은 null로 접는다', () => {
    const spot = parseSpotRow({ ...ROW, road_address: '', sido: '' });
    expect(spot?.roadAddress).toBeNull();
    expect(spot?.region.sido).toBeNull();
  });
});

describe('loadSpots', () => {
  it('저장소가 설정되지 않았으면 시드, storeError는 null', async () => {
    const result = await loadSpots({ readRows: reading({ ok: false, error: { kind: 'unconfigured' } }) });
    expect(result.source).toBe('seed');
    expect(result.storeError).toBeNull();
    expect(result.spots).toHaveLength(6);
  });

  it('읽기가 실패하면 시드로 떨어지되 이유를 올린다 — 조용히 대체하지 않는다', async () => {
    const result = await loadSpots({
      readRows: reading({ ok: false, error: { kind: 'query', message: 'permission denied' } }),
    });
    expect(result.source).toBe('seed');
    expect(result.storeError).toBe('permission denied');
  });

  it('저장소가 있으면 행을 계약으로 옮기고 깨진 행만 떨어뜨린다', async () => {
    const result = await loadSpots({
      readRows: reading({ ok: true, rows: [ROW, { ...ROW, id: 'x', category: 'pub' }] }),
    });
    expect(result.source).toBe('store');
    expect(result.storeError).toBeNull();
    expect(result.spots.map(s => s.id)).toEqual([ROW.id]);
  });

  it('저장소가 비어 있으면 빈 목록이다 — 시드로 바꿔치지 않는다', async () => {
    const result = await loadSpots({ readRows: reading({ ok: true, rows: [] }) });
    expect(result).toEqual({ spots: [], source: 'store', storeError: null });
  });
});

describe('시드', () => {
  it('전부가 스팟 계약을 지킨다 — 카테고리는 목록에 있고 좌표는 유한수', () => {
    for (const spot of SEED_SPOTS) {
      expect(isSpotCategory(spot.category)).toBe(true);
      expect(isSpotCoordinates(spot.coordinates)).toBe(true);
    }
  });

  it('id가 겹치지 않는다', () => {
    expect(new Set(SEED_SPOTS.map(s => s.id)).size).toBe(SEED_SPOTS.length);
  });
});
