import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HOME_PATH } from '@/shared/routes';
import { BackLink } from './BackLink';

describe('BackLink', () => {
  it('받은 곳으로 가는 링크이고, 접근 가능한 이름에 장식 기호가 섞이지 않는다', () => {
    render(<BackLink href={HOME_PATH} label="홈으로 돌아가기" />);
    const link = screen.getByRole('link', { name: '홈으로 돌아가기' });
    expect(link).toHaveAttribute('href', HOME_PATH);
  });
});
