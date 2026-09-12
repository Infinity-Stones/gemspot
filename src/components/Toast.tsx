'use client';

import { useEffect } from 'react';
import { css } from 'styled-system/css';

interface Props {
  message: string;
  /** 머무는 시간. 지나면 스스로 사라진다. */
  durationMs?: number;
  onDismiss: () => void;
}

const toast = css({
  position: 'fixed',
  // 하단 플로팅 버튼 위로 띄운다. 버튼에 붙으면 눌러야 할 것과 읽어야 할 것이
  // 한 덩어리로 보인다.
  bottom: '28',
  left: '4',
  right: '4',
  zIndex: 'toast',
  mx: 'auto',
  maxWidth: 'sm',
  px: '4',
  py: '3',
  rounded: 'lg',
  bg: 'slate.900',
  color: 'slate.50',
  textStyle: 'sm',
  fontWeight: 'medium',
  textAlign: 'center',
  boxShadow: 'lg',
  _dark: { bg: 'slate.100', color: 'slate.900' },
});

/**
 * 지나가도 되는 알림. 화면에 자리를 잡고 앉으면 사용자가 그것을 치우는 일까지
 * 해야 하므로, 읽고 나면 스스로 사라진다.
 *
 * `role="status"`는 포커스를 뺏지 않고 읽어 준다 — 사용자가 지금 하는 입력을
 * 끊지 않아야 하는 알림이라 `alert`이 아니다.
 */
export function Toast({ message, durationMs = 4000, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(timer);
    };
  }, [durationMs, onDismiss]);

  return (
    <p className={toast} role="status">
      {message}
    </p>
  );
}
