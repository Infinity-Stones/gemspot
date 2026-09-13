import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOME_PATH,
  ROUTE_PATH,
  SPOT_NEW_PATH,
  UPLOAD_PATH,
} from '@/shared/routes';
import { THEME_ATTRIBUTE } from '@/shared/theme';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

import { FloatingNavigation } from './FloatingNavigation';

describe('FloatingNavigation', () => {
  beforeEach(() => {
    navigation.pathname = HOME_PATH;
    document.documentElement.setAttribute(THEME_ATTRIBUTE, 'light');
    localStorage.clear();
  });

  it('홈에서도 버튼 하나로 시작하고 눌러야 주요 동작을 보여 준다', async () => {
    const user = userEvent.setup();
    render(<FloatingNavigation />);
    const trigger = screen.getByLabelText('메뉴');
    expect(screen.getByRole('navigation', { hidden: true })).not.toBeVisible();

    await user.click(trigger);
    const actions = within(
      screen.getByRole('navigation', { name: '빠른 동작' }),
    );

    expect(actions.getByRole('link', { name: '동선 만들기' })).toHaveAttribute(
      'href',
      ROUTE_PATH,
    );
    expect(actions.getByRole('link', { name: '업로드' })).toHaveAttribute(
      'href',
      UPLOAD_PATH,
    );
    expect(actions.getByRole('link', { name: '핀 찍기' })).toHaveAttribute(
      'href',
      SPOT_NEW_PATH,
    );
    expect(
      actions.getByRole('button', { name: '다크 테마로 전환' }),
    ).toBeVisible();

    await user.click(trigger);
    expect(screen.getByRole('navigation', { hidden: true })).not.toBeVisible();
  });

  it.each([HOME_PATH, SPOT_NEW_PATH])(
    '%s 메뉴는 Escape로 닫으면 초점을 돌려준다',
    async pathname => {
      navigation.pathname = pathname;
      const user = userEvent.setup();
      render(<FloatingNavigation />);
      const trigger = screen.getByLabelText('메뉴');

      expect(
        screen.getByRole('navigation', { hidden: true }),
      ).not.toBeVisible();
      await user.click(trigger);
      const pinLink = screen.getByRole('link', { name: '핀 찍기' });
      pinLink.focus();
      await user.keyboard('{Escape}');

      expect(
        screen.getByRole('navigation', { hidden: true }),
      ).not.toBeVisible();
      expect(trigger).toHaveFocus();
    },
  );

  it('페이지 이동 뒤에는 메뉴를 닫고 새 페이지를 현재 위치로 표시한다', async () => {
    navigation.pathname = UPLOAD_PATH;
    const user = userEvent.setup();
    const { rerender } = render(<FloatingNavigation />);
    await user.click(screen.getByLabelText('메뉴'));
    expect(screen.getByRole('link', { name: '업로드' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    navigation.pathname = ROUTE_PATH;
    rerender(<FloatingNavigation />);
    expect(screen.getByRole('navigation', { hidden: true })).not.toBeVisible();
    await user.click(screen.getByLabelText('메뉴'));
    expect(screen.getByRole('link', { name: '동선 만들기' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '업로드' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it.each([HOME_PATH, SPOT_NEW_PATH])(
    '%s 메뉴 바깥을 누르면 접히고 화면을 계속 사용할 수 있다',
    async pathname => {
      navigation.pathname = pathname;
      const user = userEvent.setup();
      render(
        <>
          <button type="button">화면의 다른 동작</button>
          <FloatingNavigation />
        </>,
      );
      await user.click(screen.getByLabelText('메뉴'));
      await user.click(
        screen.getByRole('button', { name: '화면의 다른 동작' }),
      );

      expect(
        screen.getByRole('navigation', { hidden: true }),
      ).not.toBeVisible();
      expect(
        screen.getByRole('button', { name: '화면의 다른 동작' }),
      ).toHaveFocus();
    },
  );
});
