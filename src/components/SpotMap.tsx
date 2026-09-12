'use client';

import { useEffect, useRef, useState } from 'react';
import { css } from 'styled-system/css';
import { NAVER_MAP_CLIENT_ID } from '@/shared/naverMap';

/**
 * 지도 SDK가 window에 심는 것 중 이 화면이 쓰는 만큼만 적는다. 전체를 받아
 * 적으면 SDK가 올라갈 때마다 여기가 따라 틀어진다.
 */
interface NaverLatLng {
  readonly _brand: 'naverLatLng';
}

interface NaverMap {
  setCenter(position: NaverLatLng): void;
}

interface NaverMaps {
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  Map: new (element: HTMLElement, options: { center: NaverLatLng; zoom: number }) => NaverMap;
  Marker: new (options: { position: NaverLatLng; map: NaverMap }) => unknown;
}

const SCRIPT_ID = 'naver-maps-sdk';
const SCRIPT_SOURCE = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}`;

const DEFAULT_ZOOM = 16;

function readNaverMaps(): NaverMaps | null {
  const candidate = (globalThis as { naver?: { maps?: NaverMaps } }).naver?.maps;
  return candidate ?? null;
}

/**
 * SDK를 한 번만 싣는다. 같은 화면을 다시 열거나 두 지도가 함께 뜰 때
 * `<script>`를 또 붙이면 SDK가 두 번 초기화되면서 마커가 사라진다.
 */
function loadNaverMaps(): Promise<NaverMaps> {
  const loaded = readNaverMaps();
  if (loaded !== null) return Promise.resolve(loaded);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    const script = existing instanceof HTMLScriptElement ? existing : document.createElement('script');

    const handleLoad = () => {
      const maps = readNaverMaps();
      if (maps === null) {
        reject(new Error('지도 SDK가 실렸지만 naver.maps가 없습니다'));
        return;
      }
      resolve(maps);
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', () => {
      reject(new Error('지도 SDK를 받지 못했습니다'));
    }, { once: true });

    if (existing === null) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SOURCE;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

type MapStatus = 'loading' | 'ready' | 'failed';

interface Props {
  /** Geocoding이 문자열로 주는 값을 그대로 받는다. 저장 스키마가 정해지면 맞춘다. */
  latitude: string;
  longitude: string;
  placeName: string;
}

const frame = css({
  position: 'relative',
  width: 'full',
  height: 'full',
  bg: 'slate.100',
  _dark: { bg: 'slate.900' },
});

const canvas = css({
  width: 'full',
  height: 'full',
});

const overlay = css({
  position: 'absolute',
  inset: '0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2',
  px: '6',
  textAlign: 'center',
  textStyle: 'sm',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

export function SpotMap({ latitude, longitude, placeName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>('loading');

  const coordinate = { latitude: Number(latitude), longitude: Number(longitude) };
  const hasCoordinate =
    Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude);

  useEffect(() => {
    if (!hasCoordinate) return;

    let cancelled = false;

    loadNaverMaps()
      .then((maps) => {
        const element = containerRef.current;
        if (cancelled || element === null) return;

        const center = new maps.LatLng(coordinate.latitude, coordinate.longitude);
        const map = new maps.Map(element, { center, zoom: DEFAULT_ZOOM });
        new maps.Marker({ position: center, map });
        map.setCenter(center);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [hasCoordinate, coordinate.latitude, coordinate.longitude]);

  // 좌표가 숫자가 아니면 지도를 부를 것도 없다 — 렌더 중에 판정되므로 상태로
  // 들고 있지 않는다.
  const resolved: MapStatus = hasCoordinate ? status : 'failed';

  return (
    <div className={frame}>
      <div
        ref={containerRef}
        className={canvas}
        role="application"
        aria-label={`${placeName} 위치 지도`}
      />
      {resolved !== 'ready' && (
        <p className={overlay} role="status">
          {resolved === 'loading' ? '지도를 불러오는 중입니다' : '지도를 불러오지 못했습니다. 주소로 위치를 확인해 주세요.'}
        </p>
      )}
    </div>
  );
}
