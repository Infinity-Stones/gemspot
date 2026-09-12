import type { RouteCandidate } from '@/shared/routeRequest';
import type { SavedSpot } from '@/shared/spot';

/**
 * 저장된 스팟을 동선 엔진이 받는 후보로 투영한다.
 *
 * 두 도메인은 서로를 열지 못하므로(eslint boundaries) 이 변환은 둘 중 한쪽이
 * shared 계약만 보고 해야 한다. 스팟 쪽에 두는 이유는 "스팟에서 무엇을 내보낼
 * 것인가"가 스팟의 결정이기 때문이다 — 주소 · 출처는 엔진이 알 이유가 없다.
 * 서버 액션과 API 라우트가 같은 변환을 쓴다.
 */
export function toRouteCandidate(spot: SavedSpot): RouteCandidate {
  return {
    id: spot.id,
    name: spot.name,
    category: spot.category,
    coord: spot.coordinates,
  };
}
