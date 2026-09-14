import type { SpotCoordinates } from '@/shared/spot';
import type { WalkingRoute } from '@/shared/walkingRoute';
import { osmWalkingRoute } from './osmWalking';
import type { WalkingRouteFailure } from './tmap';
import { walkingRoute as tmapWalkingRoute } from './tmap';

export type MeasuredWalkingRouteOutcome =
  | {
      readonly ok: true;
      readonly data: WalkingRoute;
      readonly source: 'osm' | 'tmap';
    }
  | { readonly ok: false; readonly error: WalkingRouteFailure };

/** OSM 도보 경로를 우선 쓰고 실패한 구간만 기존 TMAP으로 보완한다. */
export async function walkingRoute(
  from: SpotCoordinates,
  to: SpotCoordinates,
): Promise<MeasuredWalkingRouteOutcome> {
  const osm = await osmWalkingRoute(from, to);
  if (osm.ok) return { ...osm, source: 'osm' };
  const tmap = await tmapWalkingRoute(from, to);
  return tmap.ok ? { ...tmap, source: 'tmap' } : tmap;
}
