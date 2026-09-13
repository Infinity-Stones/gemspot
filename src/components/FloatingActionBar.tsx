import type { ReactNode } from 'react';
import { css } from 'styled-system/css';

interface Props {
  children: ReactNode;
}

// 모바일에서는 화면 아래, 넓은 화면에서는 해당 폼 안에 놓는다.
// 모바일 오른쪽은 화면 하단의 56px 플로팅 메뉴와 16px 간격을 위해 비운다.
const bar = css({
  position: { base: 'fixed', lg: 'static' },
  left: '0',
  right: '0',
  bottom: '0',
  zIndex: 'docked',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  width: 'full',
  pl: { base: '5', lg: '0' },
  pr: {
    base: '[calc(20px + 56px + 16px)]',
    md: '[calc(32px + 56px + 16px)]',
    lg: '0',
  },
  pt: '4',
  pb: { base: '[max(20px, env(safe-area-inset-bottom))]', lg: '0' },
  bg: 'ui.surface',
  roundedTop: 'input',
});

export function FloatingActionBar({ children }: Props) {
  return <div className={bar}>{children}</div>;
}
