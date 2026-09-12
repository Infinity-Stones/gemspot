/**
 * 스팟 도메인의 공개 API. app 레이어가 여는 유일한 문이다.
 * 모듈 최상위 부수효과를 두지 않는다(lint가 잡는다).
 */

export { loadSpots } from './repository';
export type { LoadSpotsResult, SpotSource } from './repository';
