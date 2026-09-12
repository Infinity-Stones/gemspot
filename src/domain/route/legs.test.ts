import { describe, expect, it } from 'vitest';
import { BOOK_C, CAFE_B, SHOP_A, START, failingRoute, stubRoute } from './fixtures.test-helper';
import { legKey, measureLegs } from './legs';

describe('measureLegs', () => {
  it('구간마다 실측하고 start→1, 1→2 순으로 돌려준다', async () => {
    const legs = await measureLegs({
      start: START,
      order: [SHOP_A, CAFE_B, BOOK_C],
      route: stubRoute({ 'start>a': 480, 'a>b': 380, 'b>c': 320 }),
    });
    expect(legs.map((l) => [l.fromId, l.toId, l.durationS, l.source])).toEqual([
      ['start', 'a', 480, 'tmap'],
      ['a', 'b', 380, 'tmap'],
      ['b', 'c', 320, 'tmap'],
    ]);
  });

  it('실패한 구간만 직선거리 추정으로, path는 두 점', async () => {
    let n = 0;
    const flaky: typeof failingRoute = (from, to) => {
      n += 1;
      return n === 2 ? failingRoute(from, to) : stubRoute()(from, to);
    };
    const legs = await measureLegs({ start: START, order: [SHOP_A, CAFE_B, BOOK_C], route: flaky });
    expect(legs.map((l) => l.source)).toEqual(['tmap', 'estimate', 'tmap']);
    expect(legs[1]?.path).toEqual([SHOP_A.coord, CAFE_B.coord]);
    expect(legs[1]?.durationS).toBeGreaterThan(0);
  });

  it('캐시에 있는 쌍은 다시 부르지 않는다', async () => {
    const calls: string[] = [];
    const cache = new Map();
    await measureLegs({ start: START, order: [SHOP_A, CAFE_B], route: stubRoute({}, calls), cache });
    expect(calls).toHaveLength(2);
    // B를 빼고 A→C로 바꾸면 start→A는 캐시, A→C만 새로
    await measureLegs({ start: START, order: [SHOP_A, BOOK_C], route: stubRoute({}, calls), cache });
    expect(calls).toHaveLength(3);
    expect(cache.has(legKey('start', 'a'))).toBe(true);
  });

  it('빈 순서는 빈 배열', async () => {
    expect(await measureLegs({ start: START, order: [], route: failingRoute })).toEqual([]);
  });
});
