import { describe, expect, it, vi } from 'vitest';
import type { GeocodeResult } from '@/lib/platform/naverGeocoding';
import type { GeocodedSpotLocation } from './geocoding';
import { prepareGeocodedLocation } from './geocoding';

const LOCATION: GeocodedSpotLocation = {
  coordinates: { latitude: 37.5447, longitude: 127.0557 },
  roadAddress: '서울특별시 성동구 아차산로 17',
  jibunAddress: '서울특별시 성동구 성수동1가 656-335',
  region: { sido: '서울특별시', sigugun: '성동구' },
};

function geocodeResult(overrides: Partial<GeocodeResult> = {}): GeocodeResult {
  return {
    totalCount: 1,
    hits: [
      {
        coord: LOCATION.coordinates,
        roadAddress: LOCATION.roadAddress,
        jibunAddress: LOCATION.jibunAddress,
        region: { sido: '서울특별시', sigugun: '성동구' },
      },
    ],
    ...overrides,
  };
}

describe('prepareGeocodedLocation', () => {
  it('좌표와 도로명·지번 주소를 저장 가능한 모양으로 그대로 보존한다', () => {
    expect(prepareGeocodedLocation(geocodeResult())).toEqual({
      kind: 'ready',
      location: LOCATION,
    });
  });

  it('totalCount가 0이면 저장 가능한 값을 만들지 않는다', () => {
    const save = vi.fn<(location: GeocodedSpotLocation) => void>();
    const result = prepareGeocodedLocation(
      geocodeResult({ totalCount: 0, hits: [] }),
    );

    if (result.kind === 'ready') save(result.location);

    expect(result).toEqual({ kind: 'not_found' });
    expect(save).not.toHaveBeenCalled();
  });

  it('응답 건수는 있지만 유효 좌표가 하나도 없으면 저장 단계로 넘기지 않는다', () => {
    const save = vi.fn<(location: GeocodedSpotLocation) => void>();
    const result = prepareGeocodedLocation(geocodeResult({ hits: [] }));

    if (result.kind === 'ready') save(result.location);

    expect(result).toEqual({ kind: 'not_found' });
    expect(save).not.toHaveBeenCalled();
  });

  it('지역 정보가 없으면 저장 계약의 nullable 필드로 옮긴다', () => {
    const result = prepareGeocodedLocation(
      geocodeResult({
        hits: [
          {
            coord: LOCATION.coordinates,
            roadAddress: LOCATION.roadAddress,
            jibunAddress: LOCATION.jibunAddress,
            region: null,
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      kind: 'ready',
      location: { region: { sido: null, sigugun: null } },
    });
  });
});
