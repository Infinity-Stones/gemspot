import type { GenerateJson } from '@/lib/platform/llm';
import type { RouteCandidate, RouteRequest } from '@/shared/routeRequest';
import { selectCandidates } from './candidates';
import { distanceTable } from './distance';
import { orderByNearest } from './fallbackOrder';
import { interpret } from './interpret';
import type { LegCache, WalkingRouteFn } from './legs';
import { measureLegs } from './legs';
import { proposeOrder } from './propose';
import { schedule, withoutLastOptional } from './schedule';
import type { GeocodeFn } from './startPoint';
import { resolveArea } from './startPoint';
import type {
  DroppedSpot,
  InterpretationDraft,
  Itinerary,
  OrderingSource,
  PlanOutcome,
  PlanSuccess,
} from './types';
import { START_ID } from './types';

/**
 * 동선 만들기 유스케이스 — T48(#72). 해석 → 출발점 → 후보 → 순서 → 실측 →
 * 시간 맞춤을 한 줄로 엮는다. 어댑터는 전부 주입 가능해서 테스트는 외부 없이 돈다.
 *
 * 두 진입점이 있다.
 * - `planRoute`: 문장부터. LLM 해석과 Geocoding을 탄다.
 * - `planFromRequest`: 구조화된 요청부터. 해석 결과를 사용자가 고쳐 "다시 제안"할
 *   때(T37)와 데모 · 테스트("외부 서비스 없이 돈다", T32)가 쓴다.
 */

export interface PlannerDeps {
  readonly generate?: GenerateJson;
  readonly geocode?: GeocodeFn;
  readonly route?: WalkingRouteFn;
}

export interface PlanRouteInput {
  readonly sentence: string;
  readonly previousDraft?: InterpretationDraft;
  /** 요청 시각. 오프셋 있는 ISO. */
  readonly now: string;
  readonly spots: readonly RouteCandidate[];
  readonly deps?: PlannerDeps;
}

/** 이름 → 스팟. 공백 · 대소문자를 무시하고, 포함 관계까지 허용한다. */
export function matchRequiredSpots(
  names: readonly string[],
  spots: readonly RouteCandidate[],
): { ids: readonly string[]; unmatched: readonly string[] } {
  const norm = (s: string): string => s.replace(/\s+/g, '').toLowerCase();
  const ids: string[] = [];
  const unmatched: string[] = [];
  for (const name of names) {
    const n = norm(name);
    const hit =
      spots.find(s => norm(s.name) === n) ??
      spots.find(s => norm(s.name).includes(n) || n.includes(norm(s.name)));
    if (hit === undefined) unmatched.push(name);
    else if (!ids.includes(hit.id)) ids.push(hit.id);
  }
  return { ids, unmatched };
}

export async function planRoute(input: PlanRouteInput): Promise<PlanOutcome> {
  const deps = input.deps ?? {};

  const interpretation = await interpret({
    sentence: input.sentence,
    now: input.now,
    spotNames: input.spots.map(s => s.name),
    ...(input.previousDraft === undefined
      ? {}
      : { previousDraft: input.previousDraft }),
    ...(deps.generate === undefined ? {} : { generate: deps.generate }),
  });
  if (interpretation.kind === 'failed') {
    return {
      kind: 'failed',
      failure:
        interpretation.error.kind !== 'parse' &&
        interpretation.error.kind !== 'invalid_schema'
          ? { kind: 'service_unavailable', service: 'llm' }
          : { kind: 'interpretation_failed' },
    };
  }
  if (interpretation.kind === 'incomplete') {
    return {
      kind: 'failed',
      failure: {
        kind: 'needs_clarification',
        missing: interpretation.missing,
        question: interpretation.question,
        draft: interpretation.draft,
      },
    };
  }

  const { draft } = interpretation;
  const area = await resolveArea(draft.areaName, deps.geocode);
  if (area.kind === 'not_found') {
    return {
      kind: 'failed',
      failure: { kind: 'area_not_found', areaName: draft.areaName },
    };
  }
  if (area.kind === 'failed') {
    return {
      kind: 'failed',
      failure: { kind: 'service_unavailable', service: 'geocoding' },
    };
  }

  const matched = matchRequiredSpots(draft.requiredSpotNames, input.spots);
  const request: RouteRequest = {
    window: draft.window,
    area: { name: draft.areaName, center: area.center, label: area.label },
    preferredCategories: draft.preferredCategories,
    requiredSpotIds: matched.ids,
  };

  const outcome = await planFromRequest({ request, spots: input.spots, deps });
  return outcome.kind === 'ok'
    ? { ...outcome, unmatchedRequiredNames: matched.unmatched }
    : outcome;
}

export interface PlanFromRequestInput {
  readonly request: RouteRequest;
  readonly spots: readonly RouteCandidate[];
  readonly deps?: PlannerDeps;
}

export async function planFromRequest(
  input: PlanFromRequestInput,
): Promise<PlanOutcome> {
  const { request, spots } = input;
  const deps = input.deps ?? {};

  const selection = selectCandidates(spots, request);
  if (selection.candidates.length === 0) {
    return {
      kind: 'failed',
      failure: {
        kind: 'no_candidates',
        window: request.window,
        areaName: request.area.name,
        dropped: selection.dropped,
      },
    };
  }

  const table = distanceTable([
    { id: START_ID, coord: request.area.center },
    ...selection.candidates.map(c => ({ id: c.id, coord: c.coord })),
  ]);
  const proposeInput = {
    start: request.area.center,
    window: request.window,
    candidates: selection.candidates,
    table,
    requiredSpotIds: request.requiredSpotIds,
    preferredCategories: request.preferredCategories,
    ...(deps.generate === undefined ? {} : { generate: deps.generate }),
  };

  // 1차 순서: LLM, 실패면 규칙(가까운 곳부터). ordering은 여기서만 정해진다 —
  // 'llm'은 ProposeResult.kind === 'llm'에서만 나온다(T39).
  const proposal = await proposeOrder(proposeInput);
  const ordering: OrderingSource = proposal.kind === 'llm' ? 'llm' : 'rule';
  let order: readonly RouteCandidate[] =
    proposal.kind === 'llm'
      ? proposal.order
      : orderByNearest(selection.candidates, table);
  let reasons: ReadonlyMap<string, string> =
    proposal.kind === 'llm' ? proposal.reasons : new Map();

  const cache: LegCache = new Map();
  const dropped: DroppedSpot[] = [...selection.dropped];

  const build = async (
    current: readonly RouteCandidate[],
  ): Promise<Itinerary> => {
    const legs = await measureLegs({
      start: request.area.center,
      order: current,
      cache,
      ...(deps.route === undefined ? {} : { route: deps.route }),
    });
    return schedule({
      start: { coord: request.area.center, departAt: request.window.start },
      window: request.window,
      order: current,
      legs,
      requiredSpotIds: request.requiredSpotIds,
      reasons,
      dropped,
      ordering,
    });
  };

  let itinerary = await build(order);

  // T42 ① 종료 시각을 넘으면 LLM에 한 번 다시 묻는다. 재질의가 실패하면 1차
  // 순서를 버리지 않고 아래 제거 규칙만 적용한다 — 이유가 붙은 제안이 있는데
  // 규칙 기반으로 바꾸는 것은 사용자 입장에서 후퇴다.
  if (itinerary.overBySeconds > 0 && ordering === 'llm') {
    const retry = await proposeOrder({
      ...proposeInput,
      feedback: {
        overByMinutes: Math.ceil(itinerary.overBySeconds / 60),
        previousOrder: order.map(c => c.id),
      },
    });
    if (retry.kind === 'llm') {
      const retained = new Set(retry.order.map(candidate => candidate.id));
      for (const candidate of order) {
        if (!retained.has(candidate.id))
          dropped.push({ candidate, reason: 'over_time' });
      }
      order = retry.order;
      reasons = retry.reasons;
      itinerary = await build(order);
    }
  }

  // T42 ② 그래도 넘으면 필수가 아닌 마지막 스팟을 뺀다. 필수만 남으면 멈추고
  // 초과를 남긴다 — 필수를 빼는 결정은 사용자만 한다.
  while (itinerary.overBySeconds > 0) {
    const trimmed = withoutLastOptional(order, request.requiredSpotIds);
    if (trimmed === null) break;
    order = trimmed.order;
    dropped.push({ candidate: trimmed.removed, reason: 'over_time' });
    itinerary = await build(order);
  }

  if (itinerary.stops.length === 0) {
    return {
      kind: 'failed',
      failure: {
        kind: 'no_candidates',
        window: request.window,
        areaName: request.area.name,
        dropped,
      },
    };
  }

  const success: PlanSuccess = {
    kind: 'ok',
    request,
    itinerary,
    unmatchedRequiredNames: [],
  };
  return success;
}

export interface RescheduleInput {
  readonly request: RouteRequest;
  /** 사용자가 정한 순서. */
  readonly order: readonly RouteCandidate[];
  /** 이전 여정의 구간. 같은 쌍은 다시 실측하지 않는다. */
  readonly previousLegs: readonly Itinerary['legs'][number][];
  /** 이전 여정의 이유. 같은 자리에 남은 정거장만 유지된다. */
  readonly previousReasons?: ReadonlyMap<string, string>;
  readonly previousOrderIds?: readonly string[];
  readonly dropped?: readonly DroppedSpot[];
  readonly ordering: OrderingSource;
  readonly deps?: PlannerDeps;
}

/**
 * 다듬기 — T45(#60). LLM을 부르지 않는다. 사용자가 정한 순서에 LLM이 이유를
 * 다시 붙이면 사용자 결정을 덮는다. 순서가 바뀐 정거장의 이유는 지운다 —
 * 그 이유는 더 이상 그 자리를 설명하지 않는다. 초과해도 규칙으로 빼지 않는다.
 */
export async function reschedule(input: RescheduleInput): Promise<Itinerary> {
  const deps = input.deps ?? {};
  const cache: LegCache = new Map();
  for (const leg of input.previousLegs)
    cache.set(`${leg.fromId}>${leg.toId}`, leg);

  const reasons = new Map<string, string>();
  if (
    input.previousReasons !== undefined &&
    input.previousOrderIds !== undefined
  ) {
    input.order.forEach((candidate, i) => {
      const prevId = input.previousOrderIds?.[i];
      const prevBefore = i === 0 ? START_ID : input.previousOrderIds?.[i - 1];
      const nowBefore = i === 0 ? START_ID : input.order[i - 1]?.id;
      // 같은 자리 + 같은 직전 정거장이어야 이유가 유효하다.
      if (prevId === candidate.id && prevBefore === nowBefore) {
        const reason = input.previousReasons?.get(candidate.id);
        if (reason !== undefined) reasons.set(candidate.id, reason);
      }
    });
  }

  const legs = await measureLegs({
    start: input.request.area.center,
    order: input.order,
    cache,
    ...(deps.route === undefined ? {} : { route: deps.route }),
  });
  return schedule({
    start: {
      coord: input.request.area.center,
      departAt: input.request.window.start,
    },
    window: input.request.window,
    order: input.order,
    legs,
    requiredSpotIds: input.request.requiredSpotIds,
    reasons,
    dropped: input.dropped ?? [],
    ordering: input.ordering,
  });
}
