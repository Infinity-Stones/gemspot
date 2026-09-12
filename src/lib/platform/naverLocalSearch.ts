import { naverSearchClientId, naverSearchClientSecret } from './env';
import type { GetJsonOptions, HttpFailure } from './httpClient';
import { getJson } from './httpClient';

/**
 * 네이버 검색 Local API 어댑터 — 가게 이름으로 업체를 찾는다(T52 #124).
 *
 * **Maps와 다른 서비스다.** 콘솔(developers.naver.com)도 키도 헤더도 다르다 —
 * Maps는 NCP의 `x-ncp-apigw-*`, 여기는 `X-Naver-Client-*`. 한쪽 키를 다른 쪽에
 * 넣으면 401이다.
 *
 * **좌표를 읽지 않는다.** 응답에 `mapx` · `mapy`가 있지만 이 파일은 그것을
 * 파싱하지 않는다. 좌표가 두 곳에서 오면 축척을 잘못 읽었을 때 핀이 조용히
 * 엉뚱한 곳에 찍히고, "좌표는 서버가 Geocoding으로 얻는다"(T22 #31)는 규칙도
 * 깨진다. 이 API는 **이름 → 주소** 변환에만 쓰고, 좌표는 그 주소를 Geocoding에
 * 태워 얻는다.
 */

const LOCAL_SEARCH_ENDPOINT = 'https://openapi.naver.com/v1/search/local.json';

/**
 * 한 번에 받을 건수. 문서상 `display`의 **최댓값이 5**이고 `start`는 최댓값이
 * 1이라 페이지네이션이 아예 없다 — 5건이 이 API가 보여 줄 수 있는 전부다.
 */
export const LOCAL_SEARCH_MAX_DISPLAY = 5;

/** 업체 한 곳. 좌표는 일부러 없다(위 주석). */
export interface LocalPlace {
  /** 상호명. 응답의 `<b>` 태그와 HTML 엔티티를 벗긴 값이다. */
  readonly name: string;
  /** 업체 분류. 예: `카페,디저트>카페`. 없으면 빈 문자열. */
  readonly category: string;
  readonly roadAddress: string;
  readonly jibunAddress: string;
}

export type LocalSearchFailure =
  | { readonly kind: 'no_api_key' }
  | { readonly kind: 'http'; readonly error: HttpFailure };

export type LocalSearchOutcome =
  | { readonly ok: true; readonly places: readonly LocalPlace[] }
  | { readonly ok: false; readonly error: LocalSearchFailure };

export interface LocalSearchOptions extends GetJsonOptions {
  /** 테스트용. 기본은 env의 값. */
  readonly clientId?: string | null;
  readonly clientSecret?: string | null;
  /** 표시할 건수. 1~5로 잘린다. */
  readonly display?: number;
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
};

/**
 * 검색어 강조 태그와 HTML 엔티티를 벗긴다.
 *
 * `title`은 `조선<b>옥</b>`처럼 강조 태그가 섞여 오고 `&amp;` 같은 엔티티도
 * 그대로 온다. 화면이 이 문자열을 그대로 그리므로(React는 텍스트를 이스케이프
 * 한다) 여기서 벗기지 않으면 태그가 글자로 보인다.
 */
export function stripSearchMarkup(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&(#39|amp|lt|gt|quot|apos|nbsp);/g, (_match, name: string) => ENTITIES[name] ?? _match)
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? stripSearchMarkup(value) : '';
}

/**
 * 항목 하나를 계약 모양으로. 이름이 없으면 `null` — 이름 없는 업체는 화면에
 * 고를 거리가 없다. `telephone`은 문서가 "값을 반환하지 않는 요소"라고 못박아
 * 파싱하지 않는다.
 */
export function parseLocalPlace(raw: unknown): LocalPlace | null {
  if (!isRecord(raw)) return null;
  const name = text(raw['title']);
  if (name.length === 0) return null;

  return {
    name,
    category: text(raw['category']),
    roadAddress: text(raw['roadAddress']),
    // 응답의 `address`가 지번 주소다.
    jibunAddress: text(raw['address']),
  };
}

export async function searchLocalPlaces(
  query: string,
  options: LocalSearchOptions = {},
): Promise<LocalSearchOutcome> {
  const {
    clientId = naverSearchClientId(),
    clientSecret = naverSearchClientSecret(),
    display = LOCAL_SEARCH_MAX_DISPLAY,
    ...http
  } = options;
  if (clientId === null || clientSecret === null) return { ok: false, error: { kind: 'no_api_key' } };

  const params = new URLSearchParams({
    query,
    display: String(Math.min(LOCAL_SEARCH_MAX_DISPLAY, Math.max(1, Math.trunc(display)))),
  });
  const result = await getJson<unknown>(`${LOCAL_SEARCH_ENDPOINT}?${params.toString()}`, {
    ...http,
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
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
  const items = body['items'];
  const places = Array.isArray(items)
    ? items.map(parseLocalPlace).filter((place): place is LocalPlace => place !== null)
    : [];
  return { ok: true, places };
}
