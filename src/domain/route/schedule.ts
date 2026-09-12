import type { GeoPoint } from '@/shared/geo';
import type { RouteCandidate, TimeWindow } from '@/shared/routeRequest';
import { dwellMinutesOf } from '@/shared/spotCategory';
import { addSeconds, diffSeconds } from '@/shared/time';
import type { DroppedSpot, Itinerary, ItineraryStop, Leg, OrderingSource } from './types';

/**
 * 시간 배치 — T34(#49). 체류 + 이동을 쌓아 각 지점의 도착 · 출발 시각을 낸다.
 *
 * 초과해도 **여기서 빼지 않는다.** 무엇을 뺄지는 T42의 규칙(재질의 → 비필수
 * 마지막 제거)이고, 이 함수는 계산만 한다. 종료 지점으로 돌아오는 구간은 두지
 * 않는다 — 명세 예시가 서점에서 끝난다.
 */

export interface ScheduleInput {
  readonly start: { readonly coord: GeoPoint; readonly departAt: string };
  readonly window: TimeWindow;
  readonly order: readonly RouteCandidate[];
  /** `order.length`개. `legs[i]`는 `order[i]`로 가는 구간. */
  readonly legs: readonly Leg[];
  readonly requiredSpotIds: readonly string[];
  readonly reasons?: ReadonlyMap<string, string>;
  readonly dropped?: readonly DroppedSpot[];
  readonly ordering: OrderingSource;
}

export function schedule(input: ScheduleInput): Itinerary {
  if (input.legs.length !== input.order.length) {
    throw new Error(
      `구간 수(${String(input.legs.length)})가 정거장 수(${String(input.order.length)})와 다릅니다`,
    );
  }
  const required = new Set(input.requiredSpotIds);

  const stops: ItineraryStop[] = [];
  let cursor = input.start.departAt;
  let totalWalkSeconds = 0;
  let totalDistanceM = 0;

  input.order.forEach((candidate, i) => {
    const leg = input.legs[i];
    if (leg === undefined) return;
    const dwellMinutes = dwellMinutesOf(candidate.category);
    const arriveAt = addSeconds(cursor, leg.durationS);
    const departAt = addSeconds(arriveAt, dwellMinutes * 60);
    totalWalkSeconds += leg.durationS;
    totalDistanceM += leg.distanceM;
    stops.push({
      candidate,
      arriveAt,
      departAt,
      dwellMinutes,
      required: required.has(candidate.id),
      reason: input.reasons?.get(candidate.id) ?? null,
    });
    cursor = departAt;
  });

  const endAt = cursor;
  return {
    start: input.start,
    window: input.window,
    stops,
    legs: input.legs,
    endAt,
    overBySeconds: Math.max(0, diffSeconds(input.window.end, endAt)),
    totalWalkMinutes: Math.ceil(totalWalkSeconds / 60),
    totalDistanceM: Math.round(totalDistanceM),
    hasEstimatedLegs: input.legs.some((leg) => leg.source === 'estimate'),
    dropped: input.dropped ?? [],
    ordering: input.ordering,
  };
}

/**
 * T42의 제거 규칙 한 걸음: 뒤에서부터 **필수가 아닌 첫 스팟**을 뺀다.
 * 필수만 남았으면 `null` — 그때는 빼지 않고 초과를 남겨 화면이 경고한다.
 */
export function withoutLastOptional(
  order: readonly RouteCandidate[],
  requiredSpotIds: readonly string[],
): { readonly order: readonly RouteCandidate[]; readonly removed: RouteCandidate } | null {
  const required = new Set(requiredSpotIds);
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const candidate = order[i];
    if (candidate !== undefined && !required.has(candidate.id)) {
      return { order: [...order.slice(0, i), ...order.slice(i + 1)], removed: candidate };
    }
  }
  return null;
}
