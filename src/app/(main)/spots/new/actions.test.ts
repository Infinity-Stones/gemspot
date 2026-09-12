import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirect } from 'next/navigation';
import {
  locateAddress,
  saveSpot,
  searchAddress,
  searchPlaces,
} from '@/domain/spot';
import type { FoundPlace, GeocodedSpotLocation } from '@/domain/spot';
import { pinSpotAction } from './actions';
import type { PinFormState } from './pinState';

vi.mock('@/domain/spot', () => ({
  searchPlaces: vi.fn(),
  searchAddress: vi.fn(),
  locateAddress: vi.fn(),
  saveSpot: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect');
  }),
}));

const PLACES: FoundPlace[] = [
  {
    name: '블루보틀 성수',
    address: '서울 성동구 아차산로 7',
    secondaryAddress: null,
    category: '카페',
  },
  {
    name: '블루보틀 삼청',
    address: '서울 종로구 북촌로5길 76',
    secondaryAddress: null,
    category: '카페',
  },
];
const DRAFT = { name: '블루보틀', address: '', category: 'cafe' as const };
const LOCATION: GeocodedSpotLocation = {
  coordinates: { latitude: 37.5801, longitude: 126.9819 },
  roadAddress: PLACES[1].address,
  jibunAddress: '서울 종로구 소격동 86',
  region: { sido: '서울특별시', sigugun: '종로구' },
};
const LOCATED: PinFormState = {
  status: 'located',
  draft: { ...DRAFT, name: PLACES[1].name, address: PLACES[1].address },
  location: LOCATION,
};

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('pinSpotAction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('카카오 키가 없으면 일시 장애와 구분해 연결되지 않은 상태를 알린다', async () => {
    vi.mocked(searchPlaces).mockResolvedValue({
      kind: 'unavailable',
      reason: 'no_api_key',
    });
    await expect(
      pinSpotAction(
        { status: 'idle' },
        form({ ...DRAFT, intent: 'search_place' }),
      ),
    ).resolves.toMatchObject({
      status: 'failed',
      failure: { kind: 'place_search_unconfigured' },
    });
  });

  it('상호명 검색 → 두 번째 가게 선택 → 주소 확인 → 저장 후 해당 핀으로 이동한다', async () => {
    vi.mocked(searchPlaces).mockResolvedValue({
      kind: 'results',
      places: PLACES,
    });
    const searched = await pinSpotAction(
      { status: 'idle' },
      form({ ...DRAFT, intent: 'search_place' }),
    );
    expect(searchPlaces).toHaveBeenCalledWith('블루보틀');
    expect(searched).toEqual({
      status: 'place_searched',
      draft: DRAFT,
      places: PLACES,
    });
    expect(locateAddress).not.toHaveBeenCalled();

    vi.mocked(locateAddress).mockResolvedValue({
      kind: 'ready',
      location: LOCATION,
    });
    const selected = await pinSpotAction(
      searched,
      form({ ...DRAFT, pickPlace: '1' }),
    );
    expect(locateAddress).toHaveBeenCalledWith(PLACES[1].address);
    expect(selected).toEqual(LOCATED);
    expect(saveSpot).not.toHaveBeenCalled();

    vi.mocked(saveSpot).mockResolvedValue({
      kind: 'saved',
      spot: {
        id: 'saved-spot',
        name: PLACES[1].name,
        roadAddress: LOCATION.roadAddress,
        jibunAddress: LOCATION.jibunAddress,
        coordinates: LOCATION.coordinates,
        region: LOCATION.region,
        category: 'cafe',
        origin: 'manual',
      },
    });
    await expect(
      pinSpotAction(selected, form({ ...LOCATED.draft, intent: 'save' })),
    ).rejects.toThrow('redirect');
    expect(saveSpot).toHaveBeenCalledWith({
      ...LOCATED.draft,
      origin: 'manual',
    });
    expect(redirect).toHaveBeenCalledWith('/?result=saved-spot');
  });

  it('상호명 결과가 하나여도 사용자가 고르기 전에는 핀을 확정하지 않는다', async () => {
    vi.mocked(searchPlaces).mockResolvedValue({
      kind: 'results',
      places: [PLACES[0]],
    });
    await expect(
      pinSpotAction(
        { status: 'idle' },
        form({ ...DRAFT, intent: 'search_place' }),
      ),
    ).resolves.toMatchObject({ status: 'place_searched' });
    expect(locateAddress).not.toHaveBeenCalled();
    expect(saveSpot).not.toHaveBeenCalled();
  });

  it.each(['', '-1', '1abc', '0.5', '2', '999999999999999999999'])(
    '잘못된 선택 번호 %s로 다른 가게를 고르지 않는다',
    async pickPlace => {
      const previous: PinFormState = {
        status: 'place_searched',
        draft: DRAFT,
        places: PLACES,
      };
      await expect(
        pinSpotAction(previous, form({ ...DRAFT, pickPlace })),
      ).resolves.toMatchObject({ status: 'invalid', field: 'name' });
      expect(locateAddress).not.toHaveBeenCalled();
      expect(searchAddress).not.toHaveBeenCalled();
    },
  );

  it('미리 본 주소를 바꿔 제출하면 저장을 막는다', async () => {
    await expect(
      pinSpotAction(
        LOCATED,
        form({ ...LOCATED.draft, address: '서울 다른 주소', intent: 'save' }),
      ),
    ).resolves.toMatchObject({ status: 'invalid', field: 'address' });
    expect(saveSpot).not.toHaveBeenCalled();
  });

  it('미리보기 없이 저장을 직접 요청해도 저장하지 않는다', async () => {
    await expect(
      pinSpotAction(
        { status: 'idle' },
        form({ ...LOCATED.draft, intent: 'save' }),
      ),
    ).resolves.toMatchObject({ status: 'invalid', field: 'address' });
    expect(saveSpot).not.toHaveBeenCalled();
  });

  it('가게는 찾았지만 주소 좌표가 없으면 선택한 이름과 주소를 남기고 실패를 알린다', async () => {
    vi.mocked(locateAddress).mockResolvedValue({ kind: 'not_found' });
    await expect(
      pinSpotAction(
        { status: 'place_searched', draft: DRAFT, places: PLACES },
        form({ ...DRAFT, pickPlace: '1' }),
      ),
    ).resolves.toMatchObject({
      status: 'failed',
      draft: LOCATED.draft,
      failure: { kind: 'address_not_found' },
    });
    expect(saveSpot).not.toHaveBeenCalled();
  });

  it('검색 API 인증 실패는 검색 결과 없음과 구분한다', async () => {
    vi.mocked(searchPlaces).mockResolvedValue({
      kind: 'unavailable',
      reason: 'http',
    });
    await expect(
      pinSpotAction(
        { status: 'idle' },
        form({ ...DRAFT, intent: 'search_place' }),
      ),
    ).resolves.toMatchObject({
      status: 'failed',
      failure: { kind: 'place_search_unavailable' },
    });
  });
});
