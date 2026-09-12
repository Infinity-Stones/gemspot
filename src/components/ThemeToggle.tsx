'use client';

import { css } from 'styled-system/css';
import { useTheme } from '@/hooks/useTheme';

const button = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  px: '3',
  py: '2',
  rounded: 'full',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'slate.300',
  bg: 'white',
  color: 'slate.600',
  cursor: 'pointer',
  textStyle: 'sm',
  transition: 'colors',
  _hover: {
    borderColor: 'slate.400',
    color: 'slate.900',
  },
  _dark: {
    borderColor: 'slate.700',
    bg: 'slate.900',
    color: 'slate.400',
    _hover: {
      borderColor: 'slate.600',
      color: 'slate.100',
    },
  },
});

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? '라이트' : '다크';

  return (
    <button
      type="button"
      className={button}
      onClick={toggle}
      // 아이콘만으로는 스크린 리더에 아무것도 전달되지 않는다. 지금 상태가
      // 아니라 **누르면 무엇이 되는지**를 말한다 — 버튼의 접근 가능한 이름은
      // 동작을 가리켜야 한다.
      aria-label={`${next} 테마로 전환`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
      <span>{next}</span>
    </button>
  );
}
