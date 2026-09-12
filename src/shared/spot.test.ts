import { describe, expect, it } from 'vitest';
import { isGeoPoint } from './geo';
import { parseSpot } from './spot';

const valid = {
  id: 's1',
  name: '카페 B',
  roadAddress: '서울 성동구 성수이로 20',
  jibunAddress: null,
  coord: { lat: 37.5448, lng: 127.053 },
  region: { sido: '서울특별시', sigugun: '성동구' },
  origin: 'manual',
  category: 'cafe',
};

describe('isGeoPoint', () => {
  it('범위 안의 유한수만', () => {
    expect(isGeoPoint({ lat: 37.5, lng: 127.0 })).toBe(true);
    expect(isGeoPoint({ lat: 91, lng: 0 })).toBe(false);
    expect(isGeoPoint({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isGeoPoint({ lat: '37.5', lng: 127 })).toBe(false);
    expect(isGeoPoint(null)).toBe(false);
  });
});

describe('parseSpot', () => {
  it('정상 건은 계약 모양으로 좁힌다', () => {
    expect(parseSpot(valid)).toEqual(valid);
  });

  it('좌표가 없거나 깨진 건은 null — 저장 전 후보는 여기 들어올 수 없다', () => {
    expect(parseSpot({ ...valid, coord: undefined })).toBeNull();
    expect(parseSpot({ ...valid, coord: { lat: '37', lng: '127' } })).toBeNull();
  });

  it('표에 없는 카테고리 · 모르는 출처는 null', () => {
    expect(parseSpot({ ...valid, category: 'pub' })).toBeNull();
    expect(parseSpot({ ...valid, origin: 'import' })).toBeNull();
  });

  it('region은 없어도 되고, 있으면 둘 다 문자열이어야 한다', () => {
    expect(parseSpot({ ...valid, region: undefined })?.region).toBeNull();
    expect(parseSpot({ ...valid, region: { sido: '서울' } })).toBeNull();
  });
});
