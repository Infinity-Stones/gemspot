import type {
  GeocodeFailure,
  GeocodeOutcome,
} from '@/lib/platform/naverGeocoding';
import { geocodeAddress as defaultGeocode } from '@/lib/platform/naverGeocoding';
import type {
  LocalPlace,
  LocalSearchOutcome,
} from '@/lib/platform/kakaoLocalSearch';
import { searchLocalPlaces } from '@/lib/platform/kakaoLocalSearch';
import type { SpotCoordinates } from '@/shared/spot';

export type GeocodeFn = (query: string) => Promise<GeocodeOutcome>;
export type AreaSearchFn = (query: string) => Promise<LocalSearchOutcome>;

export type ResolveAreaResult =
  | {
      readonly kind: 'found';
      readonly center: SpotCoordinates;
      readonly label: string;
    }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'failed'; readonly error: GeocodeFailure };

function placeKey(name: string): string {
  // “성수 카페거리”와 지도에 등록된 “성수동카페거리”는 같은 지역 표현이다.
  return name
    .replace(/\s+/g, '')
    .replace(/동(?=카페거리$)/u, '')
    .toLowerCase();
}

function matchingPlace(
  name: string,
  places: readonly LocalPlace[],
): LocalPlace | undefined {
  const key = placeKey(name);
  // 상호에 “카페거리점”이 들어간 개별 가게를 지역 대표 좌표로 선택하지 않는다.
  return places.find(place => placeKey(place.name) === key);
}

/** 주소 검색 후 장소명 검색으로 거리·공원 등 주소가 아닌 지역 명칭도 찾는다. */
export async function resolveArea(
  name: string,
  geocode: GeocodeFn = defaultGeocode,
  search: AreaSearchFn = searchLocalPlaces,
): Promise<ResolveAreaResult> {
  const query = name.trim();
  if (!query) return { kind: 'not_found' };
  const outcome = await geocode(query);
  const first = outcome.ok ? outcome.data.hits[0] : undefined;
  if (first !== undefined) {
    return {
      kind: 'found',
      center: first.coord,
      label: first.roadAddress || first.jibunAddress || query,
    };
  }

  const results = await search(query);
  if (!results.ok) {
    return {
      kind: 'failed',
      error: outcome.ok ? results.error : outcome.error,
    };
  }
  const place = matchingPlace(query, results.places);
  if (place?.coordinates !== undefined) {
    const address = place.roadAddress || place.jibunAddress;
    return {
      kind: 'found',
      center: place.coordinates,
      label: address ? `${place.name} · ${address}` : place.name,
    };
  }
  return { kind: 'not_found' };
}
