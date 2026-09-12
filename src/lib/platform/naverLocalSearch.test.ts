import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_SEARCH_MAX_DISPLAY,
  parseLocalPlace,
  searchLocalPlaces,
  stripSearchMarkup,
} from './naverLocalSearch';

/** 문서의 응답 예를 JSON 형식으로 옮긴 픽스처. title에 강조 태그가 섞여 온다. */
const LOCAL_RESPONSE = {
  lastBuildDate: 'Sat, 12 Sep 2026 16:00:00 +0900',
  total: 407,
  start: 1,
  display: 2,
  items: [
    {
      title: '<b>피롤츠</b> 커피하우스',
      link: 'https://example.test/1',
      category: '카페,디저트>카페',
      description: '',
      telephone: '',
      address: '서울특별시 용산구 한강로3가 40-999',
      roadAddress: '서울특별시 용산구 한강대로 56-1',
      mapx: '1269648000',
      mapy: '375299000',
    },
    {
      title: '조선옥 &amp; 갈비',
      link: '',
      category: '한식>육류,고기요리',
      description: '연탄불 한우갈비 전문점.',
      telephone: '',
      address: '서울특별시 중구 을지로3가 229-1',
      roadAddress: '',
      mapx: '1269900000',
      mapy: '375660000',
    },
  ],
};

function respondWith(body: unknown, init?: ResponseInit): typeof fetch {
  return vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200, ...init })));
}

describe('stripSearchMarkup', () => {
  it('강조 태그와 HTML 엔티티를 벗긴다', () => {
    expect(stripSearchMarkup('<b>피롤츠</b> 커피하우스')).toBe('피롤츠 커피하우스');
    expect(stripSearchMarkup('조선옥 &amp; 갈비')).toBe('조선옥 & 갈비');
    expect(stripSearchMarkup('  카페 &#39;별&#39;  ')).toBe("카페 '별'");
  });
});

describe('parseLocalPlace', () => {
  it('address가 지번, roadAddress가 도로명이다', () => {
    expect(parseLocalPlace(LOCAL_RESPONSE.items[0])).toEqual({
      name: '피롤츠 커피하우스',
      category: '카페,디저트>카페',
      roadAddress: '서울특별시 용산구 한강대로 56-1',
      jibunAddress: '서울특별시 용산구 한강로3가 40-999',
    });
  });

  it('좌표(mapx · mapy)를 읽지 않는다 — 좌표의 출처는 Geocoding 하나다', () => {
    const place = parseLocalPlace(LOCAL_RESPONSE.items[0]);
    expect(place).not.toHaveProperty('mapx');
    expect(place).not.toHaveProperty('coordinates');
    expect(Object.keys(place ?? {})).toEqual(['name', 'category', 'roadAddress', 'jibunAddress']);
  });

  it('이름이 없으면 그 건만 버린다', () => {
    expect(parseLocalPlace({ ...LOCAL_RESPONSE.items[0], title: '' })).toBeNull();
    expect(parseLocalPlace('문자열')).toBeNull();
  });
});

describe('searchLocalPlaces', () => {
  it('검색 전용 헤더를 붙여 부르고 items를 계약으로 옮긴다', async () => {
    const fetchImpl = respondWith(LOCAL_RESPONSE);
    const result = await searchLocalPlaces('피롤츠', {
      fetchImpl,
      clientId: 'id',
      clientSecret: 'secret',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.places.map(p => p.name)).toEqual(['피롤츠 커피하우스', '조선옥 & 갈비']);

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/search/local.json');
    // Maps의 x-ncp-* 헤더가 아니다. 다른 콘솔, 다른 키.
    expect(init.headers).toMatchObject({ 'X-Naver-Client-Id': 'id', 'X-Naver-Client-Secret': 'secret' });
  });

  it('display는 1~5로 자른다 — 문서상 최댓값이 5다', async () => {
    const fetchImpl = respondWith(LOCAL_RESPONSE);
    await searchLocalPlaces('x', { fetchImpl, clientId: 'id', clientSecret: 'secret', display: 50 });
    expect(new URL(vi.mocked(fetchImpl).mock.calls[0]?.[0] as string).searchParams.get('display')).toBe(
      String(LOCAL_SEARCH_MAX_DISPLAY),
    );
  });

  it('키가 하나라도 없으면 호출하지 않고 no_api_key', async () => {
    const fetchImpl = respondWith(LOCAL_RESPONSE);
    await expect(
      searchLocalPlaces('x', { fetchImpl, clientId: 'id', clientSecret: null }),
    ).resolves.toEqual({ ok: false, error: { kind: 'no_api_key' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('인증 실패(401)는 http로 감싼다', async () => {
    const result = await searchLocalPlaces('x', {
      fetchImpl: respondWith({ errorCode: '024' }, { status: 401, statusText: 'Unauthorized' }),
      clientId: 'bad',
      clientSecret: 'bad',
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'http') expect(result.error.error.kind).toBe('status');
  });

  it('items가 없으면 빈 목록이다 — 오류가 아니다', async () => {
    const result = await searchLocalPlaces('x', {
      fetchImpl: respondWith({ total: 0, items: [] }),
      clientId: 'id',
      clientSecret: 'secret',
    });
    expect(result).toEqual({ ok: true, places: [] });
  });
});
