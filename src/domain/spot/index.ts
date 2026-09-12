/**
 * 스팟 도메인의 공개 API. app 레이어가 여는 유일한 문이다.
 * 모듈 최상위 부수효과를 두지 않는다(lint가 잡는다).
 */

export { toRouteCandidate } from './projection';
export { deleteSpot, findSpot, insertSpot, loadSpots } from './repository';
export type {
  DeleteSpotResult,
  InsertSpotResult,
  LoadSpotsError,
  LoadSpotsResult,
  NewSpot,
} from './repository';
export { locateAddress, saveSpot, searchAddress } from './save';
export type {
  LocateAddressResult,
  SaveSpotFailure,
  SaveSpotInput,
  SaveSpotOutcome,
  SearchAddressResult,
} from './save';
export { prepareGeocodedLocations } from './geocoding';
export { searchPlaces, toFoundPlace } from './placeSearch';
export type { FoundPlace, SearchPlacesResult } from './placeSearch';
export { prepareGeocodedLocation } from './geocoding';
export type {
  GeocodedSpotLocation,
  PrepareGeocodedLocationResult,
} from './geocoding';
