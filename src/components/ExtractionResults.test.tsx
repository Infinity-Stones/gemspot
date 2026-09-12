import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
];

describe('ExtractionResults', () => {
  it('성공과 실패 건수를 알리고 성공 탭을 먼저 보여준다', () => {
    render(<ExtractionResults candidates={CANDIDATES} />);

    expect(
      screen.getByText('주소 확인 1건 · 주소 입력 필요 1건'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '성공 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('피롤츠 커피하우스')).toBeInTheDocument();
    expect(screen.queryByText('에그앤플라워')).not.toBeInTheDocument();
  });

  it('실패 탭에서 주소가 없는 후보만 보여준다', async () => {
    const user = userEvent.setup();
    render(<ExtractionResults candidates={CANDIDATES} />);

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

    const successTab = screen.getByRole('tab', { name: '성공 1' });
    successTab.focus();
    await user.keyboard('{ArrowRight}');

    const failureTab = screen.getByRole('tab', { name: '실패 1' });
    expect(failureTab).toHaveFocus();
    expect(failureTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('에그앤플라워')).toBeInTheDocument();
  });

  it('성공 건이 없으면 실패 탭부터 열어 빈 탭을 건너뛴다', () => {
    render(<ExtractionResults candidates={[CANDIDATES[1]]} />);

    expect(screen.getByRole('tab', { name: '실패 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('에그앤플라워')).toBeInTheDocument();
  });

  it('후보가 없으면 빈 상태를 보여준다', () => {
    render(<ExtractionResults candidates={[]} />);

    expect(
      screen.getByText('주소 입력이 필요한 결과가 없습니다.'),
    ).toBeInTheDocument();
  });

  it('확정 전 화면에는 저장 동작이 없다', () => {
    render(<ExtractionResults candidates={CANDIDATES} />);

    expect(
      screen.queryByRole('button', { name: /저장/ }),
    ).not.toBeInTheDocument();
  });

  it('실패 이미지를 업로드 이미지 id로 묶어 앨범에 한 번만 보여준다', () => {
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

  it('실패 앨범에는 재시도 동작이 없다', () => {
    render(<ExtractionResults candidates={[CANDIDATES[1]]} />);

    expect(
      screen.queryByRole('button', { name: /재시도/ }),
    ).not.toBeInTheDocument();
  });
});
