import { describe, expect, it, vi } from 'vitest';
import { formatSeoulHourMinute } from '@/shared/time';
import {
  ALL_SPOTS,
  BOOK_C,
  CAFE_B,
  DESSERT_E,
  FOOD_D,
  REQUEST_14_16,
  SHOP_A,
  SPEC_LEG_SECONDS,
  START,
  failingGenerate,
  failingRoute,
  stubGenerate,
  stubRoute,
} from './fixtures.test-helper';
import {
  matchRequiredSpots,
  planFromRequest,
  planRoute,
  reschedule,
} from './planner';
import type { GeocodeFn } from './startPoint';

const NOW = '2026-09-12T13:07:00+09:00';
const SPEC_INTERPRETATION = {
  window: REQUEST_14_16.window,
  areaName: '성수동',
  preferredCategories: ['cafe'],
  requiredSpotNames: [],
};
const SPEC_PROPOSAL = {
  order: ['a', 'b', 'c'],
  reasons: [
    { id: 'a', reason: '출발점에서 가장 가깝다' },
    { id: 'b', reason: '카페 선호' },
    { id: 'c', reason: '마지막에 조용히' },
  ],
};
const foundGeocode: GeocodeFn = () =>
  Promise.resolve({
    ok: true,
    data: {
      totalCount: 1,
      hits: [
        {
          coord: START,
          roadAddress: '서울특별시 성동구 성수동1가',
          jibunAddress: '',
          region: null,
        },
      ],
    },
  });

describe('planRoute — 명세 예시 해피 패스', () => {
  it('문장 → 14:00 출발 → 14:08 A → 14:44 B → 15:29 C → 15:59 끝, 밥집 D는 시간대 밖', async () => {
    const outcome = await planRoute({
      sentence: '오늘 2시부터 4시까지 성수동에서 카페 들르면서 걷고 싶어',
      now: NOW,
      spots: ALL_SPOTS,
      deps: {
        generate: stubGenerate([SPEC_INTERPRETATION, SPEC_PROPOSAL]),
        geocode: foundGeocode,
        route: stubRoute(SPEC_LEG_SECONDS),
      },
    });

    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const { itinerary } = outcome;
    expect(itinerary.ordering).toBe('llm');
    expect(
      itinerary.stops.map(
        s => `${formatSeoulHourMinute(s.arriveAt)} ${s.candidate.name}`,
      ),
    ).toEqual(['14:08 편집숍 A', '14:44 카페 B', '15:29 서점 C']);
    expect(formatSeoulHourMinute(itinerary.endAt)).toBe('15:59');
    expect(itinerary.stops[0]?.reason).toBe('출발점에서 가장 가깝다');
    expect(itinerary.dropped).toEqual(
      expect.arrayContaining([{ candidate: FOOD_D, reason: 'outside_window' }]),
    );
    expect(outcome.request.area.center).toEqual(START);
  });
});

describe('planRoute — 제안하지 않는 경우(T47)', () => {
  it('시간대가 없으면 needs_clarification이고 이후 단계는 부르지 않는다', async () => {
    const geocode = vi.fn(foundGeocode);
    const outcome = await planRoute({
      sentence: '성수동 걷고 싶어',
      now: NOW,
      spots: ALL_SPOTS,
      deps: {
        generate: stubGenerate([{ ...SPEC_INTERPRETATION, window: null }]),
        geocode,
      },
    });
    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: {
        kind: 'needs_clarification',
        missing: ['window'],
        question: '몇 시부터 몇 시까지요?',
      },
    });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('동네가 좌표로 안 바뀌면 area_not_found', async () => {
    const outcome = await planRoute({
      sentence: 'x',
      now: NOW,
      spots: ALL_SPOTS,
      deps: {
        generate: stubGenerate([
          { ...SPEC_INTERPRETATION, areaName: '없는동' },
        ]),
        geocode: () =>
          Promise.resolve({ ok: true, data: { totalCount: 0, hits: [] } }),
      },
    });
    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: { kind: 'area_not_found', areaName: '없는동' },
    });
  });

  it('그 시간대에 갈 만한 스팟이 없으면 no_candidates, LLM 순서 제안은 부르지 않는다', async () => {
    const calls: string[] = [];
    const outcome = await planRoute({
      sentence: 'x',
      now: NOW,
      // 시간대를 가진 것만. '기타'는 'always'라 새벽에도 후보로 남으므로
      // 전부 넣으면 이 경로가 열리지 않는다.
      spots: [CAFE_B, FOOD_D],
      deps: {
        generate: stubGenerate(
          [
            {
              ...SPEC_INTERPRETATION,
              window: {
                start: '2026-09-13T03:00:00+09:00',
                end: '2026-09-13T05:00:00+09:00',
              },
            },
          ],
          calls,
        ),
        geocode: foundGeocode,
      },
    });
    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: { kind: 'no_candidates', areaName: '성수동' },
    });
    expect(calls).toHaveLength(1); // 해석 1회만
  });

  it('LLM 키가 없으면 service_unavailable(llm)', async () => {
    const outcome = await planRoute({
      sentence: 'x',
      now: NOW,
      spots: ALL_SPOTS,
      deps: {
        generate: () =>
          Promise.resolve({ ok: false, error: { kind: 'no_api_key' } }),
      },
    });
    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: { kind: 'service_unavailable', service: 'llm' },
    });
  });
});

describe('planFromRequest — 외부 서비스 없이', () => {
  it('LLM · TMAP이 전부 실패해도 규칙 기반 + 추정으로 동선이 나온다(T32 · T39)', async () => {
    const outcome = await planFromRequest({
      request: REQUEST_14_16,
      spots: ALL_SPOTS,
      deps: { generate: failingGenerate, route: failingRoute },
    });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(outcome.itinerary.ordering).toBe('rule');
    expect(outcome.itinerary.stops.length).toBeGreaterThan(0);
    expect(outcome.itinerary.stops.every(s => s.reason === null)).toBe(true);
    expect(outcome.itinerary.hasEstimatedLegs).toBe(true);
    expect(outcome.itinerary.overBySeconds).toBe(0);
  });

  it('필수 스팟은 반경 · 시간대 밖이어도 여정에 들어간다', async () => {
    const outcome = await planFromRequest({
      request: { ...REQUEST_14_16, requiredSpotIds: [FOOD_D.id] },
      spots: ALL_SPOTS,
      deps: { generate: failingGenerate, route: stubRoute() },
    });
    if (outcome.kind !== 'ok') throw new Error('expected ok');
    expect(outcome.itinerary.stops.map(s => s.candidate.id)).toContain(
      FOOD_D.id,
    );
  });
});

describe('planFromRequest — 종료 시각 초과(T42)', () => {
  // 30분 예산: A(20) 하나도 이동 포함 빠듯. 네 후보를 전부 제안하면 크게 초과한다.
  const tight = {
    ...REQUEST_14_16,
    window: {
      start: '2026-09-12T14:00:00+09:00',
      end: '2026-09-12T14:40:00+09:00',
    },
  };

  it('LLM에 한 번만 다시 묻고, 그래도 넘으면 비필수를 뒤에서 뺀다', async () => {
    const calls: string[] = [];
    const outcome = await planFromRequest({
      request: { ...tight, requiredSpotIds: [SHOP_A.id] },
      spots: ALL_SPOTS,
      deps: {
        // 1차: 전부, 재질의: 여전히 전부(예산을 못 맞춤)
        generate: stubGenerate(
          [{ order: ['a', 'b', 'c', 'e'], reasons: [] }],
          calls,
        ),
        route: stubRoute({}), // 구간마다 400초
      },
    });
    if (outcome.kind !== 'ok') throw new Error('expected ok');
    expect(calls).toHaveLength(2); // 1차 + 재질의 1회
    expect(calls[1]).toContain('넘었다');
    expect(outcome.itinerary.ordering).toBe('llm');
    expect(outcome.itinerary.stops.map(s => s.candidate.id)).toEqual([
      SHOP_A.id,
    ]);
    expect(
      outcome.itinerary.dropped
        .filter(d => d.reason === 'over_time')
        .map(d => d.candidate.id),
    ).toEqual(['e', 'c', 'b']);
    expect(outcome.itinerary.overBySeconds).toBe(0);
  });

  it('필수만 남았는데도 초과면 빼지 않고 초과를 남긴다', async () => {
    const outcome = await planFromRequest({
      request: { ...tight, requiredSpotIds: [SHOP_A.id, CAFE_B.id, BOOK_C.id] },
      spots: [SHOP_A, CAFE_B, BOOK_C],
      deps: { generate: failingGenerate, route: stubRoute({}) },
    });
    if (outcome.kind !== 'ok') throw new Error('expected ok');
    expect(outcome.itinerary.stops).toHaveLength(3);
    expect(outcome.itinerary.overBySeconds).toBeGreaterThan(0);
  });

  it('재질의가 실패하면 1차 순서를 버리지 않고 제거 규칙만 적용한다', async () => {
    let n = 0;
    const outcome = await planFromRequest({
      request: tight,
      spots: [SHOP_A, CAFE_B, BOOK_C, DESSERT_E],
      deps: {
        generate: input => {
          n += 1;
          return n === 1
            ? Promise.resolve({
                ok: true,
                data: {
                  order: ['a', 'b', 'c', 'e'],
                  reasons: [{ id: 'a', reason: 'r' }],
                },
              })
            : failingGenerate(input);
        },
        route: stubRoute({}),
      },
    });
    if (outcome.kind !== 'ok') throw new Error('expected ok');
    expect(outcome.itinerary.ordering).toBe('llm');
    expect(outcome.itinerary.stops[0]?.reason).toBe('r');
  });
});

describe('reschedule (T45)', () => {
  it('바뀌지 않은 구간은 재실측하지 않고, 순서가 바뀐 정거장의 이유는 지운다', async () => {
    const calls: string[] = [];
    const first = await planFromRequest({
      request: REQUEST_14_16,
      spots: [SHOP_A, CAFE_B, BOOK_C],
      deps: {
        generate: stubGenerate([SPEC_PROPOSAL]),
        route: stubRoute(SPEC_LEG_SECONDS, calls),
      },
    });
    if (first.kind !== 'ok') throw new Error('expected ok');
    calls.length = 0;

    // B를 뺀다: start→A는 그대로, A→C만 새 구간
    const next = await reschedule({
      request: REQUEST_14_16,
      order: [SHOP_A, BOOK_C],
      previousLegs: first.itinerary.legs,
      previousReasons: new Map(
        first.itinerary.stops.map(s => [s.candidate.id, s.reason ?? '']),
      ),
      previousOrderIds: first.itinerary.stops.map(s => s.candidate.id),
      ordering: first.itinerary.ordering,
      deps: { route: stubRoute({}, calls) },
    });
    expect(calls).toHaveLength(1);
    expect(next.stops.map(s => s.candidate.id)).toEqual(['a', 'c']);
    expect(next.stops[0]?.reason).toBe('출발점에서 가장 가깝다'); // 같은 자리 · 같은 직전
    expect(next.stops[1]?.reason).toBeNull(); // 직전이 B에서 A로 바뀜
  });
});

describe('matchRequiredSpots', () => {
  it('공백 · 대소문자 무시, 부분 일치 허용, 못 맞추면 unmatched', () => {
    const { ids, unmatched } = matchRequiredSpots(
      ['카페b', '서점', '없는곳'],
      ALL_SPOTS,
    );
    expect(ids).toEqual([CAFE_B.id, BOOK_C.id]);
    expect(unmatched).toEqual(['없는곳']);
  });
});

describe('생성 결과 회귀 (#165)', () => {
  it('이동을 포함하면 한 곳도 갈 수 없을 때 빈 동선을 성공으로 반환하지 않는다', async () => {
    const outcome = await planFromRequest({
      request: {
        ...REQUEST_14_16,
        window: { ...REQUEST_14_16.window, end: '2026-09-12T14:35:00+09:00' },
      },
      spots: [SHOP_A],
      deps: { generate: failingGenerate, route: stubRoute({ 'start>a': 600 }) },
    });
    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: {
        kind: 'no_candidates',
        dropped: [{ candidate: SHOP_A, reason: 'over_time' }],
      },
    });
  });

  it('재제안에서 시간이 부족해 빠진 장소를 기록한다', async () => {
    const outcome = await planFromRequest({
      request: {
        ...REQUEST_14_16,
        window: { ...REQUEST_14_16.window, end: '2026-09-12T15:00:00+09:00' },
      },
      spots: [SHOP_A, CAFE_B],
      deps: {
        generate: stubGenerate([
          { order: ['a', 'b'], reasons: [] },
          { order: ['a'], reasons: [] },
        ]),
        route: stubRoute(),
      },
    });
    expect(outcome).toMatchObject({
      kind: 'ok',
      itinerary: { dropped: [{ candidate: CAFE_B, reason: 'over_time' }] },
    });
  });

  it.each(['timeout', 'network'] as const)(
    '%s는 사용자의 문장 오류가 아닌 서비스 장애다',
    async kind => {
      const outcome = await planRoute({
        sentence: '성수동에서 걷고 싶어',
        now: NOW,
        spots: ALL_SPOTS,
        deps: {
          generate: () =>
            Promise.resolve({ ok: false, error: { kind, message: 'failure' } }),
        },
      });
      expect(outcome).toMatchObject({
        kind: 'failed',
        failure: { kind: 'service_unavailable', service: 'llm' },
      });
    },
  );

  it.each([401, 429, 503])('HTTP %s는 서비스 장애로 안내한다', async status => {
    const outcome = await planRoute({
      sentence: '성수동에서 걷고 싶어',
      now: NOW,
      spots: ALL_SPOTS,
      deps: {
        generate: () =>
          Promise.resolve({
            ok: false,
            error: { kind: 'status', status, message: 'failure' },
          }),
      },
    });
    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: { kind: 'service_unavailable', service: 'llm' },
    });
  });

  it('잘못된 모델 응답은 서비스 연결 오류와 구분한다', async () => {
    const outcome = await planRoute({
      sentence: '성수동에서 걷고 싶어',
      now: NOW,
      spots: ALL_SPOTS,
      deps: { generate: stubGenerate(['invalid']) },
    });
    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: { kind: 'interpretation_failed' },
    });
  });
});
