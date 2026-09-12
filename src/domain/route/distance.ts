import type { GeoPoint } from '@/shared/geo';

/**
 * 직선거리와 그 추정 — T32(#47).
 *
 * 순수 함수만 있다. 실측(TMAP)이 없을 때의 대체이자, LLM에 넘기는 거리표의
 * 재료다. LLM은 지리를 계산하지 못하므로 이 표 없이 이름만 주면 동선이
 * 지그재그가 된다(T38).
 */

const EARTH_RADIUS_M = 6_371_000;

/** 직선거리 대비 실제 도로 우회 비율. 격자형 도심의 경험값. */
export const WALK_DETOUR_FACTOR = 1.3;
/** 보행 속도. 약 4.3 km/h — 구경하며 걷는 속도로 잡았다. */
export const WALK_SPEED_MPS = 1.2;

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 직선거리(m) → 도보 시간(초). 우회 계수를 곱하고 속도로 나눈다. */
export function estimateWalkSeconds(distanceM: number): number {
  return Math.round((distanceM * WALK_DETOUR_FACTOR) / WALK_SPEED_MPS);
}

export interface Located {
  readonly id: string;
  readonly coord: GeoPoint;
}

/** 쌍별 직선거리표. 10 m 단위로 반올림 — LLM에 허위 정밀도를 보이지 않는다. */
export interface DistanceTable {
  readonly ids: readonly string[];
  /** 두 id 사이 거리(m). 모르는 id면 던진다 — 조립 실수다. */
  readonly between: (a: string, b: string) => number;
  /** LLM 프롬프트용 텍스트 표. */
  readonly toText: (labelOf: (id: string) => string) => string;
}

export function distanceTable(points: readonly Located[]): DistanceTable {
  const table = new Map<string, number>();
  const key = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const p = points[i];
      const q = points[j];
      if (p === undefined || q === undefined) continue;
      table.set(key(p.id, q.id), Math.round(haversineM(p.coord, q.coord) / 10) * 10);
    }
  }

  const ids = points.map((p) => p.id);
  const between = (a: string, b: string): number => {
    if (a === b) return 0;
    const d = table.get(key(a, b));
    if (d === undefined) {
      throw new Error(`거리표에 없는 지점입니다: ${a} ↔ ${b}`);
    }
    return d;
  };

  return {
    ids,
    between,
    toText: (labelOf) =>
      ids
        .flatMap((a, i) =>
          ids.slice(i + 1).map((b) => `${labelOf(a)} ↔ ${labelOf(b)}: ${String(between(a, b))}m`),
        )
        .join('\n'),
  };
}
