import { NextResponse } from 'next/server';
import { MAX_SENTENCE_LENGTH } from '@/app/(main)/route/planState';
import { planFromRequest, planRoute } from '@/domain/route';
import { loadSpots, toRouteCandidate } from '@/domain/spot';
import { isSpotCategory, isSpotCoordinates } from '@/shared/spot';
import type { RouteRequest, TimeWindow } from '@/shared/routeRequest';
import { isValidTimeWindow } from '@/shared/routeRequest';
import { formatSeoulIso } from '@/shared/time';

/**
 * 동선 만들기 서버 진입점 — T48(#72).
 *
 * LLM · TMAP · Geocoding 키는 전부 서버 전용이라 조립은 서버에서만 돈다.
 * 화면(T44)이 생기기 전에도 서버단을 끝까지 돌려 볼 수 있게 Route Handler로
 * 둔다. 화면이 붙으면 같은 도메인 함수를 Server Action에서 부르면 된다.
 *
 * 본문은 둘 중 하나다.
 * - `{ "sentence": "..." }` — 문장부터. 해석 · Geocoding을 탄다.
 * - `{ "request": RouteRequest }` — 해석을 사용자가 고친 뒤 "다시 제안"(T37).
 *
 * app 레이어는 도메인 배럴과 shared만 연다. platform은 열지 않는다(lint).
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRouteRequest(raw: unknown): RouteRequest | null {
  if (!isRecord(raw)) return null;
  const { window, area, preferredCategories, requiredSpotIds } = raw;
  if (!isRecord(area)) return null;
  let time: TimeWindow | null = null;
  if (window !== null) {
    if (!isRecord(window)) return null;
    const { start, end } = window;
    if (
      typeof start !== 'string' ||
      typeof end !== 'string' ||
      !isValidTimeWindow({ start, end })
    )
      return null;
    time = { start, end };
  }
  const { name, center } = area;
  if (typeof name !== 'string' || !isSpotCoordinates(center)) return null;
  const preferred = Array.isArray(preferredCategories)
    ? preferredCategories.filter(isSpotCategory)
    : [];
  const required = Array.isArray(requiredSpotIds)
    ? requiredSpotIds.filter((id): id is string => typeof id === 'string')
    : [];
  return {
    window: time,
    area: {
      name,
      center: { latitude: center.latitude, longitude: center.longitude },
    },
    preferredCategories: preferred,
    requiredSpotIds: required,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '본문이 JSON이 아닙니다' },
      { status: 400 },
    );
  }
  if (!isRecord(body))
    return NextResponse.json(
      { error: '본문이 객체가 아닙니다' },
      { status: 400 },
    );

  const { spots, error } = await loadSpots();
  if (error !== null) {
    return NextResponse.json(
      { error: '저장한 스팟을 불러오지 못했습니다' },
      { status: 503 },
    );
  }
  const candidates = spots.map(toRouteCandidate);

  const { sentence: rawSentence, request: rawRequest } = body;
  if (typeof rawSentence === 'string') {
    const sentence = rawSentence.trim().slice(0, MAX_SENTENCE_LENGTH);
    if (sentence.length === 0)
      return NextResponse.json(
        { error: '문장이 비어 있습니다' },
        { status: 400 },
      );
    const outcome = await planRoute({
      sentence,
      now: formatSeoulIso(Date.now()),
      spots: candidates,
    });
    return NextResponse.json(outcome);
  }

  const routeRequest = parseRouteRequest(rawRequest);
  if (routeRequest !== null) {
    const outcome = await planFromRequest({
      request: routeRequest,
      spots: candidates,
    });
    return NextResponse.json(outcome);
  }

  return NextResponse.json(
    { error: 'sentence 또는 request 중 하나가 필요합니다' },
    { status: 400 },
  );
}
