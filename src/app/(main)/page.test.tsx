import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedSpot } from '@/shared/spot';

const domain = vi.hoisted(() => ({
  findSpot: vi.fn(),
  loadSpots: vi.fn(),
}));

vi.mock('@/domain/spot', () => domain);
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
vi.mock('@/components/FloatingNavigation', () => ({
  FloatingNavigation: () => <div data-testid="floating-navigation" />,
}));

import HomePage from './page';
import MainLayout from './layout';

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

async function renderHome(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const page = await HomePage({ searchParams: Promise.resolve(searchParams) });
  return render(<MainLayout>{page}</MainLayout>);
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
      error: null,
    });

    await renderHome();

    expect(domain.loadSpots).toHaveBeenCalledOnce();
    expect(screen.getByTestId('home-map')).toHaveTextContent(
      'stored-1:저장한 카페:37.54:127.05',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const menu = screen.getByTestId('floating-navigation');
    expect(screen.getByRole('main')).not.toContainElement(menu);
  });

  it('저장소 읽기가 실패하면 빈 지도 데이터와 오류 안내만 보인다', async () => {
    domain.loadSpots.mockResolvedValue({
      spots: [],
      error: { kind: 'query', message: 'permission denied' },
    });

    await renderHome();

    expect(screen.getByTestId('home-map')).toBeEmptyDOMElement();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '저장한 스팟을 불러오지 못했습니다.',
    );
    expect(screen.queryByText(/예시 스팟/)).not.toBeInTheDocument();
  });

  it('저장소가 설정되지 않았어도 더미 스팟 없이 오류로 표시한다', async () => {
    domain.loadSpots.mockResolvedValue({
      spots: [],
      error: { kind: 'unconfigured' },
    });

    await renderHome();

    expect(screen.getByTestId('home-map')).toBeEmptyDOMElement();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '저장한 스팟을 불러오지 못했습니다.',
    );
  });

  it('result=sample도 저장소에서 찾으며 번들 상세를 열지 않는다', async () => {
    domain.loadSpots.mockResolvedValue({ spots: [], error: null });
    domain.findSpot.mockResolvedValue(null);

    await renderHome({ result: 'sample' });

    expect(domain.findSpot).toHaveBeenCalledWith('sample');
    expect(screen.queryByTestId('spot-detail')).not.toBeInTheDocument();
  });
});
