/**
 * 스팟 도메인의 공개 API. app 레이어가 여는 유일한 문이다.
 * 모듈 최상위 부수효과를 두지 않는다(lint가 잡는다).
 */

export { DEMO_SPOTS } from './demoSpots';
export { toRouteCandidate } from './projection';
export { findSpot, insertSpot, loadSpots } from './repository';
export type { InsertSpotResult, LoadSpotsResult, NewSpot, SpotSource } from './repository';
export { locateAddress, saveSpot } from './save';
export type { LocateAddressResult, SaveSpotFailure, SaveSpotInput, SaveSpotOutcome } from './save';
export { prepareGeocodedLocation } from './geocoding';
export type {
  GeocodedSpotLocation,
  PrepareGeocodedLocationResult,
} from './geocoding';
