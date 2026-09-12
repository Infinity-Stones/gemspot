import type { SpotCoordinates } from '@/shared/spot';
import { isSpotCoordinates } from '@/shared/spot';
import { NAVER_MAP_CLIENT_ID } from '@/shared/naverMap';
import { naverApiKey } from './env';
import type { GetJsonOptions, HttpFailure } from './httpClient';
import { getJson } from './httpClient';

/**
 * 네이버 클라우드 Geocoding 어댑터 — T19(#28).
 *
 * 주소 문자열을 `query`로 넘기면 `addresses[]`가 온다. 이 파일이 네이버 응답의
 * 생김새(`x` · `y`가 **문자열**로 온다, `meta.totalCount`)를 아는 유일한 곳이다.
 * 도메인은 `GeocodeHit`만 본다.
 */

const GEOCODE_ENDPOINT = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';

export interface GeocodeHit {
  readonly coord: SpotCoordinates;
  readonly roadAddress: string;
  readonly jibunAddress: string;
  readonly region: { readonly sido: string; readonly sigugun: string } | null;
}

export interface GeocodeResult {
  /** 네이버가 말하는 전체 건수. 0이면 "그런 주소가 없다"는 뜻이다. */
  readonly totalCount: number;
  readonly hits: readonly GeocodeHit[];
}

export type GeocodeFailure =
  | { readonly kind: 'no_api_key' }
  | { readonly kind: 'http'; readonly error: HttpFailure };

export type GeocodeOutcome =
  | { readonly ok: true; readonly data: GeocodeResult }
  | { readonly ok: false; readonly error: GeocodeFailure };

export interface GeocodeOptions extends GetJsonOptions {
  /** 테스트용. 기본은 env의 시크릿. */
  readonly apiKey?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function elementOf(elements: unknown, type: string): string | null {
  if (!Array.isArray(elements)) return null;
  for (const el of elements) {
    if (!isRecord(el)) continue;
    const { types, longName } = el;
    if (Array.isArray(types) && (types as unknown[]).includes(type) && typeof longName === 'string') {
      return longName;
    }
  }
  return null;
}

/** 응답 한 건을 계약 모양으로. 좌표가 숫자로 안 바뀌면 그 건은 버린다. */
export function parseGeocodeHit(raw: unknown): GeocodeHit | null {
  if (!isRecord(raw)) return null;
  const { x, y, roadAddress, jibunAddress, addressElements } = raw;
  if (typeof x !== 'string' || typeof y !== 'string') return null;
  const coord = { latitude: Number(y), longitude: Number(x) };
  if (!isSpotCoordinates(coord)) return null;

  const sido = elementOf(addressElements, 'SIDO');
  const sigugun = elementOf(addressElements, 'SIGUGUN');

  return {
    coord,
    roadAddress: typeof roadAddress === 'string' ? roadAddress : '',
    jibunAddress: typeof jibunAddress === 'string' ? jibunAddress : '',
    region: sido !== null && sigugun !== null ? { sido, sigugun } : null,
  };
}

export async function geocodeAddress(
  query: string,
  options: GeocodeOptions = {},
): Promise<GeocodeOutcome> {
  const { apiKey = naverApiKey(), ...http } = options;
  if (apiKey === null) return { ok: false, error: { kind: 'no_api_key' } };

  const url = `${GEOCODE_ENDPOINT}?query=${encodeURIComponent(query)}`;
  const result = await getJson<unknown>(url, {
    ...http,
    headers: {
      'x-ncp-apigw-api-key-id': NAVER_MAP_CLIENT_ID,
      'x-ncp-apigw-api-key': apiKey,
      ...http.headers,
    },
  });
  if (!result.ok) return { ok: false, error: { kind: 'http', error: result.error } };

  const body = result.data;
  if (!isRecord(body)) {
    return {
      ok: false,
      error: { kind: 'http', error: { kind: 'parse', message: '응답이 객체가 아닙니다' } },
    };
  }
  const { meta, addresses } = body;
  const totalCount = isRecord(meta) && typeof meta['totalCount'] === 'number' ? meta['totalCount'] : 0;
  const hits = Array.isArray(addresses)
    ? addresses.map(parseGeocodeHit).filter((h): h is GeocodeHit => h !== null)
    : [];

  return { ok: true, data: { totalCount, hits } };
}
