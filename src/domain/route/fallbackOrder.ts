import type { RouteCandidate } from '@/shared/routeRequest';
import type { DistanceTable } from './distance';
import { START_ID } from './types';

/**
 * 규칙 기반 순서 — T39(#54). LLM이 실패하면 가까운 곳부터 간다.
 *
 * 최근접 이웃(greedy). 필수 스팟을 여기서 특별 취급하지 않는다 — 필수가
 * **빠지지 않게** 하는 것은 T42의 제거 규칙이고, 순서에서 필수를 먼저 돌리면
 * 동선이 지그재그가 된다. 동률이면 입력 순서(선호 가중치 순)가 앞선 것.
 */
export function orderByNearest(
  candidates: readonly RouteCandidate[],
  table: DistanceTable,
): readonly RouteCandidate[] {
  const remaining = [...candidates];
  const ordered: RouteCandidate[] = [];
  let current = START_ID;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const d = table.between(current, candidate.id);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    if (next === undefined) break;
    ordered.push(next);
    current = next.id;
  }
  return ordered;
}
