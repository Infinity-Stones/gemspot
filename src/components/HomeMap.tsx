'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { css } from 'styled-system/css';
import { IntroSplash } from './IntroSplash';
import type { MapMarker } from './SpotMap';
import { SpotMap } from './SpotMap';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Props {
  /** 결과로 열린 스팟. 있으면 위치 권한과 무관하게 그 좌표를 본다. */
  spot: (Coordinates & { placeName: string }) | null;
  /** 저장된 스팟들. 지도가 보이는 영역에 드는 것만 그린다. */
  markers: readonly MapMarker[];
}

type LocationStatus = 'asking' | 'ready' | 'unavailable';

const notice = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4',
  height: 'full',
  px: '6',
  textAlign: 'center',
  bg: 'slate.100',
  _dark: { bg: 'slate.900' },
});

const noticeText = css({
  textStyle: 'md',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

const retryButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '11',
  px: '5',
  rounded: 'full',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'slate.300',
  bg: 'white',
  textStyle: 'sm',
  cursor: 'pointer',
  _dark: { borderColor: 'slate.700', bg: 'slate.900' },
});

export function HomeMap({ spot, markers }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<LocationStatus>('asking');
  const [attempt, setAttempt] = useState(0);
  const [isMapSettled, setIsMapSettled] = useState(false);

  const markMapSettled = useCallback(() => {
    setIsMapSettled(true);
  }, []);

  // 고른 핀은 주소에 남긴다. 뒤로가기로 닫히고 링크로 공유된다(T53 · #115).
  const selectMarker = useCallback(
    (id: string) => {
      router.push(`/?spot=${encodeURIComponent(id)}`, { scroll: false });
    },
    [router],
  );

  // 결과로 열렸으면 볼 좌표가 이미 있다. 그때는 위치를 묻지 않는다 — 확인하러
  // 들어온 사람에게 권한 창을 먼저 띄울 이유가 없다.
  const needsLocation = spot === null;

  useEffect(() => {
    if (!needsLocation) return;

    let cancelled = false;

    const markUnavailable = () => {
      if (!cancelled) setStatus('unavailable');
    };

    // 지원하지 않는 브라우저도 한 틱 뒤에 같은 실패 경로로 보낸다. 렌더 중에
    // 상태를 바꾸면 그 자리에서 다시 렌더가 돈다.
    if (!('geolocation' in navigator)) {
      const timer = setTimeout(markUnavailable, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    navigator.geolocation.getCurrentPosition(position => {
      if (cancelled) return;
      setCurrent({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setStatus('ready');
    }, markUnavailable);

    return () => {
      cancelled = true;
    };
  }, [needsLocation, attempt]);

  if (spot !== null) {
    return (
      <>
        <IntroSplash isReady={isMapSettled} />
        <SpotMap
          latitude={spot.latitude}
          longitude={spot.longitude}
          placeName={spot.placeName}
          markers={markers}
          onMarkerSelect={selectMarker}
          onSettled={markMapSettled}
        />
      </>
    );
  }

  if (status === 'unavailable') {
    // 현재 위치를 쓸 수 없어도 저장된 핀이 있으면 첫 좌표에서 지도를 만든 뒤
    // 목록 전체가 들어오도록 범위를 맞춘다(T52). 중심 마커는 목록의 첫 핀과
    // 겹치므로 따로 찍지 않는다.
    const first = markers[0];
    if (first !== undefined) {
      return (
        <>
          <IntroSplash isReady={isMapSettled} />
          <SpotMap
            latitude={first.latitude}
            longitude={first.longitude}
            placeName="저장한 스팟"
            hasMarker={false}
            markers={markers}
            fitMarkers
            onMarkerSelect={selectMarker}
            onSettled={markMapSettled}
          />
        </>
      );
    }

    // 위치도 없고 보여 줄 스팟도 없으면 지도를 띄우지 않는다. 시작점도 그릴
    // 것도 없는 빈 지도는 무엇을 해야 하는지 알려 주지 못한다.
    return (
      <div className={notice}>
        <IntroSplash isReady />
        <p className={noticeText}>
          내 주변 스팟을 보려면 위치 권한이 필요합니다. 브라우저 설정에서 위치
          사용을 허용해 주세요.
        </p>
        <button
          type="button"
          className={retryButton}
          onClick={() => {
            setStatus('asking');
            setAttempt(count => count + 1);
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (current === null) {
    return (
      <div className={notice}>
        <IntroSplash isReady={false} />
        <p className={noticeText}>현재 위치를 확인하고 있습니다</p>
      </div>
    );
  }

  return (
    <>
      <IntroSplash isReady={isMapSettled} />
      <SpotMap
        latitude={current.latitude}
        longitude={current.longitude}
        placeName="내 주변"
        hasMarker={false}
        hasLocationDot
        markers={markers}
        onMarkerSelect={selectMarker}
        onSettled={markMapSettled}
      />
    </>
  );
}
