'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { css } from 'styled-system/css';

const overlay = css({
  position: 'absolute',
  inset: '0',
  overflow: 'hidden',
  pointerEvents: 'none',
  bg: 'design.ink/30',
});

const scan = css({
  position: 'absolute',
  inset: '0',
  borderBottomWidth: '2px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'ui.accent',

  opacity: '0.5',
  animationName: '[upload-scan]',
  animationDuration: '[3.6s]',
  animationTimingFunction: 'in-out',
  animationIterationCount: '[infinite]',
  _motionReduce: {
    animationName: '[none]',
    transform: '[translateY(-50%)]',
  },
});

const badge = css({
  position: 'absolute',
  top: '3',
  left: '3',
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  px: '3',
  py: '2',
  rounded: 'badge',
  bg: 'ui.tag',
  color: 'ui.onTag',
  textStyle: 'caption',
  fontWeight: 'medium',
});

const dot = css({
  width: '1.5',
  height: '1.5',
  rounded: 'full',
  bg: 'ui.accent',
  animationName: 'pulse',
  animationDuration: '[2s]',
  animationIterationCount: '[infinite]',
  _motionReduce: { animationName: '[none]' },
});

const status = css({
  alignSelf: 'center',
  width: 'full',
  maxWidth: 'sm',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '3',
});

const gem = css({
  flexShrink: '0',
  width: '10',
  height: '10',
  animationName: 'bounce',
  animationDuration: '[2.4s]',
  animationIterationCount: '[infinite]',
  _motionReduce: { animationName: '[none]' },
});

const copy = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

const title = css({
  textStyle: 'bodySm',
  fontWeight: 'semibold',
  color: 'ui.ink',
});

const hint = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

const elapsed = css({
  textStyle: 'bodySm',
  fontVariantNumeric: 'tabular-nums',
  color: 'ui.ink',
});

/** 실제 검출 영역을 가장하지 않고, 선택한 이미지를 읽는 중임을 표시한다. */
export function UploadScanOverlay() {
  return (
    <div className={overlay} aria-hidden="true">
      <div className={scan} />
      <div className={badge}>
        <span className={dot} />
        AI 분석 중
      </div>
    </div>
  );
}

/** pending 동안만 마운트한다. 재시도 때는 경과 시간을 처음부터 센다. */
export function UploadAnalysisStatus() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const takingLonger = seconds >= 30;

  return (
    <div className={status}>
      <Image
        className={gem}
        src="/brand/gemspot-mark.png"
        alt=""
        width={40}
        height={40}
        aria-hidden="true"
      />
      <div className={copy}>
        <div role="status" aria-atomic="true">
          <p className={title}>
            {takingLonger
              ? '분석이 계속 진행 중이에요'
              : '스크린샷 속 장소를 찾고 있어요'}
          </p>
          <p className={hint}>
            {takingLonger
              ? '이미지에 따라 시간이 더 걸릴 수 있어요. 완료되면 결과를 보여드릴게요.'
              : 'AI가 가게 이름과 주소를 읽고 있어요. 완료되면 결과 화면으로 이동해요.'}
          </p>
        </div>
        <p className={elapsed} role="timer" aria-live="off">
          {seconds}초 경과
        </p>
      </div>
    </div>
  );
}
