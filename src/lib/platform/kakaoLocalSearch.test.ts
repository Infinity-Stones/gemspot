import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseLocalPlace, searchLocalPlaces } from './kakaoLocalSearch';

const DOCUMENT = {
  id: '123',
  place_name: '블루보틀 성수 카페',
  category_name: '음식점 > 카페',
  road_address_name: '서울 성동구 아차산로 7',
  address_name: '서울 성동구 성수동1가 656-302',
  x: '127.0454',
  y: '37.5482',
};
const RESPONSE = {
  meta: { is_end: true, total_count: 1 },
  documents: [DOCUMENT],
};

function respondWith(body: unknown, status = 200): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

describe('카카오 Local 키워드 검색', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('서버 REST API 키로 인증하고 인코딩된 상호명 검색 조건을 보낸다', async () => {
    vi.stubEnv('KAKAO_REST_API_KEY', ' server-key ');
    const fetchImpl = respondWith(RESPONSE);
    const result = await searchLocalPlaces(' 성수 카페 & 디저트 ', {
      fetchImpl,
    });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const request = new URL(url);
    expect(request.origin + request.pathname).toBe(
      'https://dapi.kakao.com/v2/local/search/keyword.json',
    );
    expect(Object.fromEntries(request.searchParams)).toEqual({
      query: '성수 카페 & 디저트',
      size: '15',
      page: '1',
      sort: 'accuracy',
    });
    expect(init.headers).toMatchObject({ Authorization: 'KakaoAK server-key' });
    expect(url).not.toContain('server-key');
    expect(result).toEqual({
      ok: true,
      places: [
        {
          name: DOCUMENT.place_name,
          category: DOCUMENT.category_name,
          roadAddress: DOCUMENT.road_address_name,
          jibunAddress: DOCUMENT.address_name,
        },
      ],
    });
  });

  it('도로명 주소가 없으면 지번을 남기고 이름 없는 항목은 버린다', async () => {
    const result = await searchLocalPlaces('블루보틀', {
      apiKey: 'key',
      fetchImpl: respondWith({
        documents: [
          { ...DOCUMENT, road_address_name: '' },
          { ...DOCUMENT, place_name: ' ' },
          null,
        ],
      }),
    });
    expect(result).toEqual({
      ok: true,
      places: [
        {
          name: DOCUMENT.place_name,
          category: DOCUMENT.category_name,
          roadAddress: '',
          jibunAddress: DOCUMENT.address_name,
        },
      ],
    });
  });

  it('상호의 일반 텍스트는 HTML로 해석하거나 지우지 않는다', () => {
    expect(
      parseLocalPlace({ ...DOCUMENT, place_name: ' 카페 <별> & 달 ' })?.name,
    ).toBe('카페 <별> & 달');
  });

  it.each([null, '', '   '])(
    '키가 없으면 외부 요청을 하지 않는다: %s',
    async apiKey => {
      const fetchImpl = respondWith(RESPONSE);
      await expect(
        searchLocalPlaces('카페', { apiKey, fetchImpl }),
      ).resolves.toEqual({ ok: false, error: { kind: 'no_api_key' } });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('빈 검색어는 외부 요청 없이 빈 목록이다', async () => {
    const fetchImpl = respondWith(RESPONSE);
    await expect(
      searchLocalPlaces(' ', { apiKey: 'key', fetchImpl }),
    ).resolves.toEqual({ ok: true, places: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 500])(
    'HTTP %s 실패를 검색 결과 없음으로 바꾸지 않는다',
    async status => {
      await expect(
        searchLocalPlaces('카페', {
          apiKey: 'key',
          fetchImpl: respondWith({ message: 'failed' }, status),
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: { kind: 'http', error: { kind: 'status', status } },
      });
    },
  );

  it.each([null, {}, { documents: null }, { documents: 'invalid' }])(
    '잘못된 응답은 파싱 실패로 처리한다',
    async body => {
      await expect(
        searchLocalPlaces('카페', {
          apiKey: 'key',
          fetchImpl: respondWith(body),
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: { kind: 'http', error: { kind: 'parse' } },
      });
    },
  );

  it('정상적인 검색 결과 0건을 구분한다', async () => {
    await expect(
      searchLocalPlaces('없는 가게', {
        apiKey: 'key',
        fetchImpl: respondWith({ documents: [] }),
      }),
    ).resolves.toEqual({ ok: true, places: [] });
  });
});
