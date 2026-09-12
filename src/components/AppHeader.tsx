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
  bg: 'slate.900',
  color: 'white',
  textStyle: 'sm',
  fontWeight: 'medium',
  _dark: { bg: 'slate.100', color: 'slate.900' },
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
