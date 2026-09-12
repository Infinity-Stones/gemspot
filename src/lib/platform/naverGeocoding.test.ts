import { describe, expect, it, vi } from 'vitest';
import { geocodeAddress, parseGeocodeHit } from './naverGeocoding';

/** 네이버 Geocoding 응답 픽스처. x · y가 문자열로 온다. */
const NAVER_RESPONSE = {
  status: 'OK',
  meta: { totalCount: 1, page: 1, count: 1 },
  addresses: [
    {
      roadAddress: '서울특별시 성동구 성수동1가 685-696',
      jibunAddress: '서울특별시 성동구 성수동1가 685-696',
      x: '127.0557',
      y: '37.5447',
      addressElements: [
        { types: ['SIDO'], longName: '서울특별시', shortName: '서울특별시' },
        { types: ['SIGUGUN'], longName: '성동구', shortName: '성동구' },
        { types: ['DONGMYUN'], longName: '성수동1가', shortName: '성수동1가' },
      ],
    },
  ],
  errorMessage: '',
};

function respondWith(body: unknown, init?: ResponseInit): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200, ...init })),
  );
}

describe('parseGeocodeHit', () => {
  it('x(경도) · y(위도) 문자열을 숫자 GeoPoint로, SIDO · SIGUGUN을 region으로', () => {
    expect(parseGeocodeHit(NAVER_RESPONSE.addresses[0])).toEqual({
      coord: { latitude: 37.5447, longitude: 127.0557 },
      roadAddress: '서울특별시 성동구 성수동1가 685-696',
      jibunAddress: '서울특별시 성동구 성수동1가 685-696',
      region: { sido: '서울특별시', sigugun: '성동구' },
    });
  });

  it('좌표가 숫자로 안 바뀌면 그 건은 버린다', () => {
    expect(parseGeocodeHit({ x: 'abc', y: '37' })).toBeNull();
  });

  it('SIDO · SIGUGUN 중 한쪽만 와도 T03 지역 계약에 남은 값을 보존한다', () => {
    expect(
      parseGeocodeHit({
        ...NAVER_RESPONSE.addresses[0],
        addressElements: [{ types: ['SIDO'], longName: '세종특별자치시' }],
      }),
    ).toMatchObject({ region: { sido: '세종특별자치시', sigugun: null } });
  });
});

describe('geocodeAddress', () => {
  it('키 헤더를 붙여 query로 묻고 totalCount · hits를 돌려준다', async () => {
    const fetchImpl = respondWith(NAVER_RESPONSE);
    const result = await geocodeAddress('성수동', { fetchImpl, apiKey: 'secret' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalCount).toBe(1);
      expect(result.data.hits[0]?.coord).toEqual({ latitude: 37.5447, longitude: 127.0557 });
    }
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('query=%EC%84%B1%EC%88%98%EB%8F%99');
    expect(init.headers).toMatchObject({ 'x-ncp-apigw-api-key': 'secret' });
  });

  it('totalCount 0은 성공이되 hits가 빈 — "그런 주소가 없다"', async () => {
    const result = await geocodeAddress('없는동', {
      fetchImpl: respondWith({ meta: { totalCount: 0 }, addresses: [] }),
      apiKey: 'secret',
    });
    expect(result).toEqual({ ok: true, data: { totalCount: 0, hits: [] } });
  });

  it('키가 없으면 호출하지 않고 no_api_key', async () => {
    const fetchImpl = respondWith(NAVER_RESPONSE);
    const result = await geocodeAddress('성수동', { fetchImpl, apiKey: null });
    expect(result).toEqual({ ok: false, error: { kind: 'no_api_key' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('HTTP 실패는 http로 감싼다', async () => {
    const result = await geocodeAddress('성수동', {
      fetchImpl: respondWith({}, { status: 401, statusText: 'Unauthorized' }),
      apiKey: 'bad',
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'http') expect(result.error.error.kind).toBe('status');
  });
});
