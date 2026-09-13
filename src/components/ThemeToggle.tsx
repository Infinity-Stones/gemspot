'use client';

import { css } from 'styled-system/css';
import { useTheme } from '@/hooks/useTheme';

const button = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  width: '12',
  height: '12',
  rounded: 'control',
  bg: 'ui.surface/80',
  color: 'ui.ink',
  backdropFilter: 'auto',
  backdropBlur: 'md',
  cursor: 'pointer',
  _hover: { bg: 'ui.surface/90' },
});
const icon = css({ width: '5', height: '5' });

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
      <svg
        className={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        {theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20 15.2A8.6 8.6 0 0 1 8.8 4 8.6 8.6 0 1 0 20 15.2Z" />
        )}
      </svg>
    </button>
  );
}
