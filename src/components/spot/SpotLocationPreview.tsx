'use client';

import { useEffect, useState } from 'react';
import { css } from 'styled-system/css';
import type { LocateAddressResult } from '@/domain/spot';
import { SpotMap } from '../SpotMap';

export type LocateSpotAddress = (
  address: string,
) => Promise<LocateAddressResult>;

interface Props {
  readonly name: string;
  readonly address: string;
  readonly locate: LocateSpotAddress;
}

const section = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  my: '2',
});

const heading = css({
  textStyle: 'bodySm',
  fontWeight: 'medium',
  color: 'ui.ink',
});

const frame = css({
  height: '64',
  width: 'full',
  overflow: 'hidden',
  rounded: 'panel',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.muted',
});

const message = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '3',
  height: 'full',
  px: '4',
  textAlign: 'center',
});

const hint = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

const retry = css({
  minHeight: '10',
  px: '4',
  rounded: 'control',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'ui.border',
  color: 'ui.ink',
  textStyle: 'bodySm',
  fontWeight: 'medium',
  cursor: 'pointer',
  _hover: { bg: 'ui.muted' },
});

function AddressPreview({ name, address, locate }: Props) {
  const [result, setResult] = useState<LocateAddressResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const located = await locate(address);
        if (!cancelled) setResult(located);
      } catch {
        if (!cancelled) setResult({ kind: 'unavailable', reason: 'http' });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [address, locate, attempt]);

  return (
    <section className={section} aria-label={`${name} 위치 미리보기`}>
      <h3 className={heading}>지도에서 위치 확인</h3>
      <div className={frame}>
        {result?.kind === 'ready' ? (
          <SpotMap
            latitude={result.location.coordinates.latitude}
            longitude={result.location.coordinates.longitude}
            placeName={name}
          />
        ) : (
          <div className={message}>
            <p className={hint} role="status">
              {result === null
                ? '주소로 핀 위치를 찾고 있습니다…'
                : result.kind === 'not_found'
                  ? '이 주소의 위치를 찾지 못했어요. 주소가 맞는지 확인해 주세요.'
                  : '위치를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}
            </p>
            {result !== null && (
              <button
                className={retry}
                type="button"
                onClick={() => {
                  setResult(null);
                  setAttempt(current => current + 1);
                }}
              >
                위치 다시 확인
              </button>
            )}
          </div>
        )}
      </div>
      {result?.kind === 'ready' && (
        <p className={hint}>핀 위치가 맞는지 확인한 뒤 저장을 선택해 주세요.</p>
      )}
    </section>
  );
}

export function SpotLocationPreview(props: Props) {
  // 주소가 바뀌면 이전 핀을 즉시 치우고 새 요청을 시작한다.
  return <AddressPreview key={props.address} {...props} />;
}
