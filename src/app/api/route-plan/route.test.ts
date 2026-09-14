import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanOutcome } from '@/domain/route';

const domain = vi.hoisted(() => ({
  loadSpots: vi.fn(),
  planFromRequest: vi.fn(),
  planRoute: vi.fn(),
  toRouteCandidate: vi.fn(),
}));

vi.mock('@/domain/route', () => ({
  planFromRequest: domain.planFromRequest,
  planRoute: domain.planRoute,
}));
vi.mock('@/domain/spot', () => ({
  loadSpots: domain.loadSpots,
  toRouteCandidate: domain.toRouteCandidate,
}));

import { POST } from './route';

const FAILED_OUTCOME: PlanOutcome = {
  kind: 'failed',
  failure: { kind: 'interpretation_failed' },
};

function sentenceRequest(): Request {
  return new Request('http://localhost/api/route-plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sentence: '성수동에서 걷고 싶어' }),
  });
}

describe('POST /api/route-plan 스팟 저장소', () => {
  beforeEach(() => {
    domain.loadSpots.mockReset();
    domain.planFromRequest.mockReset();
    domain.planRoute.mockReset();
    domain.toRouteCandidate.mockReset();
  });

  it('구조화 API에서도 시간 제한 없는 요청을 받을 수 있다', async () => {
    domain.loadSpots.mockResolvedValue({ spots: [], error: null });
    domain.planFromRequest.mockResolvedValue(FAILED_OUTCOME);
    const request = {
      window: null,
      area: {
        name: '성수 카페거리',
        center: { latitude: 37.54, longitude: 127.05 },
      },
      preferredCategories: ['cafe'],
      requiredSpotIds: [],
    };
    const response = await POST(
      new Request('http://localhost/api/route-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request }),
      }),
    );
    expect(response.status).toBe(200);
    expect(domain.planFromRequest).toHaveBeenCalledWith({ request, spots: [] });
  });

  it('저장 스팟 조회에 실패하면 샘플 후보로 숨기지 않고 503을 돌려준다', async () => {
    domain.loadSpots.mockResolvedValue({
      spots: [],
      error: { kind: 'query', message: 'permission denied' },
    });

    const response = await POST(sentenceRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: '저장한 스팟을 불러오지 못했습니다',
    });
    expect(domain.toRouteCandidate).not.toHaveBeenCalled();
    expect(domain.planRoute).not.toHaveBeenCalled();
  });

  it('성공 응답에 더 이상 데이터 출처 필드를 싣지 않는다', async () => {
    domain.loadSpots.mockResolvedValue({ spots: [], error: null });
    domain.planRoute.mockResolvedValue(FAILED_OUTCOME);

    const response = await POST(sentenceRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(FAILED_OUTCOME);
  });
});
