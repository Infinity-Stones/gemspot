import { afterEach, describe, expect, it, vi } from 'vitest';
import { osmWalkingRoute, parseOsmWalkingRoute } from './osmWalking';

const FROM = { latitude: 37.5447, longitude: 127.0557 };
const TO = { latitude: 37.5424, longitude: 127.056 };
const ROUTE = {
  distance: 441.3,
  duration: 355.2,
  geometry: {
    type: 'LineString',
    coordinates: [
      [127.0557, 37.5447],
      [127.056, 37.5424],
    ],
  },
};
const RESPONSE = { code: 'Ok', routes: [ROUTE] };
const BASE_URL = 'https://walking.example/osrm';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('OSM 도보 경로', () => {
  it('좌표 순서와 거리(m)·시간(초)을 변환한다', () => {
    expect(parseOsmWalkingRoute(RESPONSE)).toEqual({
      distanceM: 441.3,
      durationS: 355.2,
      path: [FROM, TO],
    });
  });

  it.each([
    null,
    { code: 'NoRoute' },
    { code: 'Ok', routes: [] },
    { code: 'Ok', routes: [{ ...ROUTE, distance: -1 }] },
    { code: 'Ok', routes: [{ ...ROUTE, duration: Infinity }] },
    {
      code: 'Ok',
      routes: [
        { ...ROUTE, geometry: { type: 'Point', coordinates: [127, 37] } },
      ],
    },
    {
      code: 'Ok',
      routes: [
        {
          ...ROUTE,
          geometry: {
            type: 'LineString',
            coordinates: [
              [127, 37],
              [127, 91],
              [127.1, 37.1],
            ],
          },
        },
      ],
    },
  ])('경로 없음·잘못된 거리/좌표는 거절한다: %j', raw => {
    expect(parseOsmWalkingRoute(raw)).toBeNull();
  });

  it('서버 환경 설정을 사용하고 GeoJSON 전체 경로를 요청한다', async () => {
    vi.stubEnv('OSM_ROUTING_BASE_URL', `${BASE_URL}/`);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(RESPONSE));
    const result = await osmWalkingRoute(FROM, TO, { fetchImpl });
    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      `${BASE_URL}/route/v1/foot/127.0557,37.5447;127.056,37.5424?geometries=geojson&overview=full&steps=false&radiuses=100;100`,
    );
    expect(new Headers(init?.headers).get('User-Agent')).toContain('Gemspot');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    'file:///tmp/route',
    'not-a-url',
    'https://user:secret@walking.example',
    'https://walking.example?key=secret',
  ])('잘못된 서버 설정은 외부에 요청하지 않는다: %s', async baseUrl => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await osmWalkingRoute(FROM, TO, { baseUrl, fetchImpl });
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([429, 500])('HTTP %s를 실패로 돌려준다', async status => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status }));
    await expect(
      osmWalkingRoute(FROM, TO, { baseUrl: BASE_URL, fetchImpl }),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'status', status } });
  });

  it('타임아웃과 경로 없는 정상 HTTP 응답을 구분한다', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    await expect(
      osmWalkingRoute(FROM, TO, { baseUrl: BASE_URL, fetchImpl }),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'timeout' } });
    fetchImpl.mockResolvedValue(Response.json({ code: 'NoRoute' }));
    await expect(
      osmWalkingRoute(FROM, TO, { baseUrl: BASE_URL, fetchImpl }),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'parse' } });
  });

  it('키 없이 도보 전용 공개 서버를 쓰며 동시 호출은 초당 1회로 제한한다', async () => {
    vi.useFakeTimers();
    vi.stubEnv('OSM_ROUTING_BASE_URL', '');
    const calls: number[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => {
      calls.push(Date.now());
      return Promise.resolve(Response.json(RESPONSE));
    });
    const a = osmWalkingRoute(FROM, TO, { fetchImpl });
    const b = osmWalkingRoute(TO, FROM, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain(
      '/routed-foot/route/v1/foot/',
    );
    await vi.advanceTimersByTimeAsync(1_100);
    await Promise.all([a, b]);
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(1_000);
  });
});
