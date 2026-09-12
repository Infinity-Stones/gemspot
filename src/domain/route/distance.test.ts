import { describe, expect, it } from 'vitest';
import { distanceTable, estimateWalkSeconds, haversineM } from './distance';
import { BOOK_C, CAFE_B, SHOP_A, START } from './fixtures.test-helper';

describe('haversineM', () => {
  it('같은 점은 0, 성수동 안의 두 점은 수백 m', () => {
    expect(haversineM(START, START)).toBe(0);
    const d = haversineM(START, SHOP_A.coord);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(400);
  });

  it('서울시청 ↔ 서울역은 약 1.9 km', () => {
    const cityHall = { latitude: 37.5665, longitude: 126.978 };
    const station = { latitude: 37.5547, longitude: 126.9707 };
    expect(haversineM(cityHall, station)).toBeCloseTo(1_460, -2);
  });
});

describe('estimateWalkSeconds', () => {
  it('1 km 직선거리는 우회 1.3배 · 1.2 m/s → 약 18분', () => {
    expect(estimateWalkSeconds(1_000)).toBe(1_083);
  });
});

describe('distanceTable', () => {
  const table = distanceTable([
    { id: 'start', coord: START },
    { id: SHOP_A.id, coord: SHOP_A.coord },
    { id: CAFE_B.id, coord: CAFE_B.coord },
    { id: BOOK_C.id, coord: BOOK_C.coord },
  ]);

  it('대칭이고 10 m 단위다', () => {
    expect(table.between('start', 'a')).toBe(table.between('a', 'start'));
    expect(table.between('start', 'a') % 10).toBe(0);
    expect(table.between('a', 'a')).toBe(0);
  });

  it('모르는 id는 던진다 — 조립 실수다', () => {
    expect(() => table.between('start', 'zzz')).toThrow();
  });

  it('LLM용 텍스트 표에 모든 쌍이 한 줄씩', () => {
    const text = table.toText((id) => id.toUpperCase());
    expect(text.split('\n')).toHaveLength(6);
    expect(text).toContain('START ↔ A:');
  });
});
