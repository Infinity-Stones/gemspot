import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedSpot } from '@/shared/spot';

const domain = vi.hoisted(() => ({
  findSpot: vi.fn(),
  loadSpots: vi.fn(),
}));

vi.mock('@/domain/spot', () => domain);
vi.mock('@/components/AppHeader', () => ({
  AppHeader: () => <div data-testid="header" />,
}));
vi.mock('@/components/HomeMap', () => ({
  HomeMap: ({
    markers,
  }: {
    markers: readonly {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
    }[];
  }) => (
    <ul data-testid="home-map">
      {markers.map(marker => (
        <li key={marker.id}>
          {marker.id}:{marker.name}:{marker.latitude}:{marker.longitude}
        </li>
      ))}
    </ul>
  ),
}));
vi.mock('@/components/SpotDetailPanel', () => ({
  SpotDetailPanel: () => <div data-testid="spot-detail" />,
}));
vi.mock('@/components/spot/PinFab', () => ({
  PinFab: () => <div data-testid="pin-fab" />,
}));

import HomePage from './page';

const STORED_SPOT: SavedSpot = {
  id: 'stored-1',
  name: '저장한 카페',
  roadAddress: '서울 성동구 연무장길 1',
  jibunAddress: null,
  coordinates: { latitude: 37.54, longitude: 127.05 },
  region: { sido: '서울특별시', sigugun: '성동구' },
  category: 'cafe',
  origin: 'manual',
};

function renderHome() {
  return HomePage({ searchParams: Promise.resolve({}) }).then(render);
}

describe('HomePage 저장 스팟 목록', () => {
  beforeEach(() => {
    domain.findSpot.mockReset();
    domain.loadSpots.mockReset();
    domain.findSpot.mockResolvedValue(null);
  });

  it('저장소 목록을 지도용 최소 계약으로 바꿔 전부 넘긴다', async () => {
    domain.loadSpots.mockResolvedValue({
      spots: [STORED_SPOT],
      source: 'store',
      storeError: null,
    });

    await renderHome();

    expect(domain.loadSpots).toHaveBeenCalledOnce();
    expect(screen.getByTestId('home-map')).toHaveTextContent(
      'stored-1:저장한 카페:37.54:127.05',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('저장소 읽기가 실패하면 폴백 목록과 실패 안내를 함께 보인다', async () => {
    domain.loadSpots.mockResolvedValue({
      spots: [STORED_SPOT],
      source: 'seed',
      storeError: 'permission denied',
    });

    await renderHome();

    expect(screen.getByTestId('home-map')).toHaveTextContent('stored-1');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '저장한 스팟을 불러오지 못해 예시 스팟을 표시합니다.',
    );
  });

  it('저장소가 설정되지 않았으면 예시 데이터임을 알린다', async () => {
    domain.loadSpots.mockResolvedValue({
      spots: [STORED_SPOT],
      source: 'seed',
      storeError: null,
    });

    await renderHome();

    expect(screen.getByRole('status')).toHaveTextContent(
      '예시 스팟을 표시하고 있습니다.',
    );
  });
});
