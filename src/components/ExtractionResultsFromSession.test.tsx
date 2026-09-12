import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CANDIDATES_SESSION_KEY } from '@/app/upload/extractState';
import { ExtractionResultsFromSession } from './ExtractionResultsFromSession';

beforeEach(() => {
  sessionStorage.clear();
});

describe('ExtractionResultsFromSession', () => {
  it('업로드 이미지 id와 후보를 결합해 실패 앨범에 넘긴다', () => {
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
});
