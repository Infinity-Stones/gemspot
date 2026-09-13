import type { ReactNode } from 'react';
import { css } from 'styled-system/css';

interface Props {
  children: ReactNode;
}

// 모바일에서는 화면 맨 아래에 가로로 꽉 차고, 넓은 화면에서는 해당 폼 안에
// 놓인다.
//
// 이 바가 화면의 바닥이다. 같은 모서리를 쓰는 플로팅 메뉴는 바를 비켜 그 위로
// 올라간다(FloatingNavigation) — 바가 폭을 다 쓰므로 옆으로 비킬 자리가 없다.
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
  px: { base: '5', md: '8', lg: '0' },
  pt: '4',
  pb: { base: '[max(20px, env(safe-area-inset-bottom))]', lg: '0' },
  bg: 'ui.surface',
  roundedTop: 'input',
});

export function FloatingActionBar({ children }: Props) {
  // 플로팅 메뉴가 이 표식을 보고 자기 자리를 바 위로 올린다.
  return (
    <div className={bar} data-floating-bar="">
      {children}
    </div>
  );
}
