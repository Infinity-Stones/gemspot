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

interface NaverBounds {
  hasLatLng(position: NaverLatLng): boolean;
}

interface NaverMap {
  setCenter(position: NaverLatLng): void;
  getBounds(): NaverBounds;
}

interface NaverMarker {
  setMap(map: NaverMap | null): void;
}

interface NaverMaps {
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  Map: new (
    element: HTMLElement,
    options: { center: NaverLatLng; zoom: number },
  ) => NaverMap;
  Marker: new (options: {
    position: NaverLatLng;
    map: NaverMap;
    title?: string;
  }) => NaverMarker;
  Event: {
    addListener(target: NaverMap, event: string, handler: () => void): void;
  };
}

/** 지도에 찍을 한 건. 도메인 모양을 그대로 받지 않는다 — 지도는 좌표와 이름만 안다. */
export interface MapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

const SCRIPT_ID = 'naver-maps-sdk';
const SCRIPT_SOURCE = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}`;

const DEFAULT_ZOOM = 16;

function readNaverMaps(): NaverMaps | null {
  const candidate = (globalThis as { naver?: { maps?: NaverMaps } }).naver
    ?.maps;
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
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : document.createElement('script');

    const handleLoad = () => {
      const maps = readNaverMaps();
      if (maps === null) {
        reject(new Error('지도 SDK가 실렸지만 naver.maps가 없습니다'));
        return;
      }
      resolve(maps);
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener(
      'error',
      () => {
        reject(new Error('지도 SDK를 받지 못했습니다'));
      },
      { once: true },
    );

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
  /** 위도 · 경도. 계약이 숫자로 좁혀 두므로 여기서 파싱하지 않는다. */
  latitude: number;
  longitude: number;
  placeName: string;
  /** 중심에 마커를 찍을지. 현재 위치처럼 중심만 잡는 경우에는 끈다. */
  hasMarker?: boolean;
  /** 저장된 스팟들. 지금 보이는 영역에 드는 것만 그린다. */
  markers?: readonly MapMarker[];
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

export function SpotMap({
  latitude,
  longitude,
  placeName,
  hasMarker = true,
  markers = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>('loading');

  // 계약은 숫자를 약속하지만 NaN도 숫자다. 지도에 넘기기 전에 한 번 거른다 —
  // NaN이 들어가면 핀이 조용히 사라지고 원인이 이 자리에서 멀어진다.
  const hasCoordinate = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    if (!hasCoordinate) return;

    let cancelled = false;

    loadNaverMaps()
      .then(maps => {
        const element = containerRef.current;
        if (cancelled || element === null) return;

        const center = new maps.LatLng(latitude, longitude);
        const map = new maps.Map(element, { center, zoom: DEFAULT_ZOOM });
        if (hasMarker) new maps.Marker({ position: center, map });
        map.setCenter(center);

        // 보이는 영역에 드는 것만 그린다. 지도를 옮기면 들어온 것을 만들고
        // 나간 것을 지운다 — 다시 그릴 때마다 전부 만들면 이전 마커가 지도에
        // 남는다.
        const drawn = new Map<string, NaverMarker>();
        const redraw = () => {
          const bounds = map.getBounds();
          for (const spot of markers) {
            const position = new maps.LatLng(spot.latitude, spot.longitude);
            const isVisible = bounds.hasLatLng(position);
            const existing = drawn.get(spot.id);

            if (isVisible && existing === undefined) {
              drawn.set(
                spot.id,
                new maps.Marker({ position, map, title: spot.name }),
              );
              continue;
            }
            if (!isVisible && existing !== undefined) {
              existing.setMap(null);
              drawn.delete(spot.id);
            }
          }
        };

        maps.Event.addListener(map, 'idle', redraw);
        redraw();
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [hasCoordinate, latitude, longitude, hasMarker, markers]);

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
          {resolved === 'loading'
            ? '지도를 불러오는 중입니다'
            : '지도를 불러오지 못했습니다. 주소로 위치를 확인해 주세요.'}
        </p>
      )}
    </div>
  );
}
