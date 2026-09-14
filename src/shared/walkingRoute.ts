import type { SpotCoordinates } from './spot';

/** 보행 경로 제공자가 공통으로 돌려주는 거리·예상 시간·경로선. */
export interface WalkingRoute {
  readonly distanceM: number;
  readonly durationS: number;
  readonly path: readonly SpotCoordinates[];
}
