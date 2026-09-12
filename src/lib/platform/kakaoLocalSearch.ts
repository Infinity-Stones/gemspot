import { kakaoRestApiKey } from './env';
import type { GetJsonOptions, HttpFailure } from './httpClient';
import { getJson } from './httpClient';

/** 카카오 Local 키워드 검색. REST API 키는 서버에서만 사용한다. */
const KEYWORD_SEARCH_ENDPOINT =
  'https://dapi.kakao.com/v2/local/search/keyword.json';
export const PLACE_SEARCH_SIZE = 15;

/** 선택한 주소를 기존 Geocoding·저장 경로로 넘기는 업체 정보. */
export interface LocalPlace {
  readonly name: string;
  readonly category: string;
  readonly roadAddress: string;
  readonly jibunAddress: string;
}

export type LocalSearchOutcome =
  | { readonly ok: true; readonly places: readonly LocalPlace[] }
  | {
      readonly ok: false;
      readonly error:
        | { readonly kind: 'no_api_key' }
        | { readonly kind: 'http'; readonly error: HttpFailure };
    };

export interface LocalSearchOptions extends GetJsonOptions {
  /** 테스트 주입용. 기본값은 서버의 KAKAO_REST_API_KEY. */
  readonly apiKey?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** 카카오는 일반 텍스트를 반환한다. 상호에 포함된 &나 <>도 그대로 보존한다. */
export function parseLocalPlace(raw: unknown): LocalPlace | null {
  if (!isRecord(raw)) return null;
  const name = text(raw['place_name']);
  if (name.length === 0) return null;
  return {
    name,
    category: text(raw['category_name']),
    roadAddress: text(raw['road_address_name']),
    jibunAddress: text(raw['address_name']),
  };
}

export async function searchLocalPlaces(
  query: string,
  options: LocalSearchOptions = {},
): Promise<LocalSearchOutcome> {
  const { apiKey = kakaoRestApiKey(), ...http } = options;
  if (apiKey === null || apiKey.trim().length === 0) {
    return { ok: false, error: { kind: 'no_api_key' } };
  }
  const keyword = query.trim();
  if (keyword.length === 0) return { ok: true, places: [] };

  const params = new URLSearchParams({
    query: keyword,
    size: String(PLACE_SEARCH_SIZE),
    page: '1',
    sort: 'accuracy',
  });
  const result = await getJson<unknown>(
    `${KEYWORD_SEARCH_ENDPOINT}?${params.toString()}`,
    {
      ...http,
      headers: { ...http.headers, Authorization: `KakaoAK ${apiKey.trim()}` },
    },
  );
  if (!result.ok)
    return { ok: false, error: { kind: 'http', error: result.error } };

  // 인증·권한 오류나 잘못된 응답을 검색 결과 0건으로 표시하지 않는다.
  if (!isRecord(result.data) || !Array.isArray(result.data['documents'])) {
    return {
      ok: false,
      error: {
        kind: 'http',
        error: {
          kind: 'parse',
          message: '카카오 장소 검색 응답에 documents 목록이 없습니다.',
        },
      },
    };
  }
  return {
    ok: true,
    places: result.data['documents']
      .map(parseLocalPlace)
      .filter((place): place is LocalPlace => place !== null),
  };
}
