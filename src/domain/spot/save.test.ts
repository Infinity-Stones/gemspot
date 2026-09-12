import { describe, expect, it, vi } from 'vitest';
import type { GeocodeOutcome } from '@/lib/platform/naverGeocoding';
import type { WriteStoredSpotResult } from '@/lib/platform/spotStorage';
import {
  ADDRESS_SEARCH_COUNT,
  locateAddress,
  saveSpot,
  searchAddress,
} from './save';

const HIT = {
  coord: { latitude: 37.5299, longitude: 126.9648 },
  roadAddress: '서울특별시 용산구 한강대로 56-1',
  jibunAddress: '서울특별시 용산구 한강로3가 40-999',
  region: { sido: '서울특별시', sigugun: '용산구' },
};
const found: GeocodeOutcome = {
  ok: true,
  data: { totalCount: 1, hits: [HIT] },
};
const notFound: GeocodeOutcome = {
  ok: true,
  data: { totalCount: 0, hits: [] },
};
const noKey: GeocodeOutcome = { ok: false, error: { kind: 'no_api_key' } };

const SAVED_SPOT = {
  id: '5f6d1c2e-0000-4000-8000-000000000002',
  name: '피롤츠 커피하우스',
  roadAddress: HIT.roadAddress,
  jibunAddress: HIT.jibunAddress,
  coordinates: { latitude: 37.5299, longitude: 126.9648 },
  region: { sido: '서울특별시', sigugun: '용산구' },
  category: 'cafe',
  origin: 'manual',
} as const;
const writing = (result: WriteStoredSpotResult) =>
  vi.fn(() => Promise.resolve(result));

const input = {
  name: '피롤츠 커피하우스',
  address: '서울 용산구 한강대로 56-1',
  category: 'cafe' as const,
  origin: 'manual' as const,
};

describe('locateAddress', () => {
  it('좌표가 있으면 ready, 0건이면 not_found, 키 없음은 unavailable', async () => {
    await expect(
      locateAddress('x', { geocode: () => Promise.resolve(found) }),
    ).resolves.toMatchObject({
      kind: 'ready',
      location: { coordinates: HIT.coord, roadAddress: HIT.roadAddress },
    });
    await expect(
      locateAddress('x', { geocode: () => Promise.resolve(notFound) }),
    ).resolves.toEqual({ kind: 'not_found' });
    await expect(
      locateAddress('x', { geocode: () => Promise.resolve(noKey) }),
    ).resolves.toEqual({
      kind: 'unavailable',
      reason: 'no_api_key',
    });
  });
});

describe('searchAddress — 후보를 여러 건 받아 고르게 한다', () => {
  const second = {
    ...HIT,
    roadAddress: '서울특별시 용산구 한강대로 56-2',
    jibunAddress: '',
  };
  const dupJibun = { ...HIT, roadAddress: '' }; // 같은 곳이 지번으로 한 번 더

  it('count를 넘겨 부르고, 좌표 있는 후보 전부를 순서대로 돌려준다', async () => {
    const geocode = vi.fn(() =>
      Promise.resolve({
        ok: true,
        data: { totalCount: 2, hits: [HIT, second] },
      } as GeocodeOutcome),
    );
    const result = await searchAddress('한강대로 56', { geocode });
    expect(geocode).toHaveBeenCalledWith('한강대로 56', {
      count: ADDRESS_SEARCH_COUNT,
    });
    expect(result.kind).toBe('results');
    if (result.kind === 'results')
      expect(result.candidates.map(c => c.roadAddress)).toEqual([
        HIT.roadAddress,
        second.roadAddress,
      ]);
  });

  it('같은 주소가 도로명 · 지번으로 겹치면 하나로 접는다', async () => {
    const result = await searchAddress('x', {
      geocode: () =>
        Promise.resolve({
          ok: true,
          data: {
            totalCount: 2,
            hits: [HIT, { ...dupJibun, jibunAddress: HIT.roadAddress }],
          },
        }),
    });
    if (result.kind === 'results') expect(result.candidates).toHaveLength(1);
    else throw new Error('expected results');
  });

  it('0건은 not_found, 키 없음은 unavailable', async () => {
    await expect(
      searchAddress('x', { geocode: () => Promise.resolve(notFound) }),
    ).resolves.toEqual({ kind: 'not_found' });
    await expect(
      searchAddress('x', { geocode: () => Promise.resolve(noKey) }),
    ).resolves.toMatchObject({ kind: 'unavailable' });
  });
});

describe('saveSpot — 좌표가 나오지 않으면 저장하지 않는다(T22)', () => {
  it('주소가 좌표로 바뀌지 않으면 insert를 부르지 않는다', async () => {
    const write = writing({ ok: true, spot: SAVED_SPOT });
    const outcome = await saveSpot(input, {
      geocode: () => Promise.resolve(notFound),
      write,
    });
    expect(outcome).toEqual({
      kind: 'failed',
      failure: { kind: 'address_not_found' },
    });
    expect(write).not.toHaveBeenCalled();
  });

  it('Geocoding이 불가하면(키 없음 · 네트워크) 저장하지 않는다', async () => {
    const write = writing({ ok: true, spot: SAVED_SPOT });
    const outcome = await saveSpot(input, {
      geocode: () => Promise.resolve(noKey),
      write,
    });
    expect(outcome).toEqual({
      kind: 'failed',
      failure: { kind: 'geocoding_unavailable' },
    });
    expect(write).not.toHaveBeenCalled();
  });

  it('빈 이름 · 빈 주소는 Geocoding도 부르지 않는다', async () => {
    const geocode = vi.fn(() => Promise.resolve(found));
    await expect(
      saveSpot({ ...input, name: '  ' }, { geocode }),
    ).resolves.toEqual({
      kind: 'failed',
      failure: { kind: 'invalid_input', field: 'name' },
    });
    await expect(
      saveSpot({ ...input, address: '' }, { geocode }),
    ).resolves.toEqual({
      kind: 'failed',
      failure: { kind: 'invalid_input', field: 'address' },
    });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('좌표가 있으면 Geocoding 결과의 주소 · 지역으로 행을 만들어 저장하고, 저장된 행을 돌려준다', async () => {
    const write = writing({ ok: true, spot: SAVED_SPOT });
    const outcome = await saveSpot(input, {
      geocode: () => Promise.resolve(found),
      write,
    });

    expect(write).toHaveBeenCalledWith({
      name: '피롤츠 커피하우스',
      roadAddress: HIT.roadAddress,
      jibunAddress: HIT.jibunAddress,
      coordinates: { latitude: 37.5299, longitude: 126.9648 },
      region: { sido: '서울특별시', sigugun: '용산구' },
      category: 'cafe',
      origin: 'manual',
    });
    expect(outcome).toMatchObject({
      kind: 'saved',
      spot: { id: SAVED_SPOT.id, name: '피롤츠 커피하우스' },
    });
  });

  it('저장소가 없으면 store_unconfigured — 시드에 끼워 넣지 않는다', async () => {
    const outcome = await saveSpot(input, {
      geocode: () => Promise.resolve(found),
      write: writing({ ok: false, error: { kind: 'unconfigured' } }),
    });
    expect(outcome).toEqual({
      kind: 'failed',
      failure: { kind: 'store_unconfigured' },
    });
  });

  it('DB 오류는 store_error로 메시지와 함께', async () => {
    const outcome = await saveSpot(input, {
      geocode: () => Promise.resolve(found),
      write: writing({
        ok: false,
        error: { kind: 'query', message: 'check constraint' },
      }),
    });
    expect(outcome).toEqual({
      kind: 'failed',
      failure: { kind: 'store_error', message: 'check constraint' },
    });
  });
});
