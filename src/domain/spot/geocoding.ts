import type { GeocodeResult } from '@/lib/platform/naverGeocoding';
import type { SpotCoordinates, SpotRegion } from '@/shared/spot';

/**
 * 저장 직전까지 검증된 위치 정보 — T20(#29).
 *
 * 네이버 응답의 생김새와 문자열 좌표 변환은 platform 어댑터(T19)가 맡는다.
 * 이 규칙은 어댑터가 돌려준 결과 중 실제 좌표가 있는 첫 건만 저장 가능한
 * 모양으로 좁힌다. 따라서 호출자는 `ready` 분기에서만 저장을 시작할 수 있다.
 */
export interface GeocodedSpotLocation {
  readonly coordinates: SpotCoordinates;
  readonly roadAddress: string;
  readonly jibunAddress: string;
  readonly region: SpotRegion;
}

export type PrepareGeocodedLocationResult =
  | { readonly kind: 'ready'; readonly location: GeocodedSpotLocation }
  | { readonly kind: 'not_found' };

/**
 * Geocoding 결과를 저장 가능한 위치 정보로 확정한다.
 *
 * `totalCount`가 0인 정상 무결과와, 원본 응답에는 건수가 있었지만 T19에서
 * 유효하지 않은 좌표를 모두 버린 경우를 같은 `not_found`로 다룬다. 어느
 * 경우에도 저장 모양인 `location`을 만들지 않는다.
 */
/**
 * 좌표가 있는 후보 **전부**를 저장 가능한 모양으로 — 주소 검색(T51)이 쓴다.
 *
 * 같은 주소가 도로명 · 지번으로 두 번 오면 하나로 접는다. 사용자는 "같은 곳"을
 * 두 줄로 보면 어느 쪽을 골라야 하는지 모른다. 순서는 네이버가 준 순서
 * (coordinate를 줬으면 가까운 순)를 그대로 지킨다.
 */
export function prepareGeocodedLocations(
  result: GeocodeResult,
): readonly GeocodedSpotLocation[] {
  const seen = new Set<string>();
  const locations: GeocodedSpotLocation[] = [];
  for (const hit of result.hits) {
    const key = hit.roadAddress.length > 0 ? hit.roadAddress : hit.jibunAddress;
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    locations.push({
      coordinates: hit.coord,
      roadAddress: hit.roadAddress,
      jibunAddress: hit.jibunAddress,
      region:
        hit.region === null
          ? { sido: null, sigugun: null }
          : { sido: hit.region.sido, sigugun: hit.region.sigugun },
    });
  }
  return locations;
}

export function prepareGeocodedLocation(
  result: GeocodeResult,
): PrepareGeocodedLocationResult {
  const first = result.hits[0];
  if (result.totalCount === 0 || first === undefined)
    return { kind: 'not_found' };

  return {
    kind: 'ready',
    location: {
      coordinates: first.coord,
      roadAddress: first.roadAddress,
      jibunAddress: first.jibunAddress,
      region:
        first.region === null
          ? { sido: null, sigugun: null }
          : { sido: first.region.sido, sigugun: first.region.sigugun },
    },
  };
}
