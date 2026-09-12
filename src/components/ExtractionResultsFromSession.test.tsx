import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CANDIDATES_SESSION_KEY } from '@/app/(main)/upload/extractState';
import { registerSpotsAction } from '@/app/(main)/upload/results/actions';

/**
 * 서버 액션은 jsdom에서 돌지 않는다. 이 화면이 지는 책임은 "고른 건을 그
 * 액션에 어떤 모양으로 넘기는가"와 "돌아온 결과를 보여주는가" 둘이다.
 */
vi.mock('@/app/(main)/upload/results/actions', () => ({
  registerSpotsAction: vi.fn(),
}));

import { ExtractionResultsFromSession } from './ExtractionResultsFromSession';

const registerMock = vi.mocked(registerSpotsAction);

beforeEach(() => {
  sessionStorage.clear();
  registerMock.mockReset();
  registerMock.mockResolvedValue({ registered: [], rejected: [] });
});

/** 목록은 요약 알럿(T14) 뒤에 있다. 결과를 만지려면 먼저 그것을 지나야 한다. */
async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '목록 보기' }));
}

function putCandidates(
  candidates: readonly {
    id: string;
    name: string;
    roadAddress: string | null;
  }[],
) {
  sessionStorage.setItem(
    CANDIDATES_SESSION_KEY,
    JSON.stringify({
      uploadImage: { id: 'upload-42', src: 'blob:upload-42', alt: 'shot.png' },
      candidates: candidates.map(candidate => ({
        ...candidate,
        origin: 'ocr',
      })),
    }),
  );
}

describe('ExtractionResultsFromSession', () => {
  it('업로드 이미지 id와 후보를 결합해 실패 앨범에 넘긴다', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      CANDIDATES_SESSION_KEY,
      JSON.stringify({
        uploadImage: {
          id: 'upload-42',
          src: 'blob:upload-42',
          alt: 'egg.png',
        },
        candidates: [
          {
            id: 'upload-42:0',
            name: '에그앤플라워',
            roadAddress: null,
            origin: 'ocr',
          },
        ],
      }),
    );

    render(<ExtractionResultsFromSession />);
    await user.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.getByRole('img', { name: 'egg.png' })).toHaveAttribute(
      'src',
      'blob:upload-42',
    );
    expect(screen.getByRole('button', { name: 'egg.png 삭제' })).toBeVisible();
  });

  it('업로드 이미지 속성이 없는 이전 세션 값은 안전하게 거른다', () => {
    sessionStorage.setItem(
      CANDIDATES_SESSION_KEY,
      JSON.stringify([
        {
          id: 'old:0',
          name: '이전 후보',
          roadAddress: null,
          origin: 'ocr',
        },
      ]),
    );

    render(<ExtractionResultsFromSession />);

    expect(
      screen.getByText(
        '보여줄 추출 결과가 없습니다. 스크린샷을 먼저 올려 주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('주소가 확인된 건만 액션에 넘긴다 — 좌표는 보내지 않는다', async () => {
    const user = userEvent.setup();
    putCandidates([
      {
        id: 'c1',
        name: '피롤츠 커피하우스',
        roadAddress: '서울 용산구 한강대로 56-1',
      },
      { id: 'c2', name: '텅 베이커리', roadAddress: null },
    ]);
    render(<ExtractionResultsFromSession />);
    await openList(user);

    await user.click(screen.getByRole('button', { name: '선택 완료' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });
    expect(registerMock).toHaveBeenCalledWith([
      {
        candidateId: 'c1',
        name: '피롤츠 커피하우스',
        address: '서울 용산구 한강대로 56-1',
        category: 'other',
      },
    ]);
  });

  it('저장 결과를 그 화면에서 보여준다 — 지도로 넘기지 않는다', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue({
      registered: [
        { candidateId: 'c1', name: '피롤츠 커피하우스', spotId: 'spot-1' },
      ],
      rejected: [],
    });
    putCandidates([
      {
        id: 'c1',
        name: '피롤츠 커피하우스',
        roadAddress: '서울 용산구 한강대로 56-1',
      },
    ]);
    render(<ExtractionResultsFromSession />);
    await openList(user);

    await user.click(screen.getByRole('button', { name: '선택 완료' }));

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: '저장 결과' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: '지도에서 보기' })).toHaveAttribute(
      'href',
      '/?result=spot-1',
    );
    // 결과가 떠도 추출 결과는 그 자리에 남는다.
    expect(
      screen.getByRole('region', { name: '추출 결과' }),
    ).toBeInTheDocument();
  });
});
