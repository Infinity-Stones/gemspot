/**
 * 동선 도메인의 공개 API.
 *
 * app 레이어가 여는 **유일한** 문이다. 어댑터(LLM · TMAP · Geocoding)와 그
 * 조립은 도메인 안쪽 사정이고, 화면은 `planRoute` · `planFromRequest` ·
 * `reschedule` 셋과 결과 타입만 안다.
 *
 * 이 파일에는 **모듈 최상위 부수효과를 두지 않는다**(lint가 잡는다).
 */

export { planFromRequest, planRoute, reschedule } from './planner';
export type { PlanFromRequestInput, PlanRouteInput, RescheduleInput } from './planner';
export type {
  DroppedSpot,
  DropReason,
  InterpretationDraft,
  Itinerary,
  ItineraryStop,
  Leg,
  LegSource,
  MissingField,
  OrderingSource,
  PlanFailure,
  PlanOutcome,
  PlanSuccess,
} from './types';
