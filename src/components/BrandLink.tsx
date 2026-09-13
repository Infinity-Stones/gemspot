import Image from 'next/image';
import Link from 'next/link';
import { css } from 'styled-system/css';
import { HOME_PATH } from '@/shared/routes';

const wordmark = css({
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  width: 'fit',
  minHeight: '11',
  flexShrink: '0',
});
const logoLight = css({
  display: 'block',
  height: '8',
  width: 'auto',
  _dark: { display: 'none' },
});
const logoDark = css({
  display: 'none',
  height: '8',
  width: 'auto',
  _dark: { display: 'block' },
});

/** 별도 상단바 없이 각 화면의 소개 영역에 놓는 홈 링크. */
export function BrandLink() {
  return (
    <Link className={wordmark} href={HOME_PATH} aria-label="GemSpot 홈">
      <Image
        className={logoLight}
        src="/brand/gemspot-logo.png"
        alt="GemSpot"
        width={365}
        height={120}
        priority
      />
      <Image
        className={logoDark}
        src="/brand/gemspot-logo-dark.png"
        alt=""
        width={365}
        height={120}
        priority
      />
    </Link>
  );
}
