import type { ReactNode } from 'react';
import { css } from 'styled-system/css';

/**
 * 화면 아래에 띄우는 주 동작 자리.
 *
 * 세로로 긴 내용에서는 다음으로 넘어가는 버튼이 접혀 보이지 않는다. 그 버튼을
 * 화면에 붙여 두고, 뒤에는 바탕에서 흐려지는 띠를 깔아 아래 글이 버튼에 겹쳐
 * 읽히지 않게 한다.
 *
 * 자리만 만든다 — 무엇을 띄울지는 쓰는 쪽이 정한다. 쓰는 화면은 내용 아래에
 * 이 띠만큼 여백을 둬야 마지막 줄이 가리지 않는다.
 */
interface Props {
  children: ReactNode;
}

const backdrop = css({
  position: 'fixed',
  left: '0',
  right: '0',
  bottom: '0',
  zIndex: '[99]',
  height: '28',
  pointerEvents: 'none',
  // 아래쪽은 바탕색 그대로 두고 위 끝에서만 흐려진다. 흐려지는 구간이 넓으면
  // 버튼 주변이 뿌옇게 보인다.
  backgroundImage:
    '[linear-gradient(to top, token(colors.slate.50) 72%, transparent)]',
  _dark: {
    backgroundImage:
      '[linear-gradient(to top, token(colors.slate.950) 72%, transparent)]',
  },
});

const bar = css({
  position: 'fixed',
  left: '6',
  right: '6',
  bottom: '6',
  zIndex: '[100]',
  mx: 'auto',
  maxWidth: 'sm',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

export function FloatingActionBar({ children }: Props) {
  return (
    <>
      <div className={backdrop} aria-hidden="true" />
      <div className={bar}>{children}</div>
    </>
  );
}
