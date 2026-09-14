import { describe, expect, it, vi } from 'vitest';
import type { AreaSearchFn, GeocodeFn } from './startPoint';
import { resolveArea } from './startPoint';

const hit = {
  coord: { latitude: 37.5447, longitude: 127.0557 },
  roadAddress: '서울특별시 성동구 성수동1가',
  jibunAddress: '',
  region: { sido: '서울특별시', sigugun: '성동구' },
};
const emptyGeocode: GeocodeFn = () =>
  Promise.resolve({ ok: true, data: { totalCount: 0, hits: [] } });
const emptySearch: AreaSearchFn = () =>
  Promise.resolve({ ok: true, places: [] });
const cafeStreet = {
  name: '성수동카페거리',
  category: '여행 > 관광,명소 > 테마거리 > 카페거리',
  coordinates: hit.coord,
  roadAddress: '',
  jibunAddress: '서울 성동구 성수동2가 276-5',
};

describe('resolveArea', () => {
  it('주소가 있으면 그 좌표를 사용하고 추가 장소 검색은 하지 않는다', async () => {
    const geocode: GeocodeFn = () =>
      Promise.resolve({ ok: true, data: { totalCount: 1, hits: [hit] } });
    const search = vi.fn(emptySearch);
    await expect(resolveArea('성수동', geocode, search)).resolves.toEqual({
      kind: 'found',
      center: hit.coord,
      label: hit.roadAddress,
    });
    expect(search).not.toHaveBeenCalled();
  });
  it.each(['성수 카페거리', '성수카페거리', '성수동 카페거리'])(
    '주소가 아닌 %s는 등록된 카페거리 좌표로 찾는다',
    async name => {
      const search = vi.fn<AreaSearchFn>(() =>
        Promise.resolve({
          ok: true,
          places: [
            { ...cafeStreet, name: '서울숲카페거리' },
            { ...cafeStreet, name: '라무진 성수카페거리점' },
            cafeStreet,
          ],
        }),
      );
      await expect(resolveArea(name, emptyGeocode, search)).resolves.toEqual({
        kind: 'found',
        center: hit.coord,
        label: '성수동카페거리 · 서울 성동구 성수동2가 276-5',
      });
      expect(search).toHaveBeenCalledWith(name);
    },
  );
  it('거리 이름이 포함된 개별 업체를 출발점으로 대신 고르지 않는다', async () => {
    const search: AreaSearchFn = () =>
      Promise.resolve({
        ok: true,
        places: [{ ...cafeStreet, name: '라무진 성수카페거리점' }],
      });
    await expect(
      resolveArea('성수 카페거리', emptyGeocode, search),
    ).resolves.toEqual({ kind: 'not_found' });
  });
  it('두 검색 모두 0건이면 not_found', async () => {
    await expect(
      resolveArea('없는동', emptyGeocode, emptySearch),
    ).resolves.toEqual({ kind: 'not_found' });
  });
  it('장소 검색 장애를 지역이 없다는 안내로 바꾸지 않는다', async () => {
    const search: AreaSearchFn = () =>
      Promise.resolve({
        ok: false,
        error: {
          kind: 'http',
          error: { kind: 'status', status: 503, message: 'unavailable' },
        },
      });
    await expect(
      resolveArea('성수 카페거리', emptyGeocode, search),
    ).resolves.toMatchObject({ kind: 'failed' });
  });
  it('주소 검색 장애가 있어도 장소 검색으로 좌표를 찾을 수 있다', async () => {
    const geocode: GeocodeFn = () =>
      Promise.resolve({ ok: false, error: { kind: 'no_api_key' } });
    const search: AreaSearchFn = () =>
      Promise.resolve({ ok: true, places: [cafeStreet] });
    await expect(
      resolveArea('성수 카페거리', geocode, search),
    ).resolves.toMatchObject({ kind: 'found', center: hit.coord });
  });
});
