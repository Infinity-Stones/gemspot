import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Itinerary } from '@/domain/route';
import { ItineraryMap } from './ItineraryMap';

const START = { latitude: 37.5447, longitude: 127.0557 };
const END = { latitude: 37.5424, longitude: 127.056 };
const MIDDLE = { latitude: 37.543, longitude: 127.058 };
const ITINERARY: Itinerary = {
  start: { coord: START, departAt: '2026-09-14T14:00:00+09:00' },
  window: {
    start: '2026-09-14T14:00:00+09:00',
    end: '2026-09-14T16:00:00+09:00',
  },
  stops: [
    {
      candidate: {
        id: 'a',
        name: '<img src=x>',
        category: 'other',
        coord: END,
      },
      arriveAt: '2026-09-14T14:06:00+09:00',
      departAt: '2026-09-14T14:36:00+09:00',
      dwellMinutes: 30,
      required: false,
      reason: null,
    },
  ],
  legs: [
    {
      fromId: 'start',
      toId: 'a',
      distanceM: 441,
      durationS: 355,
      source: 'osm',
      path: [START, MIDDLE, END],
    },
  ],
  endAt: '2026-09-14T14:36:00+09:00',
  overBySeconds: 0,
  totalWalkMinutes: 6,
  totalDistanceM: 441,
  hasEstimatedLegs: false,
  dropped: [],
  ordering: 'rule',
};

describe('OSM 동선 지도', () => {
  it('StrictMode에서 지도와 실선·방문 번호를 표시하고 가게 이름을 HTML로 해석하지 않는다', async () => {
    const { unmount } = render(
      <StrictMode>
        <ItineraryMap itinerary={ITINERARY} />
      </StrictMode>,
    );
    const container = screen.getByRole('application', { name: '동선 지도' });
    await waitFor(() =>
      expect(
        container.querySelectorAll('.leaflet-overlay-pane path'),
      ).toHaveLength(1),
    );
    expect(container.querySelectorAll('.leaflet-map-pane')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '출발' })).toBeInTheDocument();
    const marker = screen.getByRole('button', { name: '1' });
    expect(marker).toHaveAttribute('title', '1. <img src=x>');
    fireEvent.mouseOver(marker);
    expect(container.querySelector('.leaflet-tooltip')?.textContent).toBe(
      '1. <img src=x>',
    );
    expect(container.querySelector('.leaflet-tooltip img')).toBeNull();
    expect(
      container.querySelector('.leaflet-overlay-pane path'),
    ).not.toHaveAttribute('stroke-dasharray');
    expect(
      screen.getByRole('link', { name: 'OpenStreetMap contributors' }),
    ).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    unmount();
    expect(container.querySelector('.leaflet-map-pane')).toBeNull();
  });

  it('새 동선으로 바꾸면 이전 경로를 정리하고 추정 구간은 점선으로 그린다', async () => {
    const { rerender } = render(<ItineraryMap itinerary={ITINERARY} />);
    const container = screen.getByRole('application', { name: '동선 지도' });
    await waitFor(() =>
      expect(
        container.querySelectorAll('.leaflet-overlay-pane path'),
      ).toHaveLength(1),
    );
    const previousPath = container.querySelector('.leaflet-overlay-pane path');
    rerender(
      <ItineraryMap
        itinerary={{
          ...ITINERARY,
          hasEstimatedLegs: true,
          legs: [
            { ...ITINERARY.legs[0], source: 'estimate', path: [START, END] },
          ],
        }}
      />,
    );
    await waitFor(() =>
      expect(
        container.querySelector('.leaflet-overlay-pane path'),
      ).toHaveAttribute('stroke-dasharray', '8 10'),
    );
    expect(container.querySelectorAll('.leaflet-map-pane')).toHaveLength(1);
    expect(previousPath).not.toBeInTheDocument();
    expect(screen.getByText(/직선 추정/)).toBeInTheDocument();
  });
});
