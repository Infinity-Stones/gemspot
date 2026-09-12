import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SpotCandidate } from '@/shared/spot';
import { ExtractionResults } from './ExtractionResults';

const CANDIDATES: readonly SpotCandidate[] = [
  {
    id: 'pirouettes',
    name: '피롤츠 커피하우스',
    roadAddress: '서울 용산구 한강대로 56-1, 2층',
    origin: 'ocr',
  },
  {
    id: 'egg-and-flower',
    name: '에그앤플라워',
    roadAddress: null,
    origin: 'ocr',
  },
];

describe('ExtractionResults', () => {
  it('목록보다 먼저 성공과 실패 건수를 알린다', () => {
    render(<ExtractionResults candidates={CANDIDATES} />);

    const alert = screen.getByRole('alertdialog');
    expect(screen.getByText('성공 1건 · 실패 1건')).toBeInTheDocument();
    expect(alert).toHaveAccessibleName('추출이 완료되었습니다');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText('피롤츠 커피하우스')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveFocus();
  });

  it('알럿을 확인하면 성공 탭과 목록을 보여준다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const successTab = screen.getByRole('tab', { name: '성공 1' });
    expect(successTab).toHaveAttribute('aria-selected', 'true');
    expect(successTab).toHaveFocus();
    expect(screen.getByText('피롤츠 커피하우스')).toBeInTheDocument();
    expect(screen.queryByText('에그앤플라워')).not.toBeInTheDocument();
  });

  it('실패 탭에서 주소가 없는 후보만 보여준다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    await user.click(screen.getByRole('tab', { name: '실패 1' }));

    expect(screen.getByText('에그앤플라워')).toBeInTheDocument();
    expect(
      screen.getByText('도로명 주소를 찾지 못했습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('피롤츠 커피하우스')).not.toBeInTheDocument();
  });

  it('방향키로 탭과 결과 목록을 함께 바꾼다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    const successTab = screen.getByRole('tab', { name: '성공 1' });
    successTab.focus();
    await user.keyboard('{ArrowRight}');

    const failureTab = screen.getByRole('tab', { name: '실패 1' });
    expect(failureTab).toHaveFocus();
    expect(failureTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('에그앤플라워')).toBeInTheDocument();
  });

  it('성공 건이 없으면 알럿 확인 후 실패 탭부터 연다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={[CANDIDATES[1]]} />);

    expect(screen.getByText('성공 0건 · 실패 1건')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.getByRole('tab', { name: '실패 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('에그앤플라워')).toBeInTheDocument();
  });

  it('후보가 없으면 0건을 알린 뒤 빈 상태를 보여준다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={[]} />);

    expect(screen.getByText('성공 0건 · 실패 0건')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(
      screen.getByText('주소 입력이 필요한 결과가 없습니다.'),
    ).toBeInTheDocument();
  });

  it('새 추출 데이터를 받으면 목록보다 새 알럿을 먼저 보여준다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ExtractionResults candidates={CANDIDATES.slice(0, 1)} />,
    );

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    expect(screen.getByText('피롤츠 커피하우스')).toBeInTheDocument();

    rerender(<ExtractionResults candidates={CANDIDATES} />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      '성공 1건 · 실패 1건',
    );
    expect(screen.queryByText('피롤츠 커피하우스')).not.toBeInTheDocument();
  });

  it('확정 전 화면에는 저장 동작이 없다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    expect(
      screen.queryByRole('button', { name: /저장/ }),
    ).not.toBeInTheDocument();
  });
});
