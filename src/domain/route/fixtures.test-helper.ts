import type { GenerateJson } from '@/lib/platform/llm';
import type { RouteCandidate, RouteRequest } from '@/shared/routeRequest';
import type { WalkingRouteFn } from './legs';
import type { Leg } from './types';

/**
 * 도메인 테스트 공통 픽스처 — 명세의 성수동 예시.
 *
 * `14:00 출발 → 14:08 편집숍 A(20분) → 14:34 카페 B(40분) → 15:19 서점 C(30분) → 15:49 끝`
 * 구간 시간은 8분 · 6분 · 5분이고 합계는 `총 도보 21분 · 1.6 km`가 나와야 하므로
 * 초 단위 합이 20분을 넘도록(올림) 8:00 · 6:20 · 5:20으로 둔다.
 */

export const START = { lat: 37.5447, lng: 127.0557 };

export const SHOP_A: RouteCandidate = {
  id: 'a',
  name: '편집숍 A',
  category: 'shop',
  coord: { lat: 37.5424, lng: 127.056 },
};
export const CAFE_B: RouteCandidate = {
  id: 'b',
  name: '카페 B',
  category: 'cafe',
  coord: { lat: 37.5448, lng: 127.053 },
};
export const BOOK_C: RouteCandidate = {
  id: 'c',
  name: '서점 C',
  category: 'bookstore',
  coord: { lat: 37.547, lng: 127.05 },
};
export const FOOD_D: RouteCandidate = {
  id: 'd',
  name: '밥집 D',
  category: 'restaurant',
  coord: { lat: 37.5435, lng: 127.0575 },
};
export const DESSERT_E: RouteCandidate = {
  id: 'e',
  name: '디저트 E',
  category: 'dessert',
  coord: { lat: 37.5462, lng: 127.059 },
};
export const PARK_F: RouteCandidate = {
  id: 'f',
  name: '공원 F',
  category: 'walk',
  coord: { lat: 37.5443, lng: 127.033 },
};

export const ALL_SPOTS = [SHOP_A, CAFE_B, BOOK_C, FOOD_D, DESSERT_E, PARK_F];

export const REQUEST_14_16: RouteRequest = {
  window: { start: '2026-09-12T14:00:00+09:00', end: '2026-09-12T16:00:00+09:00' },
  area: { name: '성수동', center: START },
  preferredCategories: ['cafe'],
  requiredSpotIds: [],
};

/** 명세 예시 구간(초). key는 `from>to`. */
export const SPEC_LEG_SECONDS: Readonly<Record<string, number>> = {
  'start>a': 480,
  'a>b': 380,
  'b>c': 320,
};

export function specLegs(): readonly Leg[] {
  return [
    { fromId: 'start', toId: 'a', distanceM: 600, durationS: 480, source: 'tmap', path: [START, SHOP_A.coord] },
    { fromId: 'a', toId: 'b', distanceM: 500, durationS: 380, source: 'tmap', path: [SHOP_A.coord, CAFE_B.coord] },
    { fromId: 'b', toId: 'c', distanceM: 500, durationS: 320, source: 'tmap', path: [CAFE_B.coord, BOOK_C.coord] },
  ];
}

/** 항상 성공하는 실측 스텁. 고정 초를 주면 그 값, 없으면 400초 · 500 m. */
export function stubRoute(seconds: Readonly<Record<string, number>> = {}, calls: string[] = []): WalkingRouteFn {
  return (from, to) => {
    const key = `${String(from.lat)},${String(from.lng)}>${String(to.lat)},${String(to.lng)}`;
    calls.push(key);
    const idFrom = idOf(from);
    const idTo = idOf(to);
    const durationS = seconds[`${idFrom}>${idTo}`] ?? 400;
    return Promise.resolve({
      ok: true,
      data: { distanceM: 500, durationS, path: [from, to] },
    });
  };
}

function idOf(coord: { lat: number; lng: number }): string {
  if (coord.lat === START.lat && coord.lng === START.lng) return 'start';
  return ALL_SPOTS.find((s) => s.coord.lat === coord.lat && s.coord.lng === coord.lng)?.id ?? '?';
}

/** 항상 실패하는 실측 스텁(타임아웃). */
export const failingRoute: WalkingRouteFn = () =>
  Promise.resolve({ ok: false, error: { kind: 'http', error: { kind: 'timeout', message: 't' } } });

/** 고정 JSON을 돌려주는 LLM 스텁. 호출 횟수를 셀 수 있게 배열을 받는다. */
export function stubGenerate(responses: readonly unknown[], calls: string[] = []): GenerateJson {
  let i = 0;
  return (input) => {
    calls.push(input.user);
    const data = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return Promise.resolve({ ok: true, data });
  };
}

export const failingGenerate: GenerateJson = () =>
  Promise.resolve({ ok: false, error: { kind: 'timeout', message: 't' } });
