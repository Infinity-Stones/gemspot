import Image from 'next/image';
import Link from 'next/link';
import { css } from 'styled-system/css';
import { HOME_PATH, ROUTE_PATH, SPOT_NEW_PATH, UPLOAD_PATH } from '@/shared/routes';

const header = css({
  display: 'flex',
  flexWrap: 'wrap',
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

// 로고. 원본은 public/brand/에 있고 파비콘(src/app/icon.png)과 같은 마크다.
// 라이트/다크를 이미지 둘로 가르는 이유: 워드마크의 "Gem"이 검은 글자라 어두운
// 지면에서 사라진다. CSS filter로 뒤집으면 보라까지 함께 뒤집힌다.
const wordmark = css({ display: 'inline-flex', alignItems: 'center', minHeight: '11' });
const logoLight = css({ display: 'block', height: '8', width: 'auto', _dark: { display: 'none' } });
const logoDark = css({ display: 'none', height: '8', width: 'auto', _dark: { display: 'block' } });

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

// 세컨더리 — 동선 만들기. 업로드가 이 앱의 주 행동이라 프라이머리는 하나만
// 두고, 동선은 같은 높이·모양의 윤곽 버튼으로 옆에 선다(T44 진입 링크).
const routeLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  minHeight: '11',
  px: '4',
  rounded: 'full',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'violet.600',
  color: 'violet.700',
  textStyle: 'sm',
  fontWeight: 'medium',
  _hover: { bg: 'violet.50' },
  _dark: { borderColor: 'violet.400', color: 'violet.300', _hover: { bg: 'violet.950' } },
});

const actions = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2' });

export function AppHeader() {
  return (
    <header className={header}>
      <Link className={wordmark} href={HOME_PATH} aria-label="GemSpot 홈">
        <Image className={logoLight} src="/brand/gemspot-logo.png" alt="GemSpot" width={365} height={120} priority />
        <Image className={logoDark} src="/brand/gemspot-logo-dark.png" alt="" width={365} height={120} priority />
      </Link>
      <nav className={actions} aria-label="주요 동작">
        <Link className={routeLink} href={ROUTE_PATH}>
          동선 만들기
        </Link>
        {/* 주소로 스팟을 만드는 두 번째 입구(T51). 업로드와 같은 결과(핀)를
            만들지만 주 행동은 업로드라 윤곽으로 둔다. */}
        <Link className={routeLink} href={SPOT_NEW_PATH}>
          핀 찍기
        </Link>
        <Link className={uploadLink} href={UPLOAD_PATH}>
          업로드
        </Link>
      </nav>
    </header>
  );
}
