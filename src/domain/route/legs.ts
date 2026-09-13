import type { MeasuredWalkingRouteOutcome } from '@/lib/platform/walkingRoute';
import { walkingRoute as defaultWalkingRoute } from '@/lib/platform/walkingRoute';
import type { SpotCoordinates } from '@/shared/spot';
import type { RouteCandidate } from '@/shared/routeRequest';
import { estimateWalkSeconds, haversineM } from './distance';
import type { Leg } from './types';
import { START_ID } from './types';

/**
 * 구간 실측 — T41(#56). 실측이 실패한 구간만 직선거리로 추정한다.
 *
 * 구간마다 따로 요청한다. OSM 공개 서버의 초당 요청 제한은 어댑터가 담당한다.
 * 같은 (from, to) 쌍은 요청 범위 캐시로 한 번만
 * 부른다 — 다듬기(T45)에서 안 바뀐 구간을 다시 실측하지 않기 위한 것이다.
 */

export type WalkingRouteFn = (
  from: SpotCoordinates,
  to: SpotCoordinates,
) => Promise<MeasuredWalkingRouteOutcome>;

/** 요청 범위 캐시. 전역 상태가 아니라 호출자가 만들어 넘긴다. */
export type LegCache = Map<string, Leg>;

export function legKey(fromId: string, toId: string): string {
  return `${fromId}>${toId}`;
}

export interface MeasureLegsInput {
  readonly start: SpotCoordinates;
  readonly order: readonly RouteCandidate[];
  readonly route?: WalkingRouteFn;
  readonly cache?: LegCache;
}

function estimatedLeg(
  fromId: string,
  from: SpotCoordinates,
  toId: string,
  to: SpotCoordinates,
): Leg {
  const distanceM = Math.round(haversineM(from, to));
  return {
    fromId,
    toId,
    distanceM,
    durationS: estimateWalkSeconds(distanceM),
    source: 'estimate',
    path: [from, to],
  };
}

export async function measureLegs(
  input: MeasureLegsInput,
): Promise<readonly Leg[]> {
  const route = input.route ?? defaultWalkingRoute;
  const cache = input.cache ?? new Map<string, Leg>();

  const pairs = input.order.map((candidate, i) => {
    const prev = i === 0 ? null : input.order[i - 1];
    return {
      fromId: prev === null || prev === undefined ? START_ID : prev.id,
      from: prev === null || prev === undefined ? input.start : prev.coord,
      toId: candidate.id,
      to: candidate.coord,
    };
  });

  return Promise.all(
    pairs.map(async ({ fromId, from, toId, to }) => {
      const key = legKey(fromId, toId);
      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      const outcome = await route(from, to);
      // 키가 없든 네트워크가 끊겼든 사용자에게는 "추정"만 보인다. 실패 종류는
      // 서버 로그의 일이고, 여기서는 동선이 나오는 것이 우선이다.
      const leg: Leg = outcome.ok
        ? {
            fromId,
            toId,
            distanceM: Math.round(outcome.data.distanceM),
            durationS: Math.round(outcome.data.durationS),
            source: outcome.source,
            path: outcome.data.path,
          }
        : estimatedLeg(fromId, from, toId, to);
      cache.set(key, leg);
      return leg;
    }),
  );
}
