import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { REQUEST_14_16, ALL_SPOTS } from '@/domain/route/fixtures.test-helper';
import { InterpretationCard } from './InterpretationCard';

describe('해석 조건 확인과 수정', () => {
  it('첫 결과에서는 요약을 보여 주고 선택해서 수정하면 날짜와 칩 변경을 전달한다', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <InterpretationCard
        request={REQUEST_14_16}
        spots={ALL_SPOTS}
        pending={false}
        onSubmit={onSubmit}
      />,
    );
    expect(
      screen.queryByRole('button', { name: '다시 제안' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/2026-09-12 14:00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '조건 수정' }));
    expect(screen.getByRole('button', { name: '다시 제안' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('종료 날짜와 시간'), {
      target: { value: '2026-09-12T13:00' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      '종료는 출발보다 늦어야',
    );
    expect(screen.getByRole('button', { name: '다시 제안' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('종료 날짜와 시간'), {
      target: { value: '2026-09-12T17:00' },
    });
    await user.click(screen.getByRole('button', { name: '식사' }));
    await user.click(screen.getByRole('checkbox', { name: '카페 B' }));
    await user.click(screen.getByRole('button', { name: '다시 제안' }));
    expect(onSubmit).toHaveBeenCalledWith({
      areaName: '성수동',
      window: {
        start: REQUEST_14_16.window.start,
        end: '2026-09-12T17:00:00+09:00',
      },
      preferredCategories: ['cafe', 'meal'],
      requiredSpotIds: ['b'],
    });
  });

  it('되묻기에서는 이미 확인한 조건과 필요한 질문을 표시한다', () => {
    render(
      <InterpretationCard
        draft={{
          window: null,
          areaName: '성수동',
          preferredCategories: ['cafe'],
          requiredSpotNames: [],
        }}
        spots={ALL_SPOTS}
        pending={false}
      />,
    );
    expect(screen.getByText('성수동')).toBeInTheDocument();
    expect(
      screen.getByText('걷고 싶은 시간을 알려 주세요'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '조건 수정' }),
    ).not.toBeInTheDocument();
  });
});
