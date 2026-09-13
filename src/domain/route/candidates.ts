import type { RouteCandidate, RouteRequest } from '@/shared/routeRequest';
import { fitsWindow } from '@/shared/spotCategory';
import { diffSeconds, minutesOfSeoulDay } from '@/shared/time';
import { haversineM } from './distance';
import type { DroppedSpot } from './types';

/**
 * 후보 선별 — T33(#48). 동네 반경 안 + 해석된 시간대에 맞는 카테고리만 후보다.
 *
 * **선호는 후보를 거르지 않는다.** "카페 위주"는 정렬 가중치로만 쓴다 — 걸러
 * 버리면 카페만 남아 동선이 단조로워진다.
 *
 * 왜 빠졌는지를 함께 돌려준다. "이 시간대에 갈 만한 스팟이 없다"(T47)와 빠진
 * 스팟 표시(T42)가 이유를 알아야 한다.
 */

/** 동네 반경. 도보 20분 안팎. 문장에서 반경을 해석하지 않으므로 지금은 상수다. */
export const AREA_RADIUS_M = 1_500;

export interface CandidateSelection {
  /** 선호 카테고리가 앞에 오도록 정렬된 후보. */
  readonly candidates: readonly RouteCandidate[];
  readonly dropped: readonly DroppedSpot[];
}

export function selectCandidates(
  all: readonly RouteCandidate[],
  request: RouteRequest,
  radiusM: number = AREA_RADIUS_M,
): CandidateSelection {
  const startMinute =
    request.window === null ? 0 : minutesOfSeoulDay(request.window.start);
  const window =
    request.window === null
      ? null
      : {
          startMinute,
          endMinute:
            startMinute +
            Math.round(
              diffSeconds(request.window.start, request.window.end) / 60,
            ),
        };
  const required = new Set(request.requiredSpotIds);
  const preferred = new Set(request.preferredCategories);

  const candidates: RouteCandidate[] = [];
  const dropped: DroppedSpot[] = [];

  for (const candidate of all) {
    // 필수 스팟은 반경 · 시간대 규칙을 건너뛴다. 사용자가 "꼭 간다"고 한 곳을
    // 표로 빼면 "필수는 빠지지 않는다"(T42)와 어긋난다.
    if (required.has(candidate.id)) {
      candidates.push(candidate);
      continue;
    }
    if (haversineM(request.area.center, candidate.coord) > radiusM) {
      dropped.push({ candidate, reason: 'outside_area' });
      continue;
    }
    if (window !== null && !fitsWindow(candidate.category, window)) {
      dropped.push({ candidate, reason: 'outside_window' });
      continue;
    }
    candidates.push(candidate);
  }

  // 안정 정렬: 선호 카테고리가 앞, 그 안에서는 원래 순서.
  const weighted = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: preferred.has(candidate.category) ? 0 : 1,
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(w => w.candidate);

  return { candidates: weighted, dropped };
}
