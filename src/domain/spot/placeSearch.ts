import type {
  LocalPlace,
  LocalSearchOutcome,
} from '@/lib/platform/kakaoLocalSearch';
import { searchLocalPlaces as defaultSearch } from '@/lib/platform/kakaoLocalSearch';

/**
 * 가게 이름으로 스팟 찾기 — T52(#124).
 *
 * 사용자가 아는 것은 대개 주소가 아니라 가게 이름이다. 카카오 Local API가
 * 이름 → (상호명 · 분류 · 주소)를 주고, 좌표는 그 주소를 Geocoding에 태워
 * 얻는다(T22 #31). 그래서 이 모듈은 좌표를 다루지 않는다.
 */

/** 화면이 고를 수 있는 업체 하나. 주소가 있는 건만 여기 들어온다. */
export interface FoundPlace {
  readonly name: string;
  readonly category: string;
  /** 저장 · 좌표 확인에 쓸 주소. 도로명이 있으면 도로명, 없으면 지번. */
  readonly address: string;
  /** 도로명과 함께 지번도 있으면 보조 표시용. 없으면 null. */
  readonly secondaryAddress: string | null;
}

export type SearchPlacesResult =
  | { readonly kind: 'results'; readonly places: readonly FoundPlace[] }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unavailable'; readonly reason: 'no_api_key' | 'http' };

export type LocalSearchFn = (query: string) => Promise<LocalSearchOutcome>;

export interface SearchPlacesDeps {
  readonly search?: LocalSearchFn;
}

/**
 * 주소가 없는 건은 버린다. 주소가 없으면 Geocoding에 태울 것이 없고, 좌표
 * 없는 스팟은 저장되지 않는다(T22) — 고를 수 없는 후보를 목록에 남기면
 * 사용자는 고른 뒤에야 막힌다.
 */
export function toFoundPlace(place: LocalPlace): FoundPlace | null {
  const primary =
    place.roadAddress.length > 0 ? place.roadAddress : place.jibunAddress;
  if (primary.length === 0) return null;
  const secondary =
    place.roadAddress.length > 0 && place.jibunAddress.length > 0
      ? place.jibunAddress
      : null;
  return {
    name: place.name,
    category: place.category,
    address: primary,
    secondaryAddress: secondary,
  };
}

export async function searchPlaces(
  query: string,
  deps: SearchPlacesDeps = {},
): Promise<SearchPlacesResult> {
  const search = deps.search ?? defaultSearch;
  const outcome = await search(query);
  if (!outcome.ok) {
    return {
      kind: 'unavailable',
      reason: outcome.error.kind === 'no_api_key' ? 'no_api_key' : 'http',
    };
  }
  const places = outcome.places
    .map(toFoundPlace)
    .filter((place): place is FoundPlace => place !== null);
  return places.length === 0
    ? { kind: 'not_found' }
    : { kind: 'results', places };
}
