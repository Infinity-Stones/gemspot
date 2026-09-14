import type { SpotCoordinates } from '@/shared/spot';
import { isSpotCoordinates } from '@/shared/spot';
import type { WalkingRoute } from '@/shared/walkingRoute';
import { osmRoutingBaseUrl } from './env';
import type { GetJsonOptions, HttpResult } from './httpClient';
import { getJson } from './httpClient';

// URL의 /foot만 바꾸면 자동차 그래프가 그대로 사용된다. 도보 전용 서버가 필수다.
const PUBLIC_FOOT_SERVER = 'https://routing.openstreetmap.de/routed-foot';
const USER_AGENT = 'Gemspot/0.1 (https://github.com/Infinity-Stones/gemspot)';
const TIMEOUT_MS = 8_000;

export interface OsmWalkingOptions extends GetJsonOptions {
  readonly baseUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** 잘못된 중간 좌표를 버려 두 지점을 직선으로 잇지 않고 구간 전체를 거절한다. */
export function parseOsmWalkingRoute(raw: unknown): WalkingRoute | null {
  if (!isRecord(raw) || raw['code'] !== 'Ok' || !Array.isArray(raw['routes']))
    return null;
  const route: unknown = raw['routes'][0];
  if (!isRecord(route)) return null;
  const { distance, duration, geometry } = route;
  if (
    !isNonNegative(distance) ||
    !isNonNegative(duration) ||
    !isRecord(geometry)
  )
    return null;
  if (
    geometry['type'] !== 'LineString' ||
    !Array.isArray(geometry['coordinates'])
  )
    return null;
  const path: SpotCoordinates[] = [];
  for (const pair of geometry['coordinates'] as unknown[]) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const point: unknown = {
      longitude: pair[0] as unknown,
      latitude: pair[1] as unknown,
    };
    if (!isSpotCoordinates(point)) return null;
    path.push(point);
  }
  return path.length < 2
    ? null
    : { distanceM: distance, durationS: duration, path };
}

// 공개 서버 정책은 초당 1회. 요청들을 직렬화하고 대기를 제한한다.
// 여러 서버 인스턴스로 운영할 때는 자체 도보 OSRM 서버를 설정해야 한다.
let nextPublicRequestAt = 0;

export async function osmWalkingRoute(
  from: SpotCoordinates,
  to: SpotCoordinates,
  options: OsmWalkingOptions = {},
): Promise<HttpResult<WalkingRoute>> {
  const { baseUrl = osmRoutingBaseUrl() ?? PUBLIC_FOOT_SERVER, ...http } =
    options;
  let base: URL;
  try {
    base = new URL(baseUrl);
    if (
      !['https:', 'http:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new Error('invalid URL');
    }
  } catch {
    return {
      ok: false,
      error: {
        kind: 'parse',
        message: 'OSM 도보 서버 주소가 올바르지 않습니다',
      },
    };
  }
  if (!isSpotCoordinates(from) || !isSpotCoordinates(to)) {
    return {
      ok: false,
      error: { kind: 'parse', message: '도보 경로 좌표가 올바르지 않습니다' },
    };
  }
  if (base.hostname === 'routing.openstreetmap.de') {
    const now = Date.now();
    const waitMs = Math.max(0, nextPublicRequestAt - now);
    if (waitMs > TIMEOUT_MS) {
      return {
        ok: false,
        error: {
          kind: 'status',
          status: 429,
          message: '도보 경로 요청이 많습니다',
        },
      };
    }
    nextPublicRequestAt = now + waitMs + 1_100;
    if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  const coordinates = `${String(from.longitude)},${String(from.latitude)};${String(to.longitude)},${String(to.latitude)}`;
  const url = `${base.href.replace(/\/$/, '')}/route/v1/foot/${coordinates}?geometries=geojson&overview=full&steps=false&radiuses=100;100`;
  const result = await getJson<unknown>(url, {
    timeoutMs: TIMEOUT_MS,
    ...http,
    headers: { ...http.headers, 'User-Agent': USER_AGENT },
  });
  if (!result.ok) return result;
  const route = parseOsmWalkingRoute(result.data);
  return route === null
    ? {
        ok: false,
        error: { kind: 'parse', message: 'OSM 응답에 도보 경로가 없습니다' },
      }
    : { ok: true, data: route };
}
