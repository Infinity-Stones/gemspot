import { describe, expect, it } from 'vitest';
import { formatSeoulHourMinute } from '@/shared/time';
import { BOOK_C, CAFE_B, REQUEST_14_16, SHOP_A, START, specLegs } from './fixtures.test-helper';
import { schedule, withoutLastOptional } from './schedule';

const base = {
  start: { coord: START, departAt: REQUEST_14_16.window.start },
  window: REQUEST_14_16.window,
  order: [SHOP_A, CAFE_B, BOOK_C],
  legs: specLegs(),
  requiredSpotIds: [] as string[],
  ordering: 'llm' as const,
};

describe('schedule', () => {
  it('명세 예시: 14:00 → 14:08 A(20) → 14:34 B(40) → 15:19 C(30) → 15:49 끝', () => {
    const itinerary = schedule(base);
    const hm = (iso: string) => formatSeoulHourMinute(iso);

    expect(itinerary.stops.map((s) => [hm(s.arriveAt), s.dwellMinutes, hm(s.departAt)])).toEqual([
      ['14:08', 20, '14:28'],
      ['14:34', 40, '15:14'],
      ['15:19', 30, '15:49'],
    ]);
    expect(hm(itinerary.endAt)).toBe('15:49');
    expect(itinerary.overBySeconds).toBe(0);
    expect(itinerary.totalWalkMinutes).toBe(20);
    expect(itinerary.totalDistanceM).toBe(1_600);
    expect(itinerary.hasEstimatedLegs).toBe(false);
  });

  it('종료가 15:30이면 초과(15:49:40 − 15:30 = 1180초)로 나오고 빼지는 않는다', () => {
    const itinerary = schedule({
      ...base,
      window: { ...base.window, end: '2026-09-12T15:30:00+09:00' },
    });
    expect(itinerary.overBySeconds).toBe(1_180);
    expect(itinerary.stops).toHaveLength(3);
  });

  it('이유 · 필수 표시 · 추정 구간 여부를 실어 준다', () => {
    const itinerary = schedule({
      ...base,
      requiredSpotIds: [CAFE_B.id],
      reasons: new Map([[SHOP_A.id, '출발점에서 가장 가깝다']]),
      legs: base.legs.map((leg, i) => (i === 1 ? { ...leg, source: 'estimate' as const } : leg)),
    });
    expect(itinerary.stops[0]?.reason).toBe('출발점에서 가장 가깝다');
    expect(itinerary.stops[1]?.reason).toBeNull();
    expect(itinerary.stops[1]?.required).toBe(true);
    expect(itinerary.hasEstimatedLegs).toBe(true);
  });

  it('빈 순서면 정거장 0, endAt은 출발 시각', () => {
    const itinerary = schedule({ ...base, order: [], legs: [] });
    expect(itinerary.stops).toHaveLength(0);
    expect(itinerary.endAt).toBe(base.start.departAt);
  });

  it('구간 수가 정거장 수와 다르면 던진다', () => {
    expect(() => schedule({ ...base, legs: base.legs.slice(0, 2) })).toThrow();
  });
});

describe('withoutLastOptional', () => {
  it('뒤에서부터 필수가 아닌 첫 스팟을 뺀다', () => {
    const result = withoutLastOptional([SHOP_A, CAFE_B, BOOK_C], [BOOK_C.id]);
    expect(result?.removed).toEqual(CAFE_B);
    expect(result?.order.map((c) => c.id)).toEqual([SHOP_A.id, BOOK_C.id]);
  });

  it('필수만 남았으면 null', () => {
    expect(withoutLastOptional([SHOP_A, BOOK_C], [SHOP_A.id, BOOK_C.id])).toBeNull();
  });
});
