import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveSpotInput, SaveSpotOutcome } from '@/domain/spot';
import { saveSpot } from '@/domain/spot';
import { registerSpotsAction } from './actions';

/**
 * 이 액션이 지키는 것은 조립이 아니라 **입력을 좁히는 규칙과 부분 실패**다.
 * 저장 자체는 도메인의 `saveSpot`이 하고 그쪽에 자기 테스트가 있다.
 */
vi.mock('@/domain/spot', () => ({ saveSpot: vi.fn() }));

const saveSpotMock = vi.mocked(saveSpot);

function saved(id: string, name: string): SaveSpotOutcome {
  return {
    kind: 'saved',
    spot: {
      id,
      name,
      roadAddress: '서울특별시 용산구 한강대로 56-1',
      jibunAddress: null,
      coordinates: { latitude: 37.5299, longitude: 126.9648 },
      region: { sido: '서울특별시', sigugun: '용산구' },
      category: 'other',
      origin: 'ocr',
    },
  };
}

const PIROUETTES = {
  candidateId: 'c1',
  name: '피롤츠 커피하우스',
  address: '서울 용산구 한강대로 56-1',
  category: 'cafe',
} as const;

const TONG = {
  candidateId: 'c2',
  name: '텅 베이커리',
  address: '서울 마포구 와우산로 29길 12',
  category: 'other',
} as const;

function lastInput(): SaveSpotInput {
  const call = saveSpotMock.mock.calls.at(-1);
  if (call === undefined) throw new Error('saveSpot이 불리지 않았다');
  return call[0];
}

describe('registerSpotsAction', () => {
  beforeEach(() => {
    saveSpotMock.mockReset();
    saveSpotMock.mockResolvedValue(saved('spot-1', PIROUETTES.name));
  });

  it('origin을 ocr로 고정한다 — 주소가 어디서 왔는지는 이 입구가 안다', async () => {
    await registerSpotsAction([PIROUETTES]);

    expect(lastInput().origin).toBe('ocr');
  });

  it('화면이 고른 카테고리를 그대로 넘긴다 — 여기서 이름을 보고 추측하지 않는다', async () => {
    await registerSpotsAction([PIROUETTES]);

    expect(lastInput().category).toBe('cafe');
  });

  it('저장한 스팟 id를 후보 id와 짝지어 돌려준다 — 화면이 그것으로 카드를 찾는다', async () => {
    const result = await registerSpotsAction([PIROUETTES]);

    expect(result.registered).toEqual([
      { candidateId: 'c1', name: PIROUETTES.name, spotId: 'spot-1' },
    ]);
    expect(result.rejected).toEqual([]);
  });

  it('한 건이 막혀도 나머지를 시도한다 — 해 보지 않은 것과 막힌 것은 다르다', async () => {
    saveSpotMock
      .mockResolvedValueOnce({
        kind: 'failed',
        failure: { kind: 'address_not_found' },
      })
      .mockResolvedValueOnce(saved('spot-2', TONG.name));

    const result = await registerSpotsAction([PIROUETTES, TONG]);

    expect(saveSpotMock).toHaveBeenCalledTimes(2);
    expect(result.registered).toEqual([
      { candidateId: 'c2', name: TONG.name, spotId: 'spot-2' },
    ]);
    expect(result.rejected).toEqual([
      {
        candidateId: 'c1',
        name: PIROUETTES.name,
        failure: { kind: 'address_not_found' },
      },
    ]);
  });

  it('고른 것이 없으면 저장소를 부르지 않는다', async () => {
    const result = await registerSpotsAction([]);

    expect(saveSpotMock).not.toHaveBeenCalled();
    expect(result).toEqual({ registered: [], rejected: [] });
  });
});
