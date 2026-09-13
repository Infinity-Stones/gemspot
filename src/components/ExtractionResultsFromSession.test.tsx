import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CANDIDATES_SESSION_KEY } from '@/app/(main)/upload/extractState';
import { registerSpotsAction } from '@/app/(main)/upload/results/actions';
import type { SpotCategory } from '@/shared/spot';
import { previewSpotLocationAction } from '@/app/(main)/upload/results/previewAction';

/**
 * 서버 액션은 jsdom에서 돌지 않는다. 이 화면이 지는 책임은 "고른 건을 그
 * 액션에 어떤 모양으로 넘기는가"와 "돌아온 결과를 보여주는가" 둘이다.
 */
vi.mock('@/app/(main)/upload/results/actions', () => ({
  registerSpotsAction: vi.fn(),
}));

vi.mock('@/app/(main)/upload/results/previewAction', () => ({
  previewSpotLocationAction: vi.fn(),
}));

vi.mock('./SpotMap', () => ({
  SpotMap: ({ placeName }: { placeName: string }) => (
    <div role="application" aria-label={`${placeName} 위치 지도`} />
  ),
}));

import { ExtractionResultsFromSession } from './ExtractionResultsFromSession';

const registerMock = vi.mocked(registerSpotsAction);
const previewMock = vi.mocked(previewSpotLocationAction);

beforeEach(() => {
  sessionStorage.clear();
  registerMock.mockReset();
  registerMock.mockResolvedValue({ registered: [], rejected: [] });
  previewMock.mockReset();
  previewMock.mockResolvedValue({
    kind: 'ready',
    location: {
      coordinates: { latitude: 37.5299, longitude: 126.9648 },
      roadAddress: '서울 용산구 한강대로 56-1',
      jibunAddress: '',
      region: { sido: '서울특별시', sigugun: '용산구' },
    },
  });
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
    suggestedCategory?: SpotCategory;
  }[],
) {
  sessionStorage.setItem(
    CANDIDATES_SESSION_KEY,
    JSON.stringify({
      uploadImage: { id: 'upload-42', src: 'blob:upload-42', alt: 'shot.png' },
      candidates: candidates.map(candidate => ({
        ...candidate,
        suggestedCategory: candidate.suggestedCategory ?? 'other',
        origin: 'ocr',
      })),
    }),
  );
}

describe('ExtractionResultsFromSession', () => {
  it('목록을 열면 주소가 있는 후보만 지도에 미리 표시하고 저장은 하지 않는다', async () => {
    const user = userEvent.setup();
    putCandidates([
      { id: 'c1', name: '피롤츠', roadAddress: '서울 용산구 한강대로 56-1' },
      { id: 'c2', name: '주소 없는 가게', roadAddress: null },
    ]);
    render(<ExtractionResultsFromSession />);
    expect(previewMock).not.toHaveBeenCalled();

    await openList(user);
    expect(
      await screen.findByRole('application', { name: '피롤츠 위치 지도' }),
    ).toBeVisible();
    expect(previewMock).toHaveBeenCalledExactlyOnceWith(
      '서울 용산구 한강대로 56-1',
    );
    expect(registerMock).not.toHaveBeenCalled();

    await user.selectOptions(
      screen.getByRole('combobox', { name: '피롤츠 저장할 카테고리 선택' }),
      'cafe',
    );
    expect(previewMock).toHaveBeenCalledTimes(1);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('실패 후보의 주소를 직접 입력해 추가하면 성공 카드에서 핀을 미리 보여준다', async () => {
    const user = userEvent.setup();
    putCandidates([{ id: 'c1', name: '피롤츠', roadAddress: null }]);
    render(<ExtractionResultsFromSession />);
    await openList(user);
    expect(previewMock).not.toHaveBeenCalled();

    await user.type(
      screen.getByRole('textbox', { name: '주소' }),
      '서울 용산구 한강대로 56-1',
    );
    await user.click(
      screen.getByRole('button', { name: '성공 데이터로 추가' }),
    );

    expect(
      await screen.findByRole('application', { name: '피롤츠 위치 지도' }),
    ).toBeVisible();
    expect(previewMock).toHaveBeenCalledWith('서울 용산구 한강대로 56-1');
    expect(registerMock).not.toHaveBeenCalled();
  });

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

    expect(
      screen.getByRole('button', { name: 'egg.png 이미지 보기' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '에그앤플라워 삭제' }),
    ).toBeVisible();
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

  it('카테고리 제안이 없거나 잘못된 이전 세션은 기타로 복구한다', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      CANDIDATES_SESSION_KEY,
      JSON.stringify({
        uploadImage: { id: 'old', src: 'blob:old', alt: 'old.png' },
        candidates: [
          {
            id: 'old:0',
            name: '이전 후보',
            roadAddress: '서울 용산구 한강대로 56호',
            origin: 'ocr',
            suggestedCategory: 'unknown',
          },
        ],
      }),
    );

    render(<ExtractionResultsFromSession />);
    await openList(user);

    expect(
      screen.getByRole('combobox', { name: '이전 후보 저장할 카테고리 선택' }),
    ).toHaveValue('other');
  });

  it('주소가 확인된 건만 액션에 넘긴다 — 좌표는 보내지 않는다', async () => {
    const user = userEvent.setup();
    putCandidates([
      {
        id: 'c1',
        name: '피롤츠 커피하우스',
        roadAddress: '서울 용산구 한강대로 56-1',
        suggestedCategory: 'cafe',
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
        category: 'cafe',
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
