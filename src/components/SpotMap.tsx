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

interface NaverPoint {
  readonly _brand: 'naverPoint';
}

interface NaverMaps {
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  Point: new (x: number, y: number) => NaverPoint;
  Map: new (
    element: HTMLElement,
    options: { center: NaverLatLng; zoom: number },
  ) => NaverMap;
  Marker: new (options: {
    position: NaverLatLng;
    map: NaverMap;
    title?: string;
    icon?: { content: string; anchor: NaverPoint };
  }) => NaverMarker;
  Event: {
    addListener(
      target: NaverMap | NaverMarker,
      event: string,
      handler: () => void,
    ): void;
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
  /** 마커를 고르면 그 id를 올린다. */
  onMarkerSelect?: (id: string) => void;
  /** 중심을 현재 위치로 표시할지. 스팟 마커가 아니라 맥동하는 점으로 그린다. */
  hasLocationDot?: boolean;
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

const LOCATION_DOT_SIZE = 14;

const locationDot = css({
  position: 'relative',
  width: '[14px]',
  height: '[14px]',
  rounded: 'full',
  bg: 'violet.600',
  boxShadow: 'sm',
  _dark: { bg: 'violet.400' },
});

// 흰 선은 안쪽에 넣는다. 바깥 테두리로 두면 점이 그만큼 커져 지도 위에서
// 마커처럼 읽힌다.
const locationEdge = css({
  position: 'absolute',
  inset: '0',
  rounded: 'full',
  // 토큰은 1px(hairline)과 2px(thick)뿐인데, 14px 원에서 1px은 묻히고 2px은
  // 원을 먹는다. 이 한 자리만 사이 값으로 둔다.
  borderWidth: '[1.5px]',
  borderStyle: 'solid',
  borderColor: 'white',
  _dark: { borderColor: 'slate.950' },
});

// 점 뒤에서 번지는 링. 시선을 한 번 끌어 주는 장치라 계속 돈다.
const locationRing = css({
  position: 'absolute',
  top: '[50%]',
  left: '[50%]',
  // 점보다 크게 시작해 바깥으로 퍼진다. 점 뒤에 깔아야 원 가장자리를 덮지
  // 않는다.
  width: '[24px]',
  height: '[24px]',
  marginTop: '[-12px]',
  marginLeft: '[-12px]',
  zIndex: '[-1]',
  rounded: 'full',
  bg: 'violet.500',
  opacity: '[0.55]',
  animationName: 'ping',
  // 프리셋의 duration은 전환용이라 여기 쓰기엔 짧다. 천천히 번지게 둔다.
  animationDuration: '[2.4s]',
  animationTimingFunction: 'out',
  animationIterationCount: '[infinite]',
  // 움직임을 줄여 달라고 한 사용자에게는 멈춘 원으로 보인다.
  _motionReduce: { animationName: '[none]' },
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
  hasLocationDot = false,
  onMarkerSelect,
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
        if (hasLocationDot) {
          new maps.Marker({
            position: center,
            map,
            title: '현재 위치',
            icon: {
              content: `<div class="${locationDot}"><span class="${locationRing}"></span><span class="${locationEdge}"></span></div>`,
              anchor: new maps.Point(
                LOCATION_DOT_SIZE / 2,
                LOCATION_DOT_SIZE / 2,
              ),
            },
          });
        }
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
              const marker = new maps.Marker({
                position,
                map,
                title: spot.name,
              });
              if (onMarkerSelect !== undefined) {
                maps.Event.addListener(marker, 'click', () => {
                  onMarkerSelect(spot.id);
                });
              }
              drawn.set(spot.id, marker);
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
  }, [
    hasCoordinate,
    latitude,
    longitude,
    hasMarker,
    markers,
    hasLocationDot,
    onMarkerSelect,
  ]);

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
