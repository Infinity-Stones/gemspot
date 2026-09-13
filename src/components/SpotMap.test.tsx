import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapMarker } from './SpotMap';
import { SpotMap } from './SpotMap';

class FakeLatLng {
  readonly _brand = 'naverLatLng';
  readonly latitude: number;
  readonly longitude: number;

  constructor(latitude: number, longitude: number) {
    this.latitude = latitude;
    this.longitude = longitude;
  }
}

class FakePoint {
  readonly _brand = 'naverPoint';
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class FakeMap {
  static instances: FakeMap[] = [];

  readonly setCenter = vi.fn();
  readonly setZoom = vi.fn();
  readonly fitBounds = vi.fn();
  readonly destroy = vi.fn();
  readonly getBounds = vi.fn(() => ({ hasLatLng: () => true }));

  constructor(_element: HTMLElement, _options: unknown) {
    FakeMap.instances.push(this);
  }
}

class FakeMarker {
  static instances: FakeMarker[] = [];

  readonly setMap = vi.fn();
  readonly options: unknown;

  constructor(options: unknown) {
    this.options = options;
    FakeMarker.instances.push(this);
  }
}

const eventApi = {
  listeners: [] as { target: unknown; event: string; handler: () => void }[],
  removed: [] as unknown[],
  addListener(target: unknown, event: string, handler: () => void) {
    const listener = { target, event, handler };
    this.listeners.push(listener);
    return listener;
  },
  removeListener(listener: unknown) {
    this.removed.push(listener);
  },
};

const MARKERS: readonly MapMarker[] = [
  { id: 'a', name: 'A', latitude: 37.5, longitude: 127 },
  { id: 'b', name: 'B', latitude: 37.6, longitude: 126.9 },
];

function installNaverMaps() {
  Object.assign(globalThis, {
    naver: {
      maps: {
        LatLng: FakeLatLng,
        Point: FakePoint,
        Map: FakeMap,
        Marker: FakeMarker,
        Event: eventApi,
        Position: { BOTTOM_LEFT: 8 },
      },
    },
  });
}

describe('SpotMap 범위와 정리', () => {
  beforeEach(() => {
    FakeMap.instances = [];
    FakeMarker.instances = [];
    eventApi.listeners = [];
    eventApi.removed = [];
    document.getElementById('naver-maps-sdk')?.remove();
    installNaverMaps();
  });

  it('화면을 떠날 때 마커와 리스너를 먼저 정리하고 지도를 파괴한다', async () => {
    const { unmount } = render(
      <SpotMap
        latitude={37.5}
        longitude={127}
        placeName="선택한 스팟"
        markers={MARKERS}
        hasLocationDot
      />,
    );
    await waitFor(() => expect(FakeMarker.instances).toHaveLength(4));

    const map = FakeMap.instances[0];
    for (const marker of FakeMarker.instances) {
      marker.setMap.mockImplementation(() => {
        if (map.destroy.mock.calls.length > 0) {
          throw new Error('파괴된 지도에서는 마커를 분리할 수 없습니다');
        }
      });
    }
    map.destroy.mockImplementation(() => {
      for (const listener of eventApi.listeners) {
        expect(eventApi.removed).toContain(listener);
      }
    });

    expect(unmount).not.toThrow();
    for (const marker of FakeMarker.instances) {
      expect(marker.setMap).toHaveBeenCalledWith(null);
    }
    expect(map.destroy).toHaveBeenCalledOnce();
  });

  it('인증 실패로 SDK가 제거되어도 재렌더와 화면 이동이 실패하지 않는다', async () => {
    const { rerender, unmount } = render(
      <SpotMap
        latitude={37.5}
        longitude={127}
        placeName="선택한 스팟"
        markers={MARKERS}
      />,
    );
    await waitFor(() => expect(FakeMarker.instances).toHaveLength(3));
    const map = FakeMap.instances[0];
    const invalidSdk = () => {
      throw new Error('인증 실패로 SDK가 제거되었습니다');
    };
    map.destroy.mockImplementation(invalidSdk);
    map.setCenter.mockImplementation(invalidSdk);
    for (const marker of FakeMarker.instances)
      marker.setMap.mockImplementation(invalidSdk);
    Object.assign(globalThis, { naver: { maps: null } });

    expect(() =>
      rerender(
        <SpotMap
          latitude={37.6}
          longitude={127}
          placeName="다른 스팟"
          markers={MARKERS}
        />,
      ),
    ).not.toThrow();
    expect(unmount).not.toThrow();
    expect(map.destroy).not.toHaveBeenCalled();
    expect(eventApi.removed).toHaveLength(0);
  });

  it.each(['loaded', 'failed'])(
    'SDK script가 %s 상태인데 전역 객체가 없으면 재진입 로딩을 끝낸다',
    async state => {
      Object.assign(globalThis, { naver: { maps: null } });
      const script = document.createElement('script');
      script.id = 'naver-maps-sdk';
      script.dataset['state'] = state;
      document.head.appendChild(script);
      const onSettled = vi.fn();

      render(
        <SpotMap
          latitude={37.5}
          longitude={127}
          placeName="선택한 스팟"
          onSettled={onSettled}
        />,
      );

      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          '지도를 불러오지 못했습니다.',
        ),
      );
      expect(onSettled).toHaveBeenCalledOnce();
      expect(FakeMap.instances).toHaveLength(0);
      script.remove();
    },
  );

  it('여러 핀의 범위를 한 번 맞추고 목록 변경 때 이전 마커를 걷는다', async () => {
    const { rerender, unmount } = render(
      <SpotMap
        latitude={MARKERS[0].latitude}
        longitude={MARKERS[0].longitude}
        placeName="저장한 스팟"
        hasMarker={false}
        markers={MARKERS}
        fitMarkers
      />,
    );

    await waitFor(() => {
      expect(FakeMap.instances).toHaveLength(1);
      expect(FakeMarker.instances).toHaveLength(2);
    });
    const map = FakeMap.instances[0];
    expect(map.fitBounds).toHaveBeenCalledOnce();
    expect(map.fitBounds).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ latitude: 37.5, longitude: 127 }),
        expect.objectContaining({ latitude: 37.6, longitude: 126.9 }),
      ]),
      { top: 48, right: 48, bottom: 48, left: 48 },
    );

    const previousMarkers = [...FakeMarker.instances];
    rerender(
      <SpotMap
        latitude={MARKERS[1].latitude}
        longitude={MARKERS[1].longitude}
        placeName="저장한 스팟"
        hasMarker={false}
        markers={[MARKERS[1]]}
        fitMarkers
      />,
    );

    await waitFor(() => {
      for (const marker of previousMarkers)
        expect(marker.setMap).toHaveBeenCalledWith(null);
      expect(eventApi.removed.length).toBeGreaterThan(0);
    });
    expect(map.setZoom).toHaveBeenCalledWith(16);

    unmount();
    expect(map.destroy).toHaveBeenCalledOnce();
  });
});
