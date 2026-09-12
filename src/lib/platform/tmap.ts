import type { GeoPoint } from '@/shared/geo';
import { isGeoPoint } from '@/shared/geo';
import { tmapAppKey } from './env';
import type { HttpFailure, PostJsonOptions } from './httpClient';
import { postJson } from './httpClient';

/**
 * TMAP 보행자 경로 어댑터 — T40(#55).
 *
 * 네이버 Directions는 자동차 중심이고 카카오는 도보 경로 API가 없어서 도보
 * 실측은 TMAP이다. **구간마다 한 번** 부른다 — `passList`로 한 번에 부르면
 * 합계만 오는데, 우리는 구간별 시간이 필요하고 실패한 구간만 추정으로
 * 떨어뜨려야 한다.
 *
 * 이 파일이 TMAP 응답(GeoJSON, 좌표가 `[lng, lat]` 순)을 아는 유일한 곳이다.
 * 도메인은 `WalkingRoute`만 본다.
 */

const PEDESTRIAN_ENDPOINT = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1';

/** 실측 응답은 GET보다 오래 걸린다. 기본 5초로는 정상 응답도 끊긴다. */
const DEFAULT_TIMEOUT_MS = 8_000;

export interface WalkingRoute {
  readonly distanceM: number;
  readonly durationS: number;
  /** 보행 경로선. `[from, …, to]`. */
  readonly path: readonly GeoPoint[];
}

export type WalkingRouteFailure =
  | { readonly kind: 'no_app_key' }
  | { readonly kind: 'http'; readonly error: HttpFailure };

export type WalkingRouteOutcome =
  | { readonly ok: true; readonly data: WalkingRoute }
  | { readonly ok: false; readonly error: WalkingRouteFailure };

export interface WalkingRouteOptions extends PostJsonOptions {
  /** 테스트용. 기본은 env의 appKey. */
  readonly appKey?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** GeoJSON 좌표 `[lng, lat]` → `GeoPoint`. 순서를 여기서 한 번만 뒤집는다. */
function toGeoPoint(pair: unknown): GeoPoint | null {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const point = { lat: pair[1] as number, lng: pair[0] as number };
  return isGeoPoint(point) ? point : null;
}

/**
 * GeoJSON 응답을 계약 모양으로. 합계는 첫 feature의 properties에, 경로선은
 * LineString feature들을 이어 붙인 것이다.
 */
export function parseWalkingRoute(raw: unknown): WalkingRoute | null {
  if (!isRecord(raw)) return null;
  const { features } = raw;
  if (!Array.isArray(features) || features.length === 0) return null;

  const first = features[0] as unknown;
  const props = isRecord(first) && isRecord(first['properties']) ? first['properties'] : null;
  if (props === null) return null;
  const { totalDistance, totalTime } = props;
  if (typeof totalDistance !== 'number' || typeof totalTime !== 'number') return null;
  if (!Number.isFinite(totalDistance) || !Number.isFinite(totalTime)) return null;

  const path: GeoPoint[] = [];
  for (const feature of features as unknown[]) {
    if (!isRecord(feature)) continue;
    const { geometry } = feature;
    if (!isRecord(geometry)) continue;
    const { type, coordinates } = geometry;
    if (type !== 'LineString' || !Array.isArray(coordinates)) continue;
    for (const pair of coordinates as unknown[]) {
      const point = toGeoPoint(pair);
      if (point === null) continue;
      const last = path.at(-1);
      // 구간 경계에서 끝점과 다음 시작점이 같은 좌표로 겹친다. 하나만 남긴다.
      if (last !== undefined && last.lat === point.lat && last.lng === point.lng) continue;
      path.push(point);
    }
  }
  if (path.length < 2) return null;

  return { distanceM: totalDistance, durationS: totalTime, path };
}

export async function walkingRoute(
  from: GeoPoint,
  to: GeoPoint,
  options: WalkingRouteOptions = {},
): Promise<WalkingRouteOutcome> {
  const { appKey = tmapAppKey(), timeoutMs = DEFAULT_TIMEOUT_MS, ...http } = options;
  if (appKey === null) return { ok: false, error: { kind: 'no_app_key' } };

  const result = await postJson<unknown>(
    PEDESTRIAN_ENDPOINT,
    {
      startX: String(from.lng),
      startY: String(from.lat),
      endX: String(to.lng),
      endY: String(to.lat),
      // 이름은 필수 파라미터고 URL 인코딩된 문자열이어야 한다(없으면 400).
      startName: encodeURIComponent('출발'),
      endName: encodeURIComponent('도착'),
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
    },
    { ...http, timeoutMs, headers: { appKey, ...http.headers } },
  );
  if (!result.ok) return { ok: false, error: { kind: 'http', error: result.error } };

  const route = parseWalkingRoute(result.data);
  if (route === null) {
    return {
      ok: false,
      error: { kind: 'http', error: { kind: 'parse', message: 'TMAP 응답에 경로가 없습니다' } },
    };
  }
  return { ok: true, data: route };
}
