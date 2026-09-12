import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SPOT_NEW_PATH } from '@/shared/routes';
import { PinFab } from './PinFab';

describe('PinFab', () => {
  it('핀 찍기 화면으로 가는 링크이고, 접근 가능한 이름에 장식 기호가 섞이지 않는다', () => {
    render(<PinFab />);
    const link = screen.getByRole('link', { name: '핀 찍기' });
    expect(link).toHaveAttribute('href', SPOT_NEW_PATH);
  });
});
