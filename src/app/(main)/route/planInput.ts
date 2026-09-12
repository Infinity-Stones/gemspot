import type {
  DroppedSpot,
  InterpretationDraft,
  Leg,
  OrderingSource,
} from '@/domain/route';
import { isSpotCategory, isSpotCoordinates } from '@/shared/spot';
import type { SpotCoordinates } from '@/shared/spot';
import { isValidTimeWindow } from '@/shared/routeRequest';
import type {
  RouteCandidate,
  RouteConditions,
  RouteRequest,
} from '@/shared/routeRequest';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readConditions(value: unknown): RouteConditions | null {
  if (!isRecord(value)) return null;
  const { window, areaName, preferredCategories, requiredSpotIds } = value;
  if (
    !isRecord(window) ||
    typeof window['start'] !== 'string' ||
    typeof window['end'] !== 'string'
  )
    return null;
  const time = { start: window['start'], end: window['end'] };
  if (
    !isValidTimeWindow(time) ||
    typeof areaName !== 'string' ||
    !areaName.trim() ||
    areaName.length > 200
  )
    return null;
  if (
    !Array.isArray(preferredCategories) ||
    preferredCategories.length > 6 ||
    !preferredCategories.every(isSpotCategory)
  )
    return null;
  if (
    !Array.isArray(requiredSpotIds) ||
    requiredSpotIds.length > 200 ||
    !requiredSpotIds.every(
      (id): id is string =>
        typeof id === 'string' && id.length > 0 && id.length <= 200,
    )
  )
    return null;
  return {
    window: time,
    areaName: areaName.trim(),
    preferredCategories: [...new Set(preferredCategories)],
    requiredSpotIds: [...new Set(requiredSpotIds)],
  };
}

export function readJson(form: FormData, key: string): unknown {
  const text = form.get(key);
  if (typeof text !== 'string' || text.length > 1_000_000) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export interface EditablePlan {
  readonly request: RouteRequest;
  readonly order: readonly RouteCandidate[];
  readonly legs: readonly Leg[];
  readonly reasons: ReadonlyMap<string, string>;
  readonly dropped: readonly DroppedSpot[];
  readonly ordering: OrderingSource;
  readonly unmatchedRequiredNames: readonly string[];
}

function sameCoord(a: SpotCoordinates, b: SpotCoordinates): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude;
}

/** 후보의 이름·좌표·카테고리는 현재 저장 데이터에서 복원한다. */
export function readEditablePlan(
  raw: unknown,
  spots: readonly RouteCandidate[],
): EditablePlan | null {
  if (
    !isRecord(raw) ||
    !isRecord(raw['request']) ||
    !isRecord(raw['itinerary'])
  )
    return null;
  const area = raw['request']['area'];
  if (!isRecord(area) || !isSpotCoordinates(area['center'])) return null;
  const conditions = readConditions({
    ...raw['request'],
    areaName: area['name'],
  });
  if (conditions === null) return null;
  const byId = new Map(spots.map(spot => [spot.id, spot]));
  if (conditions.requiredSpotIds.some(id => !byId.has(id))) return null;
  const { stops, legs, dropped, ordering } = raw['itinerary'];
  if (
    !Array.isArray(stops) ||
    stops.length === 0 ||
    stops.length > 200 ||
    !Array.isArray(legs) ||
    !Array.isArray(dropped) ||
    dropped.length > 1000 ||
    (ordering !== 'llm' && ordering !== 'rule')
  )
    return null;
  const order: RouteCandidate[] = [];
  const reasons = new Map<string, string>();
  const unchangedCoords = new Set<string>();
  for (const stop of stops as unknown[]) {
    if (
      !isRecord(stop) ||
      !isRecord(stop['candidate']) ||
      typeof stop['candidate']['id'] !== 'string'
    )
      return null;
    const candidate = byId.get(stop['candidate']['id']);
    if (candidate === undefined || order.some(item => item.id === candidate.id))
      return null;
    order.push(candidate);
    if (
      isSpotCoordinates(stop['candidate']['coord']) &&
      sameCoord(candidate.coord, stop['candidate']['coord'])
    )
      unchangedCoords.add(candidate.id);
    if (typeof stop['reason'] === 'string')
      reasons.set(candidate.id, stop['reason'].slice(0, 1000));
  }
  const priorStart = raw['itinerary']['start'];
  if (
    isRecord(priorStart) &&
    isSpotCoordinates(priorStart['coord']) &&
    sameCoord(area['center'], priorStart['coord'])
  )
    unchangedCoords.add('start');
  const cached: Leg[] = [];
  for (let i = 0; i < Math.min(legs.length, order.length); i += 1) {
    const leg: unknown = legs[i];
    const fromId = i === 0 ? 'start' : order[i - 1]?.id;
    const toId = order[i]?.id;
    if (
      !isRecord(leg) ||
      fromId === undefined ||
      toId === undefined ||
      leg['fromId'] !== fromId ||
      leg['toId'] !== toId
    )
      continue;
    if (!unchangedCoords.has(fromId) || !unchangedCoords.has(toId)) continue;
    if (
      typeof leg['durationS'] !== 'number' ||
      !Number.isFinite(leg['durationS']) ||
      leg['durationS'] < 0 ||
      leg['durationS'] > 86400 ||
      typeof leg['distanceM'] !== 'number' ||
      !Number.isFinite(leg['distanceM']) ||
      leg['distanceM'] < 0 ||
      leg['distanceM'] > 100000
    )
      continue;
    if (
      (leg['source'] !== 'tmap' && leg['source'] !== 'estimate') ||
      !Array.isArray(leg['path']) ||
      leg['path'].length < 2 ||
      leg['path'].length > 10000 ||
      !leg['path'].every(isSpotCoordinates)
    )
      continue;
    cached.push({
      fromId,
      toId,
      durationS: leg['durationS'],
      distanceM: leg['distanceM'],
      source: leg['source'],
      path: leg['path'],
    });
  }
  const omitted: DroppedSpot[] = [];
  for (const item of dropped as unknown[]) {
    if (
      !isRecord(item) ||
      !isRecord(item['candidate']) ||
      typeof item['candidate']['id'] !== 'string'
    )
      continue;
    const candidate = byId.get(item['candidate']['id']);
    const reason = item['reason'];
    if (
      candidate === undefined ||
      order.some(spot => spot.id === candidate.id) ||
      omitted.some(spot => spot.candidate.id === candidate.id)
    )
      continue;
    if (
      reason !== 'user' &&
      reason !== 'outside_area' &&
      reason !== 'outside_window' &&
      reason !== 'over_time'
    )
      continue;
    omitted.push({
      candidate,
      reason,
      ...(reason === 'user'
        ? {
            previousIndex:
              typeof item['previousIndex'] === 'number' &&
              Number.isInteger(item['previousIndex']) &&
              item['previousIndex'] >= 0
                ? Math.min(item['previousIndex'], 200)
                : order.length,
            wasRequired: item['wasRequired'] === true,
          }
        : {}),
    });
  }
  const unmatched = raw['unmatchedRequiredNames'];
  const unmatchedRequiredNames = Array.isArray(unmatched)
    ? unmatched
        .filter((name): name is string => typeof name === 'string')
        .slice(0, 50)
        .map(name => name.slice(0, 200))
    : [];
  return {
    request: {
      window: conditions.window,
      area: {
        name: conditions.areaName,
        center: area['center'],
        ...(typeof area['label'] === 'string'
          ? { label: area['label'].slice(0, 300) }
          : {}),
      },
      preferredCategories: conditions.preferredCategories,
      requiredSpotIds: conditions.requiredSpotIds,
    },
    order,
    legs: cached,
    reasons,
    dropped: omitted,
    ordering,
    unmatchedRequiredNames,
  };
}

/** Action의 이전 상태도 브라우저 입력이므로 필요한 조건만 검증해서 사용한다. */
export function readClarificationContext(
  previous: unknown,
): InterpretationDraft | undefined {
  if (!isRecord(previous)) return undefined;
  const outcome = previous['outcome'];
  const failure = isRecord(outcome) ? outcome['failure'] : null;
  const raw =
    isRecord(failure) && failure['kind'] === 'needs_clarification'
      ? failure['draft']
      : previous['context'];
  if (!isRecord(raw)) return undefined;
  const { window, areaName, preferredCategories, requiredSpotNames } = raw;
  const validWindow =
    isRecord(window) &&
    typeof window['start'] === 'string' &&
    typeof window['end'] === 'string' &&
    isValidTimeWindow({ start: window['start'], end: window['end'] })
      ? { start: window['start'], end: window['end'] }
      : null;
  return {
    window: validWindow,
    areaName:
      typeof areaName === 'string' && areaName.trim()
        ? areaName.trim().slice(0, 200)
        : null,
    preferredCategories: Array.isArray(preferredCategories)
      ? [...new Set(preferredCategories.filter(isSpotCategory))]
      : [],
    requiredSpotNames: Array.isArray(requiredSpotNames)
      ? [
          ...new Set(
            requiredSpotNames
              .filter(
                (name): name is string =>
                  typeof name === 'string' && name.trim().length > 0,
              )
              .slice(0, 50)
              .map(name => name.trim().slice(0, 200)),
          ),
        ]
      : [],
  };
}
