import { describe, expect, it } from 'vitest';
import { isSpotCategory, isSpotCoordinates } from '@/shared/spot';
import { loadSpots } from './repository';
import { SEED_SPOTS } from './seed';

describe('loadSpots (시드 폴백)', () => {
  it('저장소가 없으니 시드이고, 그 사실을 source로 알린다', async () => {
    const result = await loadSpots();
    expect(result.source).toBe('seed');
    expect(result.spots).toHaveLength(6);
  });

  it('시드 전부가 스팟 계약을 지킨다 — 카테고리는 목록에 있고 좌표는 유한수', () => {
    for (const spot of SEED_SPOTS) {
      expect(isSpotCategory(spot.category)).toBe(true);
      expect(isSpotCoordinates(spot.coordinates)).toBe(true);
      expect(spot.name.length).toBeGreaterThan(0);
    }
  });

  it('id가 겹치지 않는다', () => {
    expect(new Set(SEED_SPOTS.map((s) => s.id)).size).toBe(SEED_SPOTS.length);
  });
});
