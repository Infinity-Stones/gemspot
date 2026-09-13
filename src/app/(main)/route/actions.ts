'use server';

import {
  planFromRequest,
  planRoute,
  reschedule,
  resolveArea,
} from '@/domain/route';
import { loadSpots, toRouteCandidate } from '@/domain/spot';
import { formatSeoulIso } from '@/shared/time';
import type { RoutePlanState } from './planState';
import { MAX_SENTENCE_LENGTH } from './planState';
import {
  readClarificationContext,
  readConditions,
  readEditablePlan,
  readJson,
} from './planInput';

/**
 * 서버에서 현재 저장 목록을 읽고 자연어 요청을 동선 도메인에 전달한다.
 * 되묻기는 이미 해석한 조건과 최신 답을 분리해 전달한다. 대화를 연결한 뒤
 * 500자로 자르면 사용자가 방금 답한 시간·동네가 사라질 수 있다.
 */
export async function planRouteAction(
  previous: RoutePlanState,
  formData: FormData,
): Promise<RoutePlanState> {
  const sentence = readText(formData, 'sentence').slice(0, MAX_SENTENCE_LENGTH);
  const context = readClarificationContext(previous);
  const continuation = context === undefined ? {} : { context };
  if (sentence.length === 0) {
    return {
      status: 'invalid',
      message:
        '어디서 몇 시부터 몇 시까지 걷고 싶은지 한 문장으로 적어 주세요.',
      ...continuation,
    };
  }

  const { spots, error } = await loadSpots();
  if (error !== null) return { status: 'load_failed', ...continuation };

  const outcome = await planRoute({
    sentence,
    ...(context === undefined ? {} : { previousDraft: context }),
    now: formatSeoulIso(Date.now()),
    spots: spots.map(toRouteCandidate),
  });

  return {
    status: 'done',
    sentence,
    outcome,
    ...(outcome.kind === 'failed' ? continuation : {}),
  };
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** 손으로 고친 조건은 LLM 해석 없이 사용하고, 위치는 서버에서 조회한다. */
export async function planFromRequestAction(
  _previous: RoutePlanState,
  formData: FormData,
): Promise<RoutePlanState> {
  const conditions = readConditions(readJson(formData, 'conditions'));
  if (conditions === null)
    return {
      status: 'invalid',
      message:
        '동네와 날짜·시간을 확인해 주세요. 산책은 12시간 이내로 정할 수 있어요.',
    };
  const { spots, error } = await loadSpots();
  if (error !== null) return { status: 'load_failed' };
  const candidates = spots.map(toRouteCandidate);
  if (
    conditions.requiredSpotIds.some(
      id => !candidates.some(spot => spot.id === id),
    )
  )
    return {
      status: 'invalid',
      message:
        '저장된 장소가 변경됐어요. 화면을 새로고침해 목록을 확인해 주세요.',
    };
  const area = await resolveArea(conditions.areaName);
  if (area.kind !== 'found')
    return {
      status: 'done',
      sentence: '',
      outcome: {
        kind: 'failed',
        failure:
          area.kind === 'not_found'
            ? { kind: 'area_not_found', areaName: conditions.areaName }
            : { kind: 'service_unavailable', service: 'geocoding' },
      },
    };
  const outcome = await planFromRequest({
    request: {
      window: conditions.window,
      area: {
        name: conditions.areaName,
        center: area.center,
        label: area.label,
      },
      preferredCategories: conditions.preferredCategories,
      requiredSpotIds: conditions.requiredSpotIds,
    },
    spots: candidates,
  });
  return { status: 'done', sentence: '', outcome };
}

/** 사용자 편집은 저장된 장소로 복원한 뒤 바뀐 구간만 다시 계산한다. */
export async function rescheduleAction(
  _previous: RoutePlanState,
  formData: FormData,
): Promise<RoutePlanState> {
  const { spots, error } = await loadSpots();
  if (error !== null) return { status: 'load_failed' };
  const current = readEditablePlan(
    readJson(formData, 'plan'),
    spots.map(toRouteCandidate),
  );
  if (current === null)
    return {
      status: 'invalid',
      message: '동선이나 저장된 장소가 변경됐어요. 동선을 다시 만들어 주세요.',
    };
  const id = readText(formData, 'spotId');
  const intent = readText(formData, 'intent');
  const order = [...current.order];
  const dropped = [...current.dropped];
  let requiredSpotIds = [...current.request.requiredSpotIds];
  const index = order.findIndex(spot => spot.id === id);
  if (intent === 'restore') {
    const removedIndex = dropped.findIndex(
      item => item.candidate.id === id && item.reason === 'user',
    );
    const removed = dropped[removedIndex];
    if (removed === undefined)
      return { status: 'invalid', message: '되돌릴 장소를 찾지 못했어요.' };
    order.splice(
      Math.min(removed.previousIndex ?? order.length, order.length),
      0,
      removed.candidate,
    );
    dropped.splice(removedIndex, 1);
    if (removed.wasRequired) requiredSpotIds.push(id);
  } else if (index >= 0 && intent === 'remove') {
    if (order.length === 1)
      return {
        status: 'invalid',
        message:
          '동선에는 한 곳 이상이 필요해요. 조건을 바꿔 다시 제안받을 수 있어요.',
      };
    const removed = order.splice(index, 1)[0];
    if (removed !== undefined)
      dropped.push({
        candidate: removed,
        reason: 'user',
        previousIndex: index,
        wasRequired: requiredSpotIds.includes(id),
      });
    requiredSpotIds = requiredSpotIds.filter(required => required !== id);
  } else if (index >= 0 && (intent === 'up' || intent === 'down')) {
    const nextIndex = index + (intent === 'up' ? -1 : 1);
    const item = order[index];
    const neighbor = order[nextIndex];
    if (item === undefined || neighbor === undefined)
      return { status: 'invalid', message: '더 이상 순서를 옮길 수 없어요.' };
    order[index] = neighbor;
    order[nextIndex] = item;
  } else return { status: 'invalid', message: '변경할 장소를 확인해 주세요.' };
  const request = {
    ...current.request,
    requiredSpotIds: [...new Set(requiredSpotIds)],
  };
  const itinerary = await reschedule({
    request,
    order,
    previousLegs: current.legs,
    previousReasons: current.reasons,
    previousOrderIds: current.order.map(spot => spot.id),
    dropped,
    ordering: current.ordering,
  });
  return {
    status: 'done',
    sentence: '',
    outcome: {
      kind: 'ok',
      request,
      itinerary,
      unmatchedRequiredNames: current.unmatchedRequiredNames,
    },
  };
}
