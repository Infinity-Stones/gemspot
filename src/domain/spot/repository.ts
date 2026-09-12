import type { SavedSpot } from '@/shared/spot';
import { SEED_SPOTS } from './seed';

/**
 * 스팟 저장소 접근 — 지금은 시드 폴백만 있다(T50 #74).
 *
 * D06(어디에 저장할지)이 닫히면 T21의 저장 어댑터 분기가 이 함수 **앞에**
 * 붙는다. 그때도 실패 시 조용히 시드로 떨어지지 않고 `source`로 위에 알린다 —
 * `example` 도메인의 seed 배지와 같은 원칙이다.
 */

export type SpotSource = 'seed' | 'store';

export interface LoadSpotsResult {
  readonly spots: readonly SavedSpot[];
  readonly source: SpotSource;
}

export function loadSpots(): Promise<LoadSpotsResult> {
  return Promise.resolve({ spots: SEED_SPOTS, source: 'seed' });
}
