import { describe, expect, it, vi } from 'vitest';
import type {
  LocalPlace,
  LocalSearchOutcome,
} from '@/lib/platform/kakaoLocalSearch';
import { searchPlaces, toFoundPlace } from './placeSearch';

const WITH_ROAD: LocalPlace = {
  name: '피롤츠 커피하우스',
  category: '카페,디저트>카페',
  roadAddress: '서울특별시 용산구 한강대로 56-1',
  jibunAddress: '서울특별시 용산구 한강로3가 40-999',
};
const JIBUN_ONLY: LocalPlace = {
  name: '조선옥',
  category: '한식',
  roadAddress: '',
  jibunAddress: '서울특별시 중구 을지로3가 229-1',
};
const NO_ADDRESS: LocalPlace = {
  name: '주소 없는 곳',
  category: '',
  roadAddress: '',
  jibunAddress: '',
};

const returning = (outcome: LocalSearchOutcome) =>
  vi.fn(() => Promise.resolve(outcome));

describe('toFoundPlace', () => {
  it('도로명이 있으면 도로명이 주소, 지번은 보조', () => {
    expect(toFoundPlace(WITH_ROAD)).toEqual({
      name: '피롤츠 커피하우스',
      category: '카페,디저트>카페',
      address: '서울특별시 용산구 한강대로 56-1',
      secondaryAddress: '서울특별시 용산구 한강로3가 40-999',
    });
  });

  it('지번만 있으면 지번이 주소이고 보조는 없다', () => {
    expect(toFoundPlace(JIBUN_ONLY)).toMatchObject({
      address: '서울특별시 중구 을지로3가 229-1',
      secondaryAddress: null,
    });
  });

  it('주소가 없으면 null — 좌표를 얻을 수 없어 고를 수 없는 후보다', () => {
    expect(toFoundPlace(NO_ADDRESS)).toBeNull();
  });
});

describe('searchPlaces', () => {
  it('주소 있는 건만 남긴다', async () => {
    const result = await searchPlaces('커피', {
      search: returning({
        ok: true,
        places: [WITH_ROAD, NO_ADDRESS, JIBUN_ONLY],
      }),
    });
    expect(result.kind).toBe('results');
    if (result.kind === 'results')
      expect(result.places.map(p => p.name)).toEqual([
        '피롤츠 커피하우스',
        '조선옥',
      ]);
  });

  it('결과가 없거나 전부 주소가 없으면 not_found', async () => {
    await expect(
      searchPlaces('x', { search: returning({ ok: true, places: [] }) }),
    ).resolves.toEqual({
      kind: 'not_found',
    });
    await expect(
      searchPlaces('x', {
        search: returning({ ok: true, places: [NO_ADDRESS] }),
      }),
    ).resolves.toEqual({ kind: 'not_found' });
  });

  it('키 없음과 네트워크 실패를 unavailable로 접되 이유를 가른다', async () => {
    await expect(
      searchPlaces('x', {
        search: returning({ ok: false, error: { kind: 'no_api_key' } }),
      }),
    ).resolves.toEqual({ kind: 'unavailable', reason: 'no_api_key' });
    await expect(
      searchPlaces('x', {
        search: returning({
          ok: false,
          error: { kind: 'http', error: { kind: 'timeout', message: 't' } },
        }),
      }),
    ).resolves.toEqual({ kind: 'unavailable', reason: 'http' });
  });
});
