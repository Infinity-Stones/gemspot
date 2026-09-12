import type { GeoPoint } from './geo';
import type { SpotCategory } from './spotCategory';
import { diffSeconds, parseIso } from './time';

/**
 * 동선 가이드의 경계선 — T31(#46).
 *
 * 추천 엔진이 받는 것은 자연어가 아니라 **해석이 끝난 구조화된 요청**이다.
 * 문장을 이 모양으로 바꾸는 것은 LLM 어댑터의 일이고, 이 모양만 손으로 채워도
 * 엔진은 돈다. 그래서 이 계약은 LLM · TMAP · Geocoding 어느 것도 모른다.
 *
 * `window`와 `area.center`가 **필수**인 것이 핵심이다. 옵셔널로 두면 "빠진
 * 조건을 기본값으로 채우는" 경로가 타입 수준에서 열린다(T36). 해석 도중의
 * 불완전한 상태는 도메인 안의 별도 타입이 맡는다.
 */

/** 오프셋이 붙은 ISO 8601 둘. `start < end`, 길이 ≤ 12시간(`isValidTimeWindow`). */
export interface TimeWindow {
  readonly start: string;
  readonly end: string;
}

export interface RouteRequest {
  readonly window: TimeWindow;
  readonly area: {
    /** 사용자가 말한 이름. 예: 성수동 */
    readonly name: string;
    /** Geocoding으로 얻은 출발점. */
    readonly center: GeoPoint;
  };
  /** 가중치로만 쓴다. 후보를 거르지 않는다. 비어 있으면 선호 없음. */
  readonly preferredCategories: readonly SpotCategory[];
  /** 절대 빠지지 않는 스팟의 id. */
  readonly requiredSpotIds: readonly string[];
}

/**
 * 엔진이 받는 후보 하나. 저장된 스팟(`Spot`)에서 엔진에 필요한 것만 뽑은
 * 투영이다. 엔진이 주소 · 출처를 알 이유가 없다.
 */
export interface RouteCandidate {
  readonly id: string;
  readonly name: string;
  readonly category: SpotCategory;
  readonly coord: GeoPoint;
}

/** 한 번의 산책으로 볼 수 있는 상한. 이보다 길면 해석 오류로 본다. */
export const MAX_WINDOW_SECONDS = 12 * 3_600;

export type TimeWindowProblem = 'unparseable' | 'not_after_start' | 'too_long';

/** 유효하면 `null`, 아니면 무엇이 문제인지. 화면과 엔진이 같은 판정을 쓴다. */
export function timeWindowProblem(window: TimeWindow): TimeWindowProblem | null {
  if (parseIso(window.start) === null || parseIso(window.end) === null) {
    return 'unparseable';
  }
  const length = diffSeconds(window.start, window.end);
  if (length <= 0) return 'not_after_start';
  if (length > MAX_WINDOW_SECONDS) return 'too_long';
  return null;
}

export function isValidTimeWindow(window: TimeWindow): boolean {
  return timeWindowProblem(window) === null;
}
