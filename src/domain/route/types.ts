import type { GeoPoint } from '@/shared/geo';
import type { RouteCandidate, RouteRequest, TimeWindow } from '@/shared/routeRequest';
import type { SpotCategory } from '@/shared/spotCategory';

/**
 * 동선 도메인의 어휘 — T32(#47).
 *
 * 여기 있는 것은 **엔진이 만들어 내는 모양**이다. 입력 계약(`RouteRequest` ·
 * `RouteCandidate`)은 세 레이어가 공유하므로 shared에 있고, 출력은 이 도메인과
 * 화면만 보므로 여기 둔다.
 */

/** 순서를 누가 정했는가. `'rule'`이면 화면이 "규칙 기반" 배지를 띄운다(T39). */
export type OrderingSource = 'llm' | 'rule';

/** 구간 시간이 실측인지 직선거리 추정인지(T41). */
export type LegSource = 'tmap' | 'estimate';

export type DropReason = 'outside_window' | 'outside_area' | 'over_time' | 'user';

export const START_ID = 'start';

export interface Leg {
  readonly fromId: string;
  readonly toId: string;
  readonly distanceM: number;
  readonly durationS: number;
  readonly source: LegSource;
  /** 경로선. 추정이면 `[from, to]` 두 점. */
  readonly path: readonly GeoPoint[];
}

export interface ItineraryStop {
  readonly candidate: RouteCandidate;
  readonly arriveAt: string;
  readonly departAt: string;
  readonly dwellMinutes: number;
  readonly required: boolean;
  /** LLM 제안이면 한 줄 이유, 규칙 기반이거나 사용자가 순서를 바꿨으면 null. */
  readonly reason: string | null;
}

export interface DroppedSpot {
  readonly candidate: RouteCandidate;
  readonly reason: DropReason;
}

export interface Itinerary {
  readonly start: { readonly coord: GeoPoint; readonly departAt: string };
  readonly window: TimeWindow;
  readonly stops: readonly ItineraryStop[];
  /** `stops.length`개. `legs[i]`는 `stops[i]`에 **도착하는** 구간이다. */
  readonly legs: readonly Leg[];
  readonly endAt: string;
  /** 종료 시각 초과(초). 0이면 안에 들어왔다. 필수만 남아 초과하면 양수로 남는다. */
  readonly overBySeconds: number;
  readonly totalWalkMinutes: number;
  readonly totalDistanceM: number;
  readonly hasEstimatedLegs: boolean;
  readonly dropped: readonly DroppedSpot[];
  readonly ordering: OrderingSource;
}

/**
 * LLM이 문장에서 뽑은 것. `null`이 곧 "문장에 없다"다 — 기본값으로 채우지
 * 않는다(T36). `RouteRequest`와 달리 좌표가 없고 필수 스팟은 **이름**이다.
 */
export interface InterpretationDraft {
  readonly window: TimeWindow | null;
  readonly areaName: string | null;
  readonly preferredCategories: readonly SpotCategory[];
  readonly requiredSpotNames: readonly string[];
}

export type MissingField = 'window' | 'area';

/** 제안하지 않는 경우들 — T47(#62). 빈 동선을 내지 않고 이유를 돌려준다. */
export type PlanFailure =
  | {
      readonly kind: 'needs_clarification';
      readonly missing: readonly MissingField[];
      readonly question: string;
      readonly draft: InterpretationDraft;
    }
  | { readonly kind: 'area_not_found'; readonly areaName: string }
  | {
      readonly kind: 'no_candidates';
      readonly window: TimeWindow;
      readonly areaName: string;
      readonly dropped: readonly DroppedSpot[];
    }
  | { readonly kind: 'interpretation_failed' }
  | { readonly kind: 'service_unavailable'; readonly service: 'llm' | 'geocoding' };

export interface PlanSuccess {
  readonly kind: 'ok';
  readonly request: RouteRequest;
  readonly itinerary: Itinerary;
  /** 문장에서 "꼭 갈 곳"으로 나왔지만 저장된 스팟과 짝이 안 맞은 이름. */
  readonly unmatchedRequiredNames: readonly string[];
}

export type PlanOutcome = PlanSuccess | { readonly kind: 'failed'; readonly failure: PlanFailure };
