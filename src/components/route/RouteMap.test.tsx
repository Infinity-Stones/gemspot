import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadNaverMaps, subscribeNaverMapsAuthFailure } from '../naverMaps';
import type { NaverMaps } from '../naverMaps';
import {
  REQUEST_14_16,
  SHOP_A,
  CAFE_B,
  START,
  specLegs,
} from '@/domain/route/fixtures.test-helper';
import { schedule } from '@/domain/route/schedule';
import { RouteMap } from './RouteMap';
import { legsToLines } from './routePresentation';

vi.mock('../naverMaps', () => ({
  loadNaverMaps: vi.fn(),
  subscribeNaverMapsAuthFailure: vi.fn(() => () => undefined),
  bottomLeftControls: () => ({}),
}));
const base = schedule({
  start: { coord: START, departAt: REQUEST_14_16.window.start },
  window: REQUEST_14_16.window,
  order: [SHOP_A, CAFE_B],
  legs: [specLegs()[0], { ...specLegs()[1], source: 'estimate' }],
  requiredSpotIds: [],
  reasons: new Map(),
  dropped: [],
  ordering: 'llm',
});

class Point {
  readonly x: number;
  readonly y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
class MapStub {
  static instances: MapStub[] = [];
  fitBounds = vi.fn();
  destroy = vi.fn();
  constructor() {
    MapStub.instances.push(this);
  }
}
class Overlay {
  static instances: Overlay[] = [];
  setMap = vi.fn();
  readonly options: {
    strokeStyle?: string;
    title?: string;
    icon?: { content: string };
  };
  constructor(options: {
    strokeStyle?: string;
    title?: string;
    icon?: { content: string };
  }) {
    this.options = options;
    Overlay.instances.push(this);
  }
}
const sdk = {
  LatLng: Point,
  Point,
  Map: MapStub,
  Marker: Overlay,
  Polyline: Overlay,
  Position: { BOTTOM_LEFT: 8 },
} as unknown as NaverMaps;

describe('도보 지도', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MapStub.instances = [];
    Overlay.instances = [];
    vi.mocked(loadNaverMaps).mockResolvedValue(sdk);
  });

  it('첫 결과의 번호·추정 구간을 그리고 변경·종료 시 이전 오버레이를 정리한다', async () => {
    const { rerender, unmount } = render(<RouteMap itinerary={base} />);
    await waitFor(() => expect(Overlay.instances).toHaveLength(5));
    expect(
      Overlay.instances
        .filter(item => item.options.strokeStyle)
        .map(item => item.options.strokeStyle),
    ).toEqual(['solid', 'shortdash']);
    expect(
      Overlay.instances
        .filter(item => item.options.title)
        .map(item => item.options.title),
    ).toEqual(['출발점', '1. 편집숍 A', '2. 카페 B']);
    expect(screen.getByText(/점선은/)).toBeInTheDocument();
    const old = [...Overlay.instances];
    rerender(
      <RouteMap
        itinerary={{
          ...base,
          stops: base.stops.slice(0, 1),
          legs: base.legs.slice(0, 1),
          hasEstimatedLegs: false,
        }}
      />,
    );
    await waitFor(() =>
      expect(
        old.every(item =>
          item.setMap.mock.calls.some(call => call[0] === null),
        ),
      ).toBe(true),
    );
    expect(MapStub.instances).toHaveLength(1);
    expect(MapStub.instances[0].fitBounds).toHaveBeenCalledTimes(2);
    unmount();
    expect(MapStub.instances[0].destroy).toHaveBeenCalledOnce();
  });

  it('SDK 실패 이유와 재시도 버튼을 보여 주고 재시도하면 지도를 그린다', async () => {
    vi.mocked(loadNaverMaps).mockRejectedValueOnce(new Error('load failed'));
    const user = userEvent.setup();
    render(<RouteMap itinerary={base} />);
    await user.click(
      await screen.findByRole('button', { name: '지도 다시 불러오기' }),
    );
    await waitFor(() => expect(MapStub.instances).toHaveLength(1));
    expect(
      screen.queryByRole('button', { name: '지도 다시 불러오기' }),
    ).not.toBeInTheDocument();
  });
});

describe('보행 경로 연결', () => {
  it('이어지는 같은 종류의 경로는 경계 중복점을 제거해 합친다', () => {
    const lines = legsToLines(specLegs());
    expect(lines).toHaveLength(1);
    expect(lines[0].path).toHaveLength(4);
  });
  it('추정 구간과 시작점이 다른 구간은 별도 선으로 남긴다', () => {
    expect(legsToLines(base.legs).map(line => line.source)).toEqual([
      'tmap',
      'estimate',
    ]);
    expect(legsToLines([specLegs()[0], specLegs()[2]])).toHaveLength(2);
  });
  it('SDK가 인증 실패로 내부 객체를 먼저 정리해도 화면을 깨뜨리지 않는다', async () => {
    const { unmount } = render(<RouteMap itinerary={base} />);
    await waitFor(() => expect(Overlay.instances).toHaveLength(5));
    for (const overlay of Overlay.instances) {
      overlay.setMap.mockImplementation(() => {
        throw new Error('SDK disposed');
      });
    }
    MapStub.instances[0].destroy.mockImplementation(() => {
      throw new Error('SDK disposed');
    });
    act(() => {
      vi.mocked(subscribeNaverMapsAuthFailure).mock.calls[0][0]();
    });
    expect(
      screen.getByRole('button', { name: '지도 다시 불러오기' }),
    ).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });
});
