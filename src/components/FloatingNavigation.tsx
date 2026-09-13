'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { css } from 'styled-system/css';
import { ROUTE_PATH, SPOT_NEW_PATH, UPLOAD_PATH } from '@/shared/routes';
import { ThemeToggle } from './ThemeToggle';

// 페이지 높이·지도 경계에 관계없이 현재 화면의 하단을 기준으로 둔다.
//
// 화면 아래에 동작 바가 깔린 페이지에서는 그 위로 올라간다. 바가 가로를 다
// 쓰기 때문에 옆으로 비킬 자리가 없다. 바 높이(여백 16 + 컨트롤 44 + 아래
// 여백 20)만큼 띄우고, 그 위에 다시 16px을 둔다.
const dock = css({
  position: 'fixed',
  right: { base: '5', md: '8' },
  bottom: '[calc(24px + env(safe-area-inset-bottom))]',
  zIndex: 'docked',
  'body:has([data-floating-bar]) &': {
    bottom: {
      base: '[calc(16px + 44px + max(20px, env(safe-area-inset-bottom)) + 16px)]',
      lg: '[calc(24px + env(safe-area-inset-bottom))]',
    },
  },
});
const actions = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  width: '48',
});
const action = css.raw({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2',
  minHeight: 'control',
  px: '4',
  rounded: 'control',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.border',
  bg: 'ui.surface',
  color: 'ui.ink',
  textStyle: 'button',
  boxShadow: 'floating',
  whiteSpace: 'nowrap',
  _hover: { borderColor: 'ui.accentHover', color: 'ui.accentText' },
  '&[aria-current=page]': {
    outlineWidth: 'thick',
    outlineStyle: 'solid',
    outlineColor: 'ui.accent',
    outlineOffset: '0.5',
  },
  _motionSafe: {
    transitionProperty: 'common',
    transitionDuration: 'fast',
    _hover: { transform: 'translateY(-2px)' },
    _active: { transform: 'scale(0.98)' },
  },
});
const linkAction = css(action);
// 이 묶음에서 주 동작은 업로드 하나다. 채움은 그 하나만 든다.
const uploadAction = css(action, {
  borderColor: 'ui.accent',
  bg: 'ui.floatingAction',
  color: 'ui.onFloatingAction',
  _hover: {
    borderColor: 'ui.floatingActionHover',
    bg: 'ui.floatingActionHover',
    color: 'ui.onFloatingAction',
  },
});
const utilityRow = css({ display: 'flex', gap: '2' });
const pinAction = css(action, { flex: '1', px: '3' });
const themeControl = css({
  display: 'flex',
  alignItems: 'center',
  rounded: 'control',
  boxShadow: 'floating',
});
const icon = css({ width: '5', height: '5', flexShrink: '0' });
const trigger = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2',
  width: 'controlLg',
  height: 'controlLg',
  listStyle: 'none',
  cursor: 'pointer',
  rounded: 'control',
  bg: 'ui.floatingAction',
  color: 'ui.onFloatingAction',
  boxShadow: 'floating',
  textStyle: 'bodySm',
  _hover: { bg: 'ui.floatingActionHover' },
  '&::-webkit-details-marker': { display: 'none' },
  '& > svg': {
    width: '6',
    height: '6',
    _motionSafe: {
      transitionProperty: 'common',
      transitionDuration: 'fast',
    },
  },
  'details[open] > &': {
    outlineWidth: 'thick',
    outlineStyle: 'solid',
    outlineColor: 'ui.accent',
    outlineOffset: '0.5',
    '& > svg': { transform: 'rotate(45deg)' },
  },
});
const menuLabel = css({ srOnly: true });
const popover = css({
  position: 'absolute',
  right: '0',
  bottom: '[calc(100% + 12px)]',
});

function ActionIcon({ kind }: { kind: 'route' | 'upload' | 'pin' | 'menu' }) {
  return (
    <svg
      className={icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'route' && (
        <>
          <circle cx="6" cy="5" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="M8 5h8a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h8" />
        </>
      )}
      {kind === 'upload' && <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" />}
      {kind === 'pin' && <path d="M12 5v14M5 12h14" />}
      {kind === 'menu' && <path d="M12 5v14M5 12h14" />}
    </svg>
  );
}

function QuickActions({ pathname }: { pathname: string }) {
  return (
    <nav className={actions} aria-label="빠른 동작">
      <Link
        className={linkAction}
        href={ROUTE_PATH}
        aria-current={pathname === ROUTE_PATH ? 'page' : undefined}
      >
        <ActionIcon kind="route" />
        동선 만들기
      </Link>
      <Link
        className={uploadAction}
        href={UPLOAD_PATH}
        aria-current={pathname === UPLOAD_PATH ? 'page' : undefined}
      >
        <ActionIcon kind="upload" />
        업로드
      </Link>
      <div className={utilityRow}>
        <Link
          className={pinAction}
          href={SPOT_NEW_PATH}
          aria-current={pathname === SPOT_NEW_PATH ? 'page' : undefined}
        >
          <ActionIcon kind="pin" />핀 찍기
        </Link>
        <div className={themeControl}>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

/** 공통 레이아웃에서 한 번 렌더링해 모든 화면의 같은 위치에 메뉴를 둔다. */
export function FloatingNavigation() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key === 'Escape' && menu?.open === true) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    }
    function closeOnOutsideClick(event: PointerEvent) {
      const menu = menuRef.current;
      if (
        menu?.open === true &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      ) {
        menu.open = false;
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [pathname]);
  return (
    <details key={pathname} ref={menuRef} className={dock}>
      <summary className={trigger} aria-label="메뉴">
        <ActionIcon kind="menu" />
        <span className={menuLabel}>메뉴</span>
      </summary>
      <div className={popover}>
        <QuickActions pathname={pathname} />
      </div>
    </details>
  );
}
