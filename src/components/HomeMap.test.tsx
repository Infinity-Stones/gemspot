import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapMarker } from './SpotMap';
import { HomeMap } from './HomeMap';

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('./SpotMap', () => ({
  SpotMap: ({
    latitude,
    longitude,
    fitMarkers,
    markers,
  }: {
    latitude: number;
    longitude: number;
    fitMarkers?: boolean;
    markers: readonly MapMarker[];
  }) => (
    <div
      data-testid="spot-map"
      data-latitude={latitude}
      data-longitude={longitude}
      data-fit-markers={String(fitMarkers)}
      data-marker-count={markers.length}
    />
  ),
}));

const MARKERS: readonly MapMarker[] = [
  {
    id: 'first',
    name: '첫 스팟',
    latitude: 37.54,
    longitude: 127.05,
  },
  {
    id: 'second',
    name: '두 번째 스팟',
    latitude: 37.57,
    longitude: 126.98,
  },
];

function denyLocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (
        _success: PositionCallback,
        failure?: PositionErrorCallback | null,
      ) => {
        failure?.({} as GeolocationPositionError);
      },
    } satisfies Partial<Geolocation>,
  });
}

describe('HomeMap 위치 폴백', () => {
  beforeEach(() => {
    router.push.mockReset();
    denyLocation();
  });

  it('위치를 쓸 수 없어도 저장 핀이 있으면 첫 좌표에서 전체 범위 지도를 연다', async () => {
    render(<HomeMap spot={null} markers={MARKERS} />);

    const map = await screen.findByTestId('spot-map');
    expect(map).toHaveAttribute('data-latitude', '37.54');
    expect(map).toHaveAttribute('data-longitude', '127.05');
    expect(map).toHaveAttribute('data-fit-markers', 'true');
    expect(map).toHaveAttribute('data-marker-count', '2');
  });

  it('위치도 저장 핀도 없을 때만 권한 안내를 보인다', async () => {
    render(<HomeMap spot={null} markers={[]} />);

    expect(
      await screen.findByText(/내 주변 스팟을 보려면 위치 권한이 필요합니다/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('spot-map')).not.toBeInTheDocument();
  });
});
