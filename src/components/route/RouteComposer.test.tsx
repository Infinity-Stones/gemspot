import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoutePlanState } from '@/app/(main)/route/planState';
import type { PlanOutcome } from '@/domain/route';
import type { PlanRouteAction } from './RouteComposer';
import { RouteComposer } from './RouteComposer';

vi.mock('./ItineraryMap', () => ({
  ItineraryMap: () => <section aria-label="도보 동선 지도" />,
}));

const OK_OUTCOME: PlanOutcome = {
  kind: 'ok',
  request: {
    window: {
      start: '2026-09-12T14:00:00+09:00',
      end: '2026-09-12T16:00:00+09:00',
    },
    area: {
      name: '성수동',
      center: { latitude: 37.5447, longitude: 127.0557 },
    },
    preferredCategories: ['cafe'],
    requiredSpotIds: [],
  },
  itinerary: {
    start: {
      coord: { latitude: 37.5447, longitude: 127.0557 },
      departAt: '2026-09-12T14:00:00+09:00',
    },
    window: {
      start: '2026-09-12T14:00:00+09:00',
      end: '2026-09-12T16:00:00+09:00',
    },
    stops: [
      {
        candidate: {
          id: 'a',
          name: '편집숍 A',
          category: 'other',
          coord: { latitude: 37.5424, longitude: 127.056 },
        },
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
function recordingAction(
  state: RoutePlanState,
  seen: Record<string, string>[],
): PlanRouteAction {
  return vi.fn((_prev: RoutePlanState, formData: FormData) => {
    seen.push(
      Object.fromEntries(
        [...formData.entries()].map(([k, v]) => [
          k,
          typeof v === 'string' ? v : v.name,
        ]),
      ),
    );
    return Promise.resolve(state);
  });
}

describe('RouteComposer', () => {
  it.each(['service', 'load', 'transport'] as const)(
    '%s 실패 뒤 문장을 그대로 재시도할 수 있다',
    async failure => {
      const user = userEvent.setup();
      const sentence = '내일 성수동에서 두 시간 걷고 싶어';
      const action = vi.fn<PlanRouteAction>();
      if (failure === 'transport')
        action.mockRejectedValueOnce(new Error('network'));
      else
        action.mockResolvedValueOnce(
          failure === 'load'
            ? { status: 'load_failed' }
            : {
                status: 'done',
                sentence,
                outcome: {
                  kind: 'failed',
                  failure: { kind: 'service_unavailable', service: 'llm' },
                },
              },
        );
      action.mockResolvedValueOnce({
        status: 'done',
        sentence,
        outcome: OK_OUTCOME,
      });
      render(
        <RouteComposer action={action} spotCount={3} loadFailed={false} />,
      );
      await user.type(screen.getByRole('textbox'), sentence);
      await user.click(screen.getByRole('button', { name: '동선 만들기' }));
      await screen.findByRole('alert');
      expect(screen.getByRole('textbox')).toHaveValue(sentence);
      await user.click(screen.getByRole('button', { name: '동선 만들기' }));
      await screen.findByRole('region', { name: '도보 동선 지도' });
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1][1].get('sentence')).toBe(sentence);
    },
  );
  it('저장된 스팟이 없으면 입력 대신 업로드로 안내한다 — 스팟 없이 LLM을 부르지 않는다', () => {
    render(
      <RouteComposer
        action={actionReturning({ status: 'idle' })}
        spotCount={0}
        loadFailed={false}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      '저장된 스팟이 없어요',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('빈 문장은 제출 버튼이 막힌다', () => {
    render(
      <RouteComposer
        action={actionReturning({ status: 'idle' })}
        spotCount={6}
        loadFailed={false}
      />,
    );
    expect(screen.getByRole('button', { name: '동선 만들기' })).toBeDisabled();
  });

  it('저장소 읽기가 실패하면 빈 상태와 구분해 오류를 알리고 입력을 막는다', () => {
    render(
      <RouteComposer
        action={actionReturning({ status: 'idle' })}
        spotCount={0}
        loadFailed
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      '저장한 스팟을 불러오지 못했어요',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/예시 스팟|시드 데이터/)).not.toBeInTheDocument();
  });

  it('문장을 제출하면 액션에 sentence가 실리고, 여정이 오면 결과 자리에 그려진다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    const action = recordingAction(
      { status: 'done', sentence: '성수동 2시', outcome: OK_OUTCOME },
      seen,
    );
    render(<RouteComposer action={action} spotCount={6} loadFailed={false} />);

    await user.type(screen.getByRole('textbox'), '성수동 2시');
    await user.click(screen.getByRole('button', { name: '동선 만들기' }));

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: '제안된 동선' }),
      ).toBeInTheDocument();
    });
    expect(seen[0]).toEqual({ sentence: '성수동 2시' });
    expect(
      screen.getByRole('region', { name: '해석한 조건' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '도보 동선 지도' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/14:08 편집숍 A/)).toBeInTheDocument();
  });

  it('되묻기의 답과 이전 해석 상태를 각각 전달한다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    const clarify: RoutePlanState = {
      status: 'done',
      sentence: '성수동 걷고 싶어',
      outcome: {
        kind: 'failed',
        failure: {
          kind: 'needs_clarification',
          missing: ['window'],
          question: '몇 시부터 몇 시까지요?',
          draft: {
            window: null,
            areaName: '성수동',
            preferredCategories: [],
            requiredSpotNames: [],
          },
        },
      },
    };
    const action = recordingAction(clarify, seen);
    render(<RouteComposer action={action} spotCount={6} loadFailed={false} />);

    await user.type(screen.getByRole('textbox'), '성수동 걷고 싶어');
    await user.click(screen.getByRole('button', { name: '동선 만들기' }));

    await waitFor(() => {
      expect(screen.getByText('몇 시부터 몇 시까지요?')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: '이어서 답하기' }),
    ).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), '2시부터 4시');
    await user.click(screen.getByRole('button', { name: '이어서 답하기' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]).toMatchObject({
      sentence: '2시부터 4시',
    });
    expect(action).toHaveBeenLastCalledWith(clarify, expect.any(FormData));
  });

  it('되묻기가 아닌 실패는 이유와 다음 수를 말한다 — 빈 화면으로 끝나지 않는다', async () => {
    const user = userEvent.setup();
    const failed: RoutePlanState = {
      status: 'done',
      sentence: 'x',
      outcome: {
        kind: 'failed',
        failure: { kind: 'area_not_found', areaName: '없는동' },
      },
    };
    render(
      <RouteComposer
        action={actionReturning(failed)}
        spotCount={6}
        loadFailed={false}
      />,
    );

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
    render(<RouteComposer action={action} spotCount={6} loadFailed={false} />);

    await user.type(screen.getByRole('textbox'), '성수동 2시');
    await user.click(screen.getByRole('button', { name: '동선 만들기' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /짜고 있어요/ }),
      ).toBeDisabled();
    });
    expect(screen.getByRole('textbox')).toBeDisabled();

    release({ status: 'idle' });
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '동선 만들기' }),
      ).toBeInTheDocument();
    });
  });
  it('편집 실패 후 기존 동선을 유지하고 같은 편집을 재시도한다', async () => {
    const user = userEvent.setup();
    const firstStop = OK_OUTCOME.itinerary.stops[0];
    const secondStop = {
      ...firstStop,
      candidate: { ...firstStop.candidate, id: 'b', name: '카페 B' },
    };
    const plan = {
      ...OK_OUTCOME,
      itinerary: { ...OK_OUTCOME.itinerary, stops: [firstStop, secondStop] },
    };
    const action = actionReturning({
      status: 'done',
      sentence: '성수동에서 산책',
      outcome: plan,
    });
    const edit = vi
      .fn<PlanRouteAction>()
      .mockResolvedValueOnce({ status: 'load_failed' })
      .mockResolvedValueOnce({
        status: 'done',
        sentence: '',
        outcome: {
          ...plan,
          itinerary: {
            ...plan.itinerary,
            stops: [secondStop],
            dropped: [
              {
                candidate: firstStop.candidate,
                reason: 'user',
                previousIndex: 0,
              },
            ],
          },
        },
      });
    render(
      <RouteComposer
        action={action}
        editAction={edit}
        spotCount={2}
        spots={[firstStop.candidate, secondStop.candidate]}
        loadFailed={false}
      />,
    );
    await user.type(screen.getByRole('textbox'), '성수동에서 산책');
    await user.click(screen.getByRole('button', { name: '동선 만들기' }));
    await user.click(
      await screen.findByRole('button', { name: '편집숍 A 빼기' }),
    );
    await screen.findByRole('alert');
    expect(
      screen.getByRole('button', { name: '편집숍 A 빼기' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '도보 동선 지도' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '편집숍 A 빼기' }));
    await screen.findByRole('button', { name: '편집숍 A 되돌리기' });
    expect(
      screen.queryByRole('button', { name: '편집숍 A 빼기' }),
    ).not.toBeInTheDocument();
    expect(edit.mock.calls[1][1].get('plan')).toBe(JSON.stringify(plan));
    expect(edit.mock.calls[1][1].get('intent')).toBe('remove');
    expect(action).toHaveBeenCalledOnce();
  });
});
