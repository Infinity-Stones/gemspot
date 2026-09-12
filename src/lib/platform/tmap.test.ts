import { describe, expect, it, vi } from 'vitest';
import { parseWalkingRoute, walkingRoute } from './tmap';

/** TMAP 보행자 응답 픽스처(GeoJSON). 좌표는 [lng, lat]. */
const TMAP_RESPONSE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [127.0557, 37.5447] },
      properties: { totalDistance: 620, totalTime: 480, index: 0, pointIndex: 0, pointType: 'SP' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [127.0557, 37.5447],
          [127.056, 37.544],
        ],
      },
      properties: { index: 1, lineIndex: 0, distance: 300, time: 240 },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [127.056, 37.544],
          [127.056, 37.5424],
        ],
      },
      properties: { index: 2, lineIndex: 1, distance: 320, time: 240 },
    },
  ],
};

function respondWith(body: unknown, init?: ResponseInit): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200, ...init })),
  );
}

describe('parseWalkingRoute', () => {
  it('합계와 경로선을 lat/lng 순으로, 구간 경계의 중복점은 하나로', () => {
    expect(parseWalkingRoute(TMAP_RESPONSE)).toEqual({
      distanceM: 620,
      durationS: 480,
      path: [
        { lat: 37.5447, lng: 127.0557 },
        { lat: 37.544, lng: 127.056 },
        { lat: 37.5424, lng: 127.056 },
      ],
    });
  });

  it('features가 비면 null', () => {
    expect(parseWalkingRoute({ type: 'FeatureCollection', features: [] })).toBeNull();
  });
});

describe('walkingRoute', () => {
  const from = { lat: 37.5447, lng: 127.0557 };
  const to = { lat: 37.5424, lng: 127.056 };

  it('appKey 헤더 · 문자열 좌표 · 인코딩된 이름으로 POST한다', async () => {
    const fetchImpl = respondWith(TMAP_RESPONSE);
    const result = await walkingRoute(from, to, { fetchImpl, appKey: 'k' });

    expect(result.ok).toBe(true);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tmap/routes/pedestrian');
    expect(init.headers).toMatchObject({ appKey: 'k' });
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body).toMatchObject({
      startX: '127.0557',
      startY: '37.5447',
      endX: '127.056',
      endY: '37.5424',
      reqCoordType: 'WGS84GEO',
    });
    expect(body['startName']).toBe(encodeURIComponent('출발'));
  });

  it('키가 없으면 호출하지 않고 no_app_key', async () => {
    const fetchImpl = respondWith(TMAP_RESPONSE);
    const result = await walkingRoute(from, to, { fetchImpl, appKey: null });
    expect(result).toEqual({ ok: false, error: { kind: 'no_app_key' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('400은 http/status, 경로 없는 응답은 http/parse', async () => {
    const bad = await walkingRoute(from, to, {
      fetchImpl: respondWith({}, { status: 400, statusText: 'Bad Request' }),
      appKey: 'k',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok && bad.error.kind === 'http') expect(bad.error.error.kind).toBe('status');

    const empty = await walkingRoute(from, to, {
      fetchImpl: respondWith({ features: [] }),
      appKey: 'k',
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok && empty.error.kind === 'http') expect(empty.error.error.kind).toBe('parse');
  });
});
