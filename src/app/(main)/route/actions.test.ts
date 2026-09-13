import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanOutcome } from '@/domain/route';
import type { SavedSpot } from '@/shared/spot';

const domain = vi.hoisted(() => ({
  loadSpots: vi.fn(),
  planRoute: vi.fn(),
  toRouteCandidate: vi.fn(),
}));

vi.mock('@/domain/route', () => ({ planRoute: domain.planRoute }));
vi.mock('@/domain/spot', () => ({
  loadSpots: domain.loadSpots,
  toRouteCandidate: domain.toRouteCandidate,
}));

import { planRouteAction } from './actions';

const SPOT: SavedSpot = {
  id: 'stored-1',
  name: '저장한 카페',
  roadAddress: '서울 성동구 연무장길 1',
  jibunAddress: null,
  coordinates: { latitude: 37.54, longitude: 127.05 },
  region: { sido: '서울특별시', sigugun: '성동구' },
  category: 'cafe',
  origin: 'manual',
};

const FAILED_OUTCOME: PlanOutcome = {
  kind: 'failed',
  failure: { kind: 'interpretation_failed' },
};

function routeForm(): FormData {
  const formData = new FormData();
  formData.set('sentence', '성수동에서 걷고 싶어');
  return formData;
}

describe('planRouteAction 스팟 저장소', () => {
  it('500자 대화에서도 최신 시간 정정이 잘리지 않는다', async () => {
    domain.loadSpots.mockResolvedValue({ spots: [], error: null });
    domain.planRoute.mockResolvedValue(FAILED_OUTCOME);
    const form = new FormData();
    const correction = '내일 오후 2시부터 4시까지 성수동';
    form.set('sentence', correction);
    form.set('history', '예전 대화'.repeat(100));
    const result = await planRouteAction({ status: 'idle' }, form);
    expect(result.status).toBe('done');
    const { sentence } = domain.planRoute.mock.calls[0]?.[0] as {
      sentence: string;
    };
    expect(sentence.length).toBeLessThanOrEqual(500);
    expect(sentence.endsWith(`\n${correction}`)).toBe(true);
  });
  beforeEach(() => {
    domain.loadSpots.mockReset();
    domain.planRoute.mockReset();
    domain.toRouteCandidate.mockReset();
  });

  it('저장 스팟 조회에 실패하면 빈 후보로 계획하지 않고 오류 상태를 돌려준다', async () => {
    domain.loadSpots.mockResolvedValue({
      spots: [],
      error: { kind: 'query', message: 'permission denied' },
    });

    await expect(
      planRouteAction({ status: 'idle' }, routeForm()),
    ).resolves.toEqual({ status: 'load_failed' });
    expect(domain.toRouteCandidate).not.toHaveBeenCalled();
    expect(domain.planRoute).not.toHaveBeenCalled();
  });

  it('성공한 DB 목록만 후보로 바꾸며 출처 표시는 상태에 싣지 않는다', async () => {
    const candidate = {
      id: SPOT.id,
      name: SPOT.name,
      category: SPOT.category,
      coord: SPOT.coordinates,
    };
    domain.loadSpots.mockResolvedValue({ spots: [SPOT], error: null });
    domain.toRouteCandidate.mockReturnValue(candidate);
    domain.planRoute.mockResolvedValue(FAILED_OUTCOME);

    await expect(
      planRouteAction({ status: 'idle' }, routeForm()),
    ).resolves.toEqual({
      status: 'done',
      sentence: '성수동에서 걷고 싶어',
      outcome: FAILED_OUTCOME,
    });
    expect(domain.toRouteCandidate).toHaveBeenCalledWith(SPOT, 0, [SPOT]);
    expect(domain.planRoute).toHaveBeenCalledWith(
      expect.objectContaining({ spots: [candidate] }),
    );
  });
});
