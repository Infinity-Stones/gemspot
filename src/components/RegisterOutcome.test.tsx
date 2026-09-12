import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RegisterSpotsResult } from '@/app/upload/results/registerState';
import { RegisterOutcome } from './RegisterOutcome';

const REGISTERED = {
  candidateId: 'c1',
  name: '피롤츠 커피하우스',
  spotId: 'spot-1',
};

const REJECTED = {
  candidateId: 'c2',
  name: '텅 베이커리',
  failure: { kind: 'address_not_found' },
} as const;

function panel() {
  return screen.getByRole('region', { name: '저장 결과' });
}

describe('RegisterOutcome', () => {
  it('등록한 건마다 그 스팟을 여는 링크를 준다', () => {
    const result: RegisterSpotsResult = {
      registered: [REGISTERED],
      rejected: [],
    };
    render(<RegisterOutcome result={result} />);

    expect(
      within(panel()).getByText('1건을 지도에 등록했습니다'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '지도에서 보기' })).toHaveAttribute(
      'href',
      '/?result=spot-1',
    );
  });

  it('막힌 건은 이유와 함께 따로 보여준다 — 사용자가 할 일이 다르다', () => {
    const result: RegisterSpotsResult = {
      registered: [],
      rejected: [REJECTED],
    };
    render(<RegisterOutcome result={result} />);

    expect(
      within(panel()).getByText('1건은 등록하지 못했습니다'),
    ).toBeInTheDocument();
    expect(screen.getByText('텅 베이커리')).toBeInTheDocument();
    expect(
      screen.getByText(/이 주소로는 위치를 찾지 못했어요/),
    ).toBeInTheDocument();
  });

  it('일부만 들어갔으면 둘을 나눠서 센다 — T23의 부분 실패', () => {
    const result: RegisterSpotsResult = {
      registered: [REGISTERED],
      rejected: [REJECTED],
    };
    render(<RegisterOutcome result={result} />);

    expect(
      within(panel()).getByText('1건을 지도에 등록했습니다'),
    ).toBeInTheDocument();
    expect(
      within(panel()).getByText('1건은 등록하지 못했습니다'),
    ).toBeInTheDocument();
  });

  it('저장소가 없으면 환경 변수 이름을 알려 준다', () => {
    const result: RegisterSpotsResult = {
      registered: [],
      rejected: [
        {
          candidateId: 'c3',
          name: '어딘가',
          failure: { kind: 'store_unconfigured' },
        },
      ],
    };
    render(<RegisterOutcome result={result} />);

    expect(panel()).toHaveTextContent('SUPABASE_URL');
  });
});
