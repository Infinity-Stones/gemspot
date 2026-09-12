import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ExtractionResultCandidate } from './ExtractionResults';
import { ExtractionResults } from './ExtractionResults';

const CANDIDATES: readonly ExtractionResultCandidate[] = [
  {
    id: 'pirouettes',
    name: '피롤츠 커피하우스',
    roadAddress: '서울 용산구 한강대로 56-1, 2층',
    suggestedCategory: 'cafe',
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
    suggestedCategory: 'meal',
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
    suggestedCategory: 'meal',
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

  it('알럿을 확인하면 성공과 실패를 한 화면에 함께 보여준다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // 탭으로 갈라 두면 한쪽을 못 본 채 넘어간다. 둘 다 할 일이 있는 목록이다.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('피롤츠 커피하우스')).toBeInTheDocument();
    expect(screen.getByText('파브리키친')).toBeInTheDocument();
    // 실패 건도 같은 화면에 있다 — 탭 뒤에 숨지 않는다.
    expect(screen.getByRole('textbox', { name: '상호명' })).toHaveValue(
      '에그앤플라워',
    );
    expect(
      screen.getByRole('combobox', {
        name: '피롤츠 커피하우스 저장할 카테고리 선택',
      }),
    ).toHaveValue('cafe');
    expect(
      screen.getByRole('combobox', { name: '파브리키친 저장할 카테고리 선택' }),
    ).toHaveValue('meal');
  });

  it('주소를 못 찾았다는 안내는 토스트로 한 번만 지나간다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      '도로명 주소를 찾지 못했습니다.',
    );
    expect(
      screen.getByRole('button', { name: '에그앤플라워 스크린샷 이미지 보기' }),
    ).toBeInTheDocument();
  });

  it('성공 건이 없으면 실패 목록만 남는다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={[CANDIDATES[1]]} />);

    expect(screen.getByText('성공 0건 · 실패 1건')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.getByRole('textbox', { name: '상호명' })).toHaveValue(
      '에그앤플라워',
    );
    expect(
      screen.queryByRole('button', { name: '선택 완료' }),
    ).not.toBeInTheDocument();
  });

  it('후보가 없으면 0건을 알린 뒤 빈 화면을 보여준다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={[]} />);

    expect(screen.getByText('성공 0건 · 실패 0건')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
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

  it('성공 건마다 상호명과 주소를 보여주고 카테고리를 고르게 한다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.getByText('피롤츠 커피하우스')).toBeInTheDocument();
    expect(
      screen.getByText('서울 용산구 한강대로 56-1, 2층'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', {
        name: '피롤츠 커피하우스 저장할 카테고리 선택',
      }),
    ).toBeInTheDocument();
  });

  it('주소가 확인된 후보를 STEP 4 경계로 넘긴다', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <ExtractionResults
        candidates={[CANDIDATES[0]]}
        onContinue={onContinue}
      />,
    );

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: '피롤츠 커피하우스 저장할 카테고리 선택',
      }),
      'other',
    );
    await user.click(screen.getByRole('button', { name: '선택 완료' }));

    expect(onContinue).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledWith([
      {
        id: 'pirouettes',
        name: '피롤츠 커피하우스',
        roadAddress: '서울 용산구 한강대로 56-1, 2층',
        suggestedCategory: 'cafe',
        origin: 'ocr',
        category: 'other',
      },
    ]);
  });

  it('전달 경계가 없으면 선택 완료를 비활성화해 저장을 가장하지 않는다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={[CANDIDATES[0]]} />);

    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.getByRole('button', { name: '선택 완료' })).toBeDisabled();
  });

  it('실패 건의 상호명과 주소를 고쳐 성공 데이터로 옮긴다', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <ExtractionResults
        candidates={[CANDIDATES[1]]}
        onContinue={onContinue}
      />,
    );

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    const name = screen.getByRole('textbox', { name: '상호명' });
    const address = screen.getByRole('textbox', { name: '주소' });

    await user.clear(name);
    await user.type(name, '에그 앤 플라워');
    await user.type(address, '서울 용산구 신흥로 26길 35');

    // 타이핑은 폼의 초안만 바꾼다. 명시적으로 추가하기 전에는 실패 건이
    // 성공(다음 저장 단계로 넘길 대상)에 섞이지 않는다.
    expect(
      screen.queryByRole('button', { name: '선택 완료' }),
    ).not.toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: '성공 데이터로 추가' }),
    );

    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText('에그 앤 플라워')).toBeInTheDocument();
    expect(screen.getByText('서울 용산구 신흥로 26길 35')).toBeInTheDocument();
    expect(screen.getByText('직접 입력')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '선택 완료' }));

    expect(onContinue).toHaveBeenCalledWith([
      {
        id: 'egg-and-flower',
        name: '에그 앤 플라워',
        roadAddress: '서울 용산구 신흥로 26길 35',
        suggestedCategory: 'meal',
        origin: 'manual',
        category: 'meal',
      },
    ]);
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
      screen.getAllByRole('button', {
        name: '가게 둘이 담긴 스크린샷 이미지 보기',
      }),
    ).toHaveLength(1);
    // 한 장에서 나온 후보는 각자 자기 입력 칸을 갖는다.
    const names = screen.getAllByRole('textbox', { name: '상호명' });
    expect(names.map(field => (field as HTMLInputElement).value)).toEqual([
      '에그앤플라워',
      '두 번째 가게',
    ]);
  });

  it('한 장에서 나온 후보를 하나씩 지운다 — 옆 후보는 남는다', async () => {
    const user = userEvent.setup();
    const sharedImage = {
      id: 'upload-shared',
      src: 'blob:shared',
      alt: '가게 둘이 담긴 스크린샷',
    };
    render(
      <ExtractionResults
        candidates={[
          { ...CANDIDATES[1], id: 'first', uploadImage: sharedImage },
          {
            ...CANDIDATES[1],
            id: 'second',
            name: '남은 가게',
            uploadImage: sharedImage,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: '목록 보기' }));
    await user.click(screen.getByRole('button', { name: '에그앤플라워 삭제' }));

    const names = screen.getAllByRole('textbox', { name: '상호명' });
    expect(names.map(field => (field as HTMLInputElement).value)).toEqual([
      '남은 가게',
    ]);
    // 한 건을 지웠다고 그 장에서 나온 다른 건까지 사라지지 않는다.
    expect(
      screen.getByRole('button', {
        name: '가게 둘이 담긴 스크린샷 이미지 보기',
      }),
    ).toBeInTheDocument();
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
