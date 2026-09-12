import Link from 'next/link';
import { css } from 'styled-system/css';
import { HOME_PATH, UPLOAD_PATH } from '@/shared/routes';

const header = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  px: '5',
  py: '3',
  bg: 'white',
  borderBottomWidth: 'hairline',
  borderBottomStyle: 'solid',
  borderBottomColor: 'slate.200',
  _dark: {
    bg: 'slate.900',
    borderBottomColor: 'slate.800',
  },
});

// 로고 자리. 지금은 서비스명을 글자로 두고, 로고가 나오면 이 자리만 바뀐다.
const wordmark = css({
  textStyle: 'lg',
  fontWeight: 'bold',
  letterSpacing: 'tight',
});

const uploadLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  minHeight: '11',
  px: '5',
  rounded: 'full',
  // 프라이머리는 퍼플이다. 흰 글자를 얹으므로 500이 아니라 600에서 시작한다 —
  // 500 위에서는 대비가 4.5:1을 넘지 못한다.
  bg: 'violet.600',
  color: 'white',
  textStyle: 'sm',
  fontWeight: 'medium',
  _hover: { bg: 'violet.700' },
  _dark: { bg: 'violet.500', color: 'slate.950', _hover: { bg: 'violet.400' } },
});

export function AppHeader() {
  return (
    <header className={header}>
      <Link className={wordmark} href={HOME_PATH}>
        gemspot
      </Link>
      <Link className={uploadLink} href={UPLOAD_PATH}>
        업로드
      </Link>
    </header>
  );
}
