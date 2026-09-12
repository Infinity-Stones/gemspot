import type { GeocodeOutcome } from '@/lib/platform/naverGeocoding';
import { geocodeAddress as defaultGeocode } from '@/lib/platform/naverGeocoding';
import type { SavedSpot, SpotAddressOrigin, SpotCategory } from '@/shared/spot';
import type { GeocodedSpotLocation } from './geocoding';
import { prepareGeocodedLocation, prepareGeocodedLocations } from './geocoding';
import type { InsertSpotOptions } from './repository';
import { insertSpot } from './repository';

/**
 * 스팟 저장 유스케이스 — T51(#108). T22(#31)의 규칙이 여기 있다:
 * **좌표가 나오지 않으면 저장하지 않는다.**
 *
 * 좌표 없는 스팟이 들어가면 지도(M5 · M6)와 동선(M7)이 전부 그 구멍을 따로
 * 방어해야 한다. 그래서 저장 함수가 주소 문자열을 받아 스스로 Geocoding을
 * 돌리고, `ready`가 아니면 `insertSpot`에 닿지 못하게 한다 — 좌표를 클라이언트가
 * 보내 주는 모양이면 검증을 건너뛰는 경로가 생긴다.
 *
 * `locateAddress`는 같은 앞부분만 돈다. 화면이 저장 전에 핀 미리보기를 보여
 * 주기 위한 것이고, 저장은 다시 `saveSpot`을 부른다 — 미리보기와 저장 사이에
 * 좌표가 달라질 일은 없지만, 달라지더라도 저장된 값이 진실이다.
 */

export type GeocodeFn = (address: string, options?: { readonly count?: number }) => Promise<GeocodeOutcome>;

/** 후보 목록 크기. 화면에서 고를 수 있는 만큼만 — 열 줄이 넘으면 검색어를 더 적는 게 빠르다. */
export const ADDRESS_SEARCH_COUNT = 10;

export type SearchAddressResult =
  | { readonly kind: 'results'; readonly candidates: readonly GeocodedSpotLocation[] }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unavailable'; readonly reason: 'no_api_key' | 'http' };

/**
 * 주소 검색 — 네이버 Maps Geocoding("주소 검색")으로 후보를 여러 건 받아 사용자가
 * 고르게 한다. 첫 건만 쓰는 locateAddress와 달리, 동 이름이나 건물명처럼 여러
 * 곳에 걸치는 검색어에서 엉뚱한 첫 건이 저장되는 것을 막는다.
 */
export async function searchAddress(query: string, deps: LocateDeps = {}): Promise<SearchAddressResult> {
  const geocode = deps.geocode ?? defaultGeocode;
  const outcome = await geocode(query, { count: ADDRESS_SEARCH_COUNT });
  if (!outcome.ok) {
    return { kind: 'unavailable', reason: outcome.error.kind === 'no_api_key' ? 'no_api_key' : 'http' };
  }
  const candidates = prepareGeocodedLocations(outcome.data);
  return candidates.length === 0 ? { kind: 'not_found' } : { kind: 'results', candidates };
}

export type LocateAddressResult =
  | { readonly kind: 'ready'; readonly location: GeocodedSpotLocation }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unavailable'; readonly reason: 'no_api_key' | 'http' };

export interface LocateDeps {
  readonly geocode?: GeocodeFn;
}

export async function locateAddress(address: string, deps: LocateDeps = {}): Promise<LocateAddressResult> {
  const geocode = deps.geocode ?? defaultGeocode;
  const outcome = await geocode(address);
  if (!outcome.ok) {
    return { kind: 'unavailable', reason: outcome.error.kind === 'no_api_key' ? 'no_api_key' : 'http' };
  }
  const prepared = prepareGeocodedLocation(outcome.data);
  return prepared.kind === 'ready' ? { kind: 'ready', location: prepared.location } : { kind: 'not_found' };
}

export const MAX_SPOT_NAME_LENGTH = 200;

export interface SaveSpotInput {
  readonly name: string;
  readonly address: string;
  readonly category: SpotCategory;
  readonly origin: SpotAddressOrigin;
}

export type SaveSpotFailure =
  | { readonly kind: 'invalid_input'; readonly field: 'name' | 'address' }
  | { readonly kind: 'address_not_found' }
  | { readonly kind: 'geocoding_unavailable' }
  | { readonly kind: 'store_unconfigured' }
  | { readonly kind: 'store_error'; readonly message: string };

export type SaveSpotOutcome =
  | { readonly kind: 'saved'; readonly spot: SavedSpot }
  | { readonly kind: 'failed'; readonly failure: SaveSpotFailure };

export interface SaveDeps extends LocateDeps, InsertSpotOptions {}

export async function saveSpot(input: SaveSpotInput, deps: SaveDeps = {}): Promise<SaveSpotOutcome> {
  const name = input.name.trim();
  const address = input.address.trim();
  if (name.length === 0 || name.length > MAX_SPOT_NAME_LENGTH) {
    return { kind: 'failed', failure: { kind: 'invalid_input', field: 'name' } };
  }
  if (address.length === 0) {
    return { kind: 'failed', failure: { kind: 'invalid_input', field: 'address' } };
  }

  const located = await locateAddress(address, deps);
  if (located.kind === 'unavailable') return { kind: 'failed', failure: { kind: 'geocoding_unavailable' } };
  if (located.kind === 'not_found') return { kind: 'failed', failure: { kind: 'address_not_found' } };

  const { location } = located;
  const inserted = await insertSpot(
    {
      name,
      // Geocoding이 빈 문자열을 줄 수 있다. 계약은 "없음"을 null로 표현한다.
      roadAddress: location.roadAddress.length > 0 ? location.roadAddress : null,
      jibunAddress: location.jibunAddress.length > 0 ? location.jibunAddress : null,
      coordinates: location.coordinates,
      region: location.region,
      category: input.category,
      origin: input.origin,
    },
    deps,
  );
  if (!inserted.ok) {
    if (inserted.error.kind === 'unconfigured') return { kind: 'failed', failure: { kind: 'store_unconfigured' } };
    const message = inserted.error.kind === 'query' ? inserted.error.message : '저장된 행이 계약과 다릅니다';
    return { kind: 'failed', failure: { kind: 'store_error', message } };
  }
  return { kind: 'saved', spot: inserted.spot };
}
