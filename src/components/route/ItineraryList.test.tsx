import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Itinerary } from '@/domain/route';
import { ItineraryList } from './ItineraryList';

const START = { latitude: 37.5447, longitude: 127.0557 };

const BASE: Itinerary = {
  start: { coord: START, departAt: '2026-09-12T14:00:00+09:00' },
  window: {
    start: '2026-09-12T14:00:00+09:00',
    end: '2026-09-12T16:00:00+09:00',
  },
  stops: [
    {
      candidate: { id: 'a', name: '편집숍 A', category: 'other', coord: START },
      arriveAt: '2026-09-12T14:08:00+09:00',
      departAt: '2026-09-12T14:38:00+09:00',
      dwellMinutes: 30,
      required: false,
      reason: '출발점에서 가장 가깝다',
    },
    {
      candidate: { id: 'b', name: '카페 B', category: 'cafe', coord: START },
      arriveAt: '2026-09-12T14:44:00+09:00',
      departAt: '2026-09-12T15:24:00+09:00',
      dwellMinutes: 40,
      required: true,
      reason: null,
    },
  ],
  legs: [
    {
      fromId: 'start',
      toId: 'a',
      distanceM: 600,
      durationS: 480,
      source: 'tmap',
      path: [],
    },
    {
      fromId: 'a',
      toId: 'b',
      distanceM: 500,
      durationS: 360,
      source: 'estimate',
      path: [],
    },
  ],
  endAt: '2026-09-12T15:24:00+09:00',
  overBySeconds: 0,
  totalWalkMinutes: 14,
  totalDistanceM: 1100,
  hasEstimatedLegs: true,
  dropped: [
    {
      candidate: { id: 'd', name: '밥집 D', category: 'meal', coord: START },
      reason: 'outside_window',
    },
  ],
  ordering: 'llm',
};

describe('ItineraryList', () => {
  it('시간을 지정하지 않으면 도착 시각 대신 출발 후 소요시간을 표시한다', () => {
    render(
      <ItineraryList
        itinerary={{ ...BASE, window: null }}
        areaName="성수 카페거리"
      />,
    );
    expect(
      screen.getByText('시간 제한 없이 · 성수 카페거리'),
    ).toBeInTheDocument();
    expect(screen.getByText('원하는 시간에 출발')).toBeInTheDocument();
    expect(screen.getByText(/출발 후 약 8분 · 편집숍 A/)).toBeInTheDocument();
    expect(screen.queryByText(/14:08/)).not.toBeInTheDocument();
    expect(screen.getByText(/이동·체류 포함 약/)).toBeInTheDocument();
  });
  it('시간대 · 동네 · 합계와 각 정거장의 도착 시각 · 체류를 보여 준다', () => {
    render(<ItineraryList itinerary={BASE} areaName="성수동" />);

    expect(screen.getByText(/14:00~16:00 · 성수동/)).toBeInTheDocument();
    expect(screen.getByText(/총 도보 14분 · 1.1 km/)).toBeInTheDocument();
    expect(screen.getByText('14:00 출발')).toBeInTheDocument();
    expect(screen.getByText(/14:08 편집숍 A/)).toBeInTheDocument();
    expect(screen.getByText(/체류 30분/)).toBeInTheDocument();
    expect(screen.getByText('15:24 끝')).toBeInTheDocument();
  });

  it('추정 구간은 (추정)으로 구분하고 합계에도 그 사실을 적는다', () => {
    render(<ItineraryList itinerary={BASE} areaName="성수동" />);

    expect(screen.getByText(/도보 6분 · 500m \(추정\)/)).toBeInTheDocument();
    expect(screen.getByText(/일부 구간 추정/)).toBeInTheDocument();
  });

  it('LLM이 붙인 이유는 보이고, 없는 정거장에는 빈 줄을 남기지 않는다', () => {
    render(<ItineraryList itinerary={BASE} areaName="성수동" />);

    expect(screen.getByText('출발점에서 가장 가깝다')).toBeInTheDocument();
    expect(screen.getByText(/꼭 갈 곳/)).toBeInTheDocument();
  });

  it('규칙 기반 순서면 그 사실을 배지로 말한다 — 조용히 대체하지 않는다', () => {
    render(
      <ItineraryList
        itinerary={{ ...BASE, ordering: 'rule' }}
        areaName="성수동"
      />,
    );
    expect(screen.getByText(/규칙 기반 순서/)).toBeInTheDocument();
  });

  it('종료 시각을 넘으면 경고한다', () => {
    render(
      <ItineraryList
        itinerary={{ ...BASE, overBySeconds: 900 }}
        areaName="성수동"
      />,
    );
    expect(screen.getByText(/15분 넘어요/)).toBeInTheDocument();
  });

  it('빠진 스팟은 이유와 함께, 없으면 그 섹션 자체가 없다', () => {
    const { unmount } = render(
      <ItineraryList itinerary={BASE} areaName="성수동" />,
    );
    expect(
      screen.getByText(/밥집 D — 요청 시간대와 기본 체류 시간에 맞지 않아요/),
    ).toBeInTheDocument();
    unmount();

    render(
      <ItineraryList itinerary={{ ...BASE, dropped: [] }} areaName="성수동" />,
    );
    expect(
      screen.queryByRole('region', { name: '빠진 스팟' }),
    ).not.toBeInTheDocument();
  });

  it('짝이 안 맞은 필수 스팟 이름을 알린다 — 조용히 흘리지 않는다', () => {
    render(
      <ItineraryList
        itinerary={BASE}
        areaName="성수동"
        unmatchedRequiredNames={['없는가게']}
      />,
    );
    expect(screen.getByText(/찾지 못한 이름: 없는가게/)).toBeInTheDocument();
  });
});
