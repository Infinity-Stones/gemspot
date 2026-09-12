import Image from 'next/image';
import Link from 'next/link';
import { css } from 'styled-system/css';
import { HOME_PATH } from '@/shared/routes';

/**
 * 없는 주소로 들어왔을 때.
 *
 * 무엇이 잘못됐는지보다 **어디로 가면 되는지**를 먼저 보여 준다. 이 화면에서
 * 할 수 있는 일은 홈으로 돌아가는 것 하나뿐이라, 그 하나만 크게 둔다.
 */
const shell = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5',
  minHeight: '[70dvh]',
  px: '6',
  textAlign: 'center',
});

const mark = css({ width: '[72px]', height: 'auto', opacity: '[0.6]' });

const title = css({
  textStyle: '2xl',
  fontWeight: 'bold',
  letterSpacing: 'tight',
});

const message = css({
  textStyle: 'md',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

const homeLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '12',
  px: '6',
  rounded: 'full',
  bg: 'violet.600',
  color: 'white',
  textStyle: 'md',
  fontWeight: 'semibold',
  transition: 'colors',
  _hover: { bg: 'violet.700' },
  _dark: { bg: 'violet.500', color: 'slate.950', _hover: { bg: 'violet.400' } },
});

export default function NotFound() {
  return (
    <main className={shell}>
      <Image
        className={mark}
        src="/brand/gemspot-mark.png"
        alt=""
        width={512}
        height={512}
      />
      <h1 className={title}>없는 주소입니다</h1>
      <p className={message}>
        주소가 바뀌었거나 지워진 화면이에요. 지도로 돌아가 저장한 장소를 다시 볼
        수 있습니다.
      </p>
      <Link className={homeLink} href={HOME_PATH}>
        지도로 가기
      </Link>
    </main>
  );
}
