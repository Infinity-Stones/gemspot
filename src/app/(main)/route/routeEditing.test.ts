import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RouteModule from '@/domain/route';
import type * as SpotModule from '@/domain/spot';
import type { SpotCoordinates } from '@/shared/spot';
import type { PlanSuccess, RescheduleInput } from '@/domain/route';
import { planFromRequest, resolveArea } from '@/domain/route';
import { loadSpots } from '@/domain/spot';
import {
  BOOK_C,
  CAFE_B,
  REQUEST_14_16,
  SHOP_A,
  START,
  specLegs,
} from '@/domain/route/fixtures.test-helper';
import { schedule } from '@/domain/route/schedule';
import { planFromRequestAction, rescheduleAction } from './actions';

const route = vi.hoisted(() =>
  vi.fn((from: SpotCoordinates, to: SpotCoordinates) =>
    Promise.resolve({
      ok: true as const,
      source: 'osm' as const,
      data: { durationS: 300, distanceM: 400, path: [from, to] },
    }),
  ),
);
vi.mock('@/domain/route', async importOriginal => {
  const actual = await importOriginal<typeof RouteModule>();
  return {
    ...actual,
    resolveArea: vi.fn(),
    planFromRequest: vi.fn(),
    reschedule: (input: RescheduleInput) =>
      actual.reschedule({ ...input, deps: { route } }),
  };
});
vi.mock('@/domain/spot', async importOriginal => ({
  ...(await importOriginal<typeof SpotModule>()),
  loadSpots: vi.fn(),
}));

const candidates = [SHOP_A, CAFE_B, BOOK_C];
const request = { ...REQUEST_14_16, requiredSpotIds: ['b'] };
const first: PlanSuccess = {
  kind: 'ok',
  request,
  unmatchedRequiredNames: ['미등록 장소'],
  itinerary: schedule({
    start: { coord: START, departAt: request.window.start },
    window: request.window,
    order: candidates,
    legs: specLegs(),
    requiredSpotIds: ['b'],
    reasons: new Map([
      ['a', '가깝다'],
      ['c', '이전 카페에서 가깝다'],
    ]),
    dropped: [],
    ordering: 'llm',
  }),
};

function editForm(plan: PlanSuccess, intent: string, spotId: string) {
  const form = new FormData();
  form.set('plan', JSON.stringify(plan));
  form.set('intent', intent);
  form.set('spotId', spotId);
  return form;
}

describe('조건 수정과 동선 편집 서버 액션', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSpots).mockResolvedValue({
      spots: candidates.map(spot => ({
        id: spot.id,
        name: spot.name,
        coordinates: spot.coord,
        category: spot.category,
        roadAddress: '서울 성동구',
        jibunAddress: null,
        region: { sido: '서울특별시', sigugun: '성동구' },
        origin: 'manual',
      })),
      error: null,
    });
  });

  it('시간 제한을 해제한 조건을 다시 제안할 때 null을 유지한다', async () => {
    vi.mocked(resolveArea).mockResolvedValue({
      kind: 'found',
      center: START,
      label: '성수동카페거리',
    });
    vi.mocked(planFromRequest).mockResolvedValue(first);
    const form = new FormData();
    form.set(
      'conditions',
      JSON.stringify({
        window: null,
        areaName: '성수 카페거리',
        preferredCategories: [],
        requiredSpotIds: [],
      }),
    );
    const result = await planFromRequestAction({ status: 'idle' }, form);
    expect(result.status).toBe('done');
    expect(
      vi.mocked(planFromRequest).mock.calls[0]?.[0].request.window,
    ).toBeNull();
  });

  it('시간 없는 동선을 편집해도 시간을 추가하지 않고 변경 없는 OSM 구간은 재사용한다', async () => {
    const flexible: PlanSuccess = {
      ...first,
      request: { ...first.request, window: null },
      itinerary: {
        ...first.itinerary,
        window: null,
        legs: first.itinerary.legs.map(leg => ({ ...leg, source: 'osm' })),
      },
    };
    const result = await rescheduleAction(
      { status: 'idle' },
      editForm(flexible, 'remove', 'b'),
    );
    if (result.status !== 'done' || result.outcome.kind !== 'ok')
      throw new Error('expected success');
    expect(result.outcome.request.window).toBeNull();
    expect(result.outcome.itinerary.window).toBeNull();
    expect(result.outcome.itinerary.overBySeconds).toBe(0);
    expect(route).toHaveBeenCalledTimes(1);
    expect(result.outcome.itinerary.legs[0].source).toBe('osm');
  });

  it('조건 직접 수정은 좌표를 다시 확인하고 구조화된 요청으로 제안한다', async () => {
    vi.mocked(resolveArea).mockResolvedValue({
      kind: 'found',
      center: START,
      label: '성동구 성수동1가',
    });
    vi.mocked(planFromRequest).mockResolvedValue(first);
    const form = new FormData();
    form.set(
      'conditions',
      JSON.stringify({
        window: request.window,
        areaName: '성수동',
        preferredCategories: ['meal'],
        requiredSpotIds: ['b'],
      }),
    );
    await planFromRequestAction({ status: 'idle' }, form);
    expect(resolveArea).toHaveBeenCalledWith('성수동');
    expect(planFromRequest).toHaveBeenCalledWith({
      spots: candidates,
      request: {
        ...request,
        area: { name: '성수동', center: START, label: '성동구 성수동1가' },
        preferredCategories: ['meal'],
      },
    });
  });

  it('필수 장소도 직접 빼고 되돌리며 바뀐 구간만 다시 조회한다', async () => {
    const removed = await rescheduleAction(
      { status: 'idle' },
      editForm(first, 'remove', 'b'),
    );
    if (removed.status !== 'done' || removed.outcome.kind !== 'ok')
      throw new Error('expected success');
    expect(route).toHaveBeenCalledTimes(1);
    expect(route).toHaveBeenCalledWith(SHOP_A.coord, BOOK_C.coord);
    expect(
      removed.outcome.itinerary.stops.map(stop => stop.candidate.id),
    ).toEqual(['a', 'c']);
    expect(removed.outcome.request.requiredSpotIds).toEqual([]);
    expect(removed.outcome.itinerary.stops[1].reason).toBeNull();
    expect(removed.outcome.itinerary.dropped).toEqual([
      {
        candidate: CAFE_B,
        reason: 'user',
        previousIndex: 1,
        wasRequired: true,
      },
    ]);
    expect(removed.outcome.unmatchedRequiredNames).toEqual(['미등록 장소']);
    route.mockClear();
    const restored = await rescheduleAction(
      removed,
      editForm(removed.outcome, 'restore', 'b'),
    );
    if (restored.status !== 'done' || restored.outcome.kind !== 'ok')
      throw new Error('expected success');
    expect(
      restored.outcome.itinerary.stops.map(stop => stop.candidate.id),
    ).toEqual(['a', 'b', 'c']);
    expect(restored.outcome.request.requiredSpotIds).toEqual(['b']);
    expect(restored.outcome.itinerary.dropped).toEqual([]);
    expect(route).toHaveBeenCalledTimes(2);
  });

  it('순서를 바꾸면 해당 구간을 재계산하고 초과하더라도 자동으로 빼지 않는다', async () => {
    const tight = {
      ...first,
      request: {
        ...request,
        window: { ...request.window, end: '2026-09-12T14:40:00+09:00' },
      },
    };
    const moved = await rescheduleAction(
      { status: 'idle' },
      editForm(tight, 'up', 'c'),
    );
    if (moved.status !== 'done' || moved.outcome.kind !== 'ok')
      throw new Error('expected success');
    expect(
      moved.outcome.itinerary.stops.map(stop => stop.candidate.id),
    ).toEqual(['a', 'c', 'b']);
    expect(moved.outcome.itinerary.overBySeconds).toBeGreaterThan(0);
    expect(route).toHaveBeenCalledTimes(2);
  });

  it('저장 목록에 없는 장소와 잘못된 편집은 거절한다', async () => {
    const result = await rescheduleAction(
      { status: 'idle' },
      editForm(first, 'remove', 'unknown'),
    );
    expect(result.status).toBe('invalid');
    expect(route).not.toHaveBeenCalled();
    vi.mocked(loadSpots).mockResolvedValue({ spots: [], error: null });
    const missing = await rescheduleAction(
      { status: 'idle' },
      editForm(first, 'remove', 'b'),
    );
    expect(missing.status).toBe('invalid');
  });
  it('손상된 구간 캐시는 버리고 현재 장소 좌표로 다시 조회한다', async () => {
    const altered = {
      ...first,
      itinerary: {
        ...first.itinerary,
        stops: first.itinerary.stops.map((stop, index) =>
          index === 0
            ? {
                ...stop,
                candidate: {
                  ...stop.candidate,
                  name: '변조된 이름',
                  coord: START,
                },
              }
            : stop,
        ),
        legs: first.itinerary.legs.map(leg => ({ ...leg, durationS: -1 })),
      },
    };
    const result = await rescheduleAction(
      { status: 'idle' },
      editForm(altered, 'remove', 'b'),
    );
    if (result.status !== 'done' || result.outcome.kind !== 'ok')
      throw new Error('expected success');
    expect(result.outcome.itinerary.stops[0].candidate).toEqual(SHOP_A);
    expect(route).toHaveBeenCalledTimes(2);
    expect(route).toHaveBeenCalledWith(START, SHOP_A.coord);
    expect(route).toHaveBeenCalledWith(SHOP_A.coord, BOOK_C.coord);
  });

  it('화면 이후 저장된 좌표가 바뀌면 관련 캐시를 재사용하지 않는다', async () => {
    const saved = await loadSpots();
    const updatedCoord = {
      ...SHOP_A.coord,
      latitude: SHOP_A.coord.latitude + 0.001,
    };
    vi.mocked(loadSpots).mockResolvedValue({
      ...saved,
      spots: saved.spots.map(spot =>
        spot.id === 'a' ? { ...spot, coordinates: updatedCoord } : spot,
      ),
    });
    const result = await rescheduleAction(
      { status: 'idle' },
      editForm(first, 'remove', 'b'),
    );
    if (result.status !== 'done' || result.outcome.kind !== 'ok')
      throw new Error('expected success');
    expect(result.outcome.itinerary.stops[0].candidate.coord).toEqual(
      updatedCoord,
    );
    expect(route).toHaveBeenCalledTimes(2);
    expect(route).toHaveBeenCalledWith(START, updatedCoord);
  });

  it('12시간 초과 조건은 외부 API를 호출하기 전에 거절한다', async () => {
    const form = new FormData();
    form.set(
      'conditions',
      JSON.stringify({
        window: {
          start: '2026-09-13T14:00:00+09:00',
          end: '2026-09-14T14:00:00+09:00',
        },
        areaName: '성수동',
        preferredCategories: [],
        requiredSpotIds: [],
      }),
    );
    expect((await planFromRequestAction({ status: 'idle' }, form)).status).toBe(
      'invalid',
    );
    expect(resolveArea).not.toHaveBeenCalled();
    expect(planFromRequest).not.toHaveBeenCalled();
  });
});
