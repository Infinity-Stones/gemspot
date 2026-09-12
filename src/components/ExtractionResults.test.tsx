import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ExtractionResultCandidate } from './ExtractionResults';
import { ExtractionResults } from './ExtractionResults';

const CANDIDATES: readonly ExtractionResultCandidate[] = [
  {
    id: 'pirouettes',
    name: '피롤츠 커피하우스',
    roadAddress: '서울 용산구 한강대로 56-1, 2층',
    origin: 'ocr',
    uploadImage: {
      id: 'upload-pirouettes',
      src: 'blob:pirouettes',
      alt: '피롤츠 스크린샷',
    },
  },
  {
    id: 'egg-and-flower',
    name: '에그앤플라워',
    roadAddress: null,
    origin: 'ocr',
    uploadImage: {
      id: 'upload-egg-and-flower',
      src: 'blob:egg-and-flower',
      alt: '에그앤플라워 스크린샷',
    },
  },
  {
    id: 'fabri-kitchen',
    name: '파브리키친',
    roadAddress: '서울 용산구 한강대로15길 23-6',
    origin: 'ocr',
    uploadImage: {
      id: 'upload-fabri-kitchen',
      src: 'blob:fabri-kitchen',
      alt: '파브리키친 스크린샷',
    },
  },
];

describe('ExtractionResults', () => {
  it('목록보다 먼저 성공과 실패 건수를 알린다', () => {
    render(<ExtractionResults candidates={CANDIDATES} />);

    const alert = screen.getByRole('alertdialog');
    expect(screen.getByText('성공 2건 · 실패 1건')).toBeInTheDocument();
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
    const successTab = screen.getByRole('tab', { name: '성공 2' });
    expect(successTab).toHaveAttribute('aria-selected', 'true');
    expect(successTab).toHaveFocus();
    expect(screen.getByText('피롤츠 커피하우스')).toBeInTheDocument();
    expect(screen.getByText('파브리키친')).toBeInTheDocument();
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
    expect(
      screen.getByRole('img', { name: '에그앤플라워 스크린샷' }),
    ).toHaveAttribute('src', 'blob:egg-and-flower');
    expect(screen.queryByText('피롤츠 커피하우스')).not.toBeInTheDocument();
  });

  it('방향키로 탭과 결과 목록을 함께 바꾼다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    const successTab = screen.getByRole('tab', { name: '성공 2' });
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
      '성공 2건 · 실패 1건',
    );
    expect(screen.queryByText('피롤츠 커피하우스')).not.toBeInTheDocument();
  });

  it('성공 건마다 상호명과 주소를 보여주고 저장 또는 삭제를 고르게 한다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(
      screen.getByRole('group', { name: '피롤츠 커피하우스 처리 방법' }),
    ).toHaveTextContent('저장삭제');
    expect(
      screen.getByRole('group', { name: '파브리키친 처리 방법' }),
    ).toHaveTextContent('저장삭제');
    expect(
      screen.getByText('서울 용산구 한강대로 56-1, 2층'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('서울 용산구 한강대로15길 23-6'),
    ).toBeInTheDocument();
  });

  it('모든 성공 건을 고르기 전에는 STEP 4 전달을 막는다', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <ExtractionResults candidates={CANDIDATES} onContinue={onContinue} />,
    );

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    const complete = screen.getByRole('button', { name: '선택 완료' });
    expect(complete).toBeDisabled();

    const pirouettes = screen.getByRole('group', {
      name: '피롤츠 커피하우스 처리 방법',
    });
    await user.click(within(pirouettes).getByRole('button', { name: '저장' }));

    expect(
      screen.getByText('2건 중 1건 선택 · 저장 대상 1건'),
    ).toBeInTheDocument();
    expect(complete).toBeDisabled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('저장을 고른 성공 후보만 STEP 4 경계로 넘긴다', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <ExtractionResults candidates={CANDIDATES} onContinue={onContinue} />,
    );

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    const pirouettes = screen.getByRole('group', {
      name: '피롤츠 커피하우스 처리 방법',
    });
    const fabri = screen.getByRole('group', {
      name: '파브리키친 처리 방법',
    });
    await user.click(within(pirouettes).getByRole('button', { name: '저장' }));
    await user.click(within(fabri).getByRole('button', { name: '삭제' }));
    await user.click(screen.getByRole('button', { name: '선택 완료' }));

    expect(
      within(pirouettes).getByRole('button', { name: '저장' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(fabri).getByRole('button', { name: '삭제' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledWith([
      {
        id: 'pirouettes',
        name: '피롤츠 커피하우스',
        roadAddress: '서울 용산구 한강대로 56-1, 2층',
        origin: 'ocr',
      },
    ]);
  });

  it('전달 경계가 없으면 선택 완료를 비활성화해 저장을 가장하지 않는다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={[CANDIDATES[0]]} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(screen.getByRole('button', { name: '선택 완료' })).toBeDisabled();
  });

  it('실패 이미지를 업로드 이미지 id로 묶어 앨범에 한 번만 보여준다', async () => {
    const user = userEvent.setup();
    const sharedImage = {
      id: 'upload-shared',
      src: 'blob:shared',
      alt: '가게 둘이 담긴 스크린샷',
    };
    const failures: readonly ExtractionResultCandidate[] = [
      { ...CANDIDATES[1], id: 'first', uploadImage: sharedImage },
      {
        ...CANDIDATES[1],
        id: 'second',
        name: '두 번째 가게',
        uploadImage: sharedImage,
      },
    ];

    render(<ExtractionResults candidates={failures} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(
      screen.getAllByRole('img', { name: '가게 둘이 담긴 스크린샷' }),
    ).toHaveLength(1);
    expect(screen.getByText('에그앤플라워')).toBeInTheDocument();
    expect(screen.getByText('두 번째 가게')).toBeInTheDocument();
  });

  it('실패 이미지를 목록에서 개별 삭제한다', async () => {
    const user = userEvent.setup();
    const otherFailure: ExtractionResultCandidate = {
      ...CANDIDATES[1],
      id: 'other-failure',
      name: '남은 가게',
      uploadImage: {
        id: 'upload-other',
        src: 'blob:other',
        alt: '남은 스크린샷',
      },
    };
    render(<ExtractionResults candidates={[CANDIDATES[1], otherFailure]} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    await user.click(
      screen.getByRole('button', { name: '에그앤플라워 스크린샷 삭제' }),
    );

    expect(
      screen.queryByRole('img', { name: '에그앤플라워 스크린샷' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '남은 스크린샷' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '실패 1' })).toBeInTheDocument();
  });

  it('실패 앨범에는 재시도 동작이 없다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={[CANDIDATES[1]]} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(
      screen.queryByRole('button', { name: /재시도/ }),
    ).not.toBeInTheDocument();
  });
});
