import { render, waitFor } from '@testing-library/react';
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
    installNaverMaps();
  });

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
