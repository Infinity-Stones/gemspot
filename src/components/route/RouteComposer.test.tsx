import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoutePlanState } from '@/app/route/planState';
import type { PlanOutcome } from '@/domain/route';
import type { PlanRouteAction } from './RouteComposer';
import { RouteComposer } from './RouteComposer';

const OK_OUTCOME: PlanOutcome = {
  kind: 'ok',
  request: {
    window: { start: '2026-09-12T14:00:00+09:00', end: '2026-09-12T16:00:00+09:00' },
    area: { name: '성수동', center: { latitude: 37.5447, longitude: 127.0557 } },
    preferredCategories: ['cafe'],
    requiredSpotIds: [],
  },
  itinerary: {
    start: { coord: { latitude: 37.5447, longitude: 127.0557 }, departAt: '2026-09-12T14:00:00+09:00' },
    window: { start: '2026-09-12T14:00:00+09:00', end: '2026-09-12T16:00:00+09:00' },
    stops: [
      {
        candidate: { id: 'a', name: '편집숍 A', category: 'other', coord: { latitude: 37.5424, longitude: 127.056 } },
        arriveAt: '2026-09-12T14:08:00+09:00',
        departAt: '2026-09-12T14:38:00+09:00',
        dwellMinutes: 30,
        required: false,
        reason: '가깝다',
      },
    ],
    legs: [],
    endAt: '2026-09-12T14:38:00+09:00',
    overBySeconds: 0,
    totalWalkMinutes: 8,
    totalDistanceM: 600,
    hasEstimatedLegs: false,
    dropped: [],
    ordering: 'llm',
  },
  unmatchedRequiredNames: [],
};

function actionReturning(state: RoutePlanState): PlanRouteAction {
  return vi.fn(() => Promise.resolve(state));
}

/** 제출된 폼 데이터를 기록하는 액션. */
function recordingAction(state: RoutePlanState, seen: Record<string, string>[]): PlanRouteAction {
  return vi.fn((_prev: RoutePlanState, formData: FormData) => {
    seen.push(
      Object.fromEntries([...formData.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : v.name])),
    );
    return Promise.resolve(state);
  });
}

describe('RouteComposer', () => {
  it('저장된 스팟이 없으면 입력 대신 업로드로 안내한다 — 스팟 없이 LLM을 부르지 않는다', () => {
    render(<RouteComposer action={actionReturning({ status: 'idle' })} spotCount={0} spotSource="seed" />);
    expect(screen.getByRole('status')).toHaveTextContent('저장된 스팟이 없어요');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('빈 문장은 제출 버튼이 막힌다', () => {
    render(<RouteComposer action={actionReturning({ status: 'idle' })} spotCount={6} spotSource="store" />);
    expect(screen.getByRole('button', { name: '동선 만들기' })).toBeDisabled();
  });

  it('시드면 그 사실을 배지로 알린다', () => {
    render(<RouteComposer action={actionReturning({ status: 'idle' })} spotCount={6} spotSource="seed" />);
    expect(screen.getByText(/시드 데이터/)).toBeInTheDocument();
  });

  it('문장을 제출하면 액션에 sentence가 실리고, 여정이 오면 결과 자리에 그려진다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    const action = recordingAction(
      { status: 'done', sentence: '성수동 2시', outcome: OK_OUTCOME, spotSource: 'store' },
      seen,
    );
    render(<RouteComposer action={action} spotCount={6} spotSource="store" />);

    await user.type(screen.getByRole('textbox'), '성수동 2시');
    await user.click(screen.getByRole('button', { name: '동선 만들기' }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '제안된 동선' })).toBeInTheDocument();
    });
    expect(seen[0]).toMatchObject({ sentence: '성수동 2시', history: '' });
    expect(screen.getByText(/14:08 편집숍 A/)).toBeInTheDocument();
  });

  it('되묻기가 오면 질문을 보여 주고, 다음 제출에 이전 문장을 history로 잇는다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    const clarify: RoutePlanState = {
      status: 'done',
      sentence: '성수동 걷고 싶어',
      spotSource: 'store',
      outcome: {
        kind: 'failed',
        failure: {
          kind: 'needs_clarification',
          missing: ['window'],
          question: '몇 시부터 몇 시까지요?',
          draft: { window: null, areaName: '성수동', preferredCategories: [], requiredSpotNames: [] },
        },
      },
    };
    const action = recordingAction(clarify, seen);
    render(<RouteComposer action={action} spotCount={6} spotSource="store" />);

    await user.type(screen.getByRole('textbox'), '성수동 걷고 싶어');
    await user.click(screen.getByRole('button', { name: '동선 만들기' }));

    await waitFor(() => {
      expect(screen.getByText('몇 시부터 몇 시까지요?')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '이어서 답하기' })).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), '2시부터 4시');
    await user.click(screen.getByRole('button', { name: '이어서 답하기' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]).toMatchObject({ sentence: '2시부터 4시', history: '성수동 걷고 싶어' });
  });

  it('되묻기가 아닌 실패는 이유와 다음 수를 말한다 — 빈 화면으로 끝나지 않는다', async () => {
    const user = userEvent.setup();
    const failed: RoutePlanState = {
      status: 'done',
      sentence: 'x',
      spotSource: 'store',
      outcome: { kind: 'failed', failure: { kind: 'area_not_found', areaName: '없는동' } },
    };
    render(<RouteComposer action={actionReturning(failed)} spotCount={6} spotSource="store" />);

    await user.type(screen.getByRole('textbox'), 'x');
    await user.click(screen.getByRole('button', { name: '동선 만들기' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('없는동');
    });
  });

  it('제출 중에는 버튼과 입력이 잠긴다', async () => {
    const user = userEvent.setup();
    let release: (state: RoutePlanState) => void = () => undefined;
    const action: PlanRouteAction = () =>
      new Promise(resolve => {
        release = resolve;
      });
    render(<RouteComposer action={action} spotCount={6} spotSource="store" />);

    await user.type(screen.getByRole('textbox'), '성수동 2시');
    await user.click(screen.getByRole('button', { name: '동선 만들기' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /짜고 있어요/ })).toBeDisabled();
    });
    expect(screen.getByRole('textbox')).toBeDisabled();

    release({ status: 'idle' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '동선 만들기' })).toBeInTheDocument();
    });
  });
});
