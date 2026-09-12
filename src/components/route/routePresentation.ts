import type { DropReason, Leg } from '@/domain/route';
import type { SpotCoordinates } from '@/shared/spot';

export const DROP_REASON_TEXT: Readonly<Record<DropReason, string>> = {
  outside_window: '요청 시간대와 기본 체류 시간에 맞지 않아요',
  outside_area: '그 동네에서 멀어요',
  over_time: '시간이 부족해 뺐어요',
  user: '직접 뺐어요',
};

export interface RouteLine {
  readonly source: Leg['source'];
  readonly path: SpotCoordinates[];
}

function samePoint(
  a: SpotCoordinates | undefined,
  b: SpotCoordinates | undefined,
): boolean {
  return (
    a !== undefined &&
    b !== undefined &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude
  );
}

/** 추정 구간과 끊긴 경로를 실제 경로에 연결해 그리지 않는다. */
export function legsToLines(legs: readonly Leg[]): readonly RouteLine[] {
  const lines: RouteLine[] = [];
  for (const leg of legs) {
    const path = leg.path.filter(
      (point, i) => !samePoint(point, leg.path[i - 1]),
    );
    if (path.length < 2) continue;
    const previous = lines.at(-1);
    if (
      previous?.source === leg.source &&
      samePoint(previous.path.at(-1), path[0])
    ) {
      previous.path.push(...path.slice(1));
    } else {
      lines.push({ source: leg.source, path: [...path] });
    }
  }
  return lines;
}
