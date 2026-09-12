'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { css } from 'styled-system/css';

/**
 * 진입 인트로 — 앱을 켜면 브랜드 화면이 먼저 덮는다.
 *
 * 지도 SDK를 받고 위치를 잡는 동안 회색 바탕만 보이면 서비스가 무엇인지
 * 알려 주지 못하고, 로딩이 길어질수록 고장난 화면처럼 읽힌다.
 *
 * 첫 페인트부터 그린다. 붙은 뒤에 띄우면 그 사이 빈 화면이 한 번 스치는데,
 * 그건 인트로가 없는 것과 같다.
 */
// 한 번 보고 나면 다시 뜨지 않는다. 홈을 오갈 때마다 나오면 인트로가 아니라
// 길을 막는 화면이 된다. 탭을 닫으면 지워지므로 다음에 켤 때 다시 보인다.
const SESSION_KEY = 'gemspot.intro.shown';
const MINIMUM_VISIBLE_MS = 1600;
const FADE_MS = 420;

interface Props {
  /** 덮고 있던 화면이 준비됐는지. 최소 노출 시간이 지난 뒤 참이면 사라진다. */
  isReady: boolean;
}

const splash = css({
  position: 'fixed',
  inset: '0',
  zIndex: '[1000]',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5',
  bg: 'white',
  transition: 'opacity',
  transitionDuration: 'slow',
  _dark: { bg: 'slate.950' },
  _motionReduce: { transitionDuration: '[0ms]' },
});

const hidden = css({ opacity: '[0]', pointerEvents: 'none' });

const slogan = css({
  textStyle: 'md',
  fontWeight: 'medium',
  color: 'slate.700',
  _dark: { color: 'slate.200' },
});

const logoLight = css({
  display: 'block',
  width: '[200px]',
  height: 'auto',
  _dark: { display: 'none' },
});

const logoDark = css({
  display: 'none',
  width: '[200px]',
  height: 'auto',
  _dark: { display: 'block' },
});

export function IntroSplash({ isReady }: Props) {
  // 지도가 곧바로 준비되면 인트로가 눈에 닿지 않는다. 브랜드를 보여 주려고
  // 두는 화면이라 최소한 이만큼은 남긴다.
  const [isHeld, setIsHeld] = useState(true);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // 렌더 중에 상태를 바꾸지 않으려고 한 틱 뒤에 본다. 이미 본 세션이면
    // 그대로 걷는다.
    const seenTimer = setTimeout(() => {
      try {
        if (window.sessionStorage.getItem(SESSION_KEY) === 'true') {
          setIsDone(true);
          return;
        }
        window.sessionStorage.setItem(SESSION_KEY, 'true');
      } catch {
        // 저장소를 막아 둔 브라우저에서는 매번 보여 준다 — 안 뜨는 것보다 낫다.
      }
    }, 0);

    const holdTimer = setTimeout(() => {
      setIsHeld(false);
    }, MINIMUM_VISIBLE_MS);

    return () => {
      clearTimeout(seenTimer);
      clearTimeout(holdTimer);
    };
  }, []);

  const isFading = isReady && !isHeld;

  useEffect(() => {
    if (!isFading) return;

    // 투명해지는 동안은 자리를 지킨다. 먼저 걷으면 화면이 튄다.
    const timer = setTimeout(() => {
      setIsDone(true);
    }, FADE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isFading]);

  if (isDone) return null;

  return (
    <div
      className={isFading ? `${splash} ${hidden}` : splash}
      role="status"
      aria-live="polite"
      aria-label="GemSpot을 여는 중입니다"
    >
      <p className={slogan}>캡처가 내 추억이 되는 순간</p>
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
    </div>
  );
}
