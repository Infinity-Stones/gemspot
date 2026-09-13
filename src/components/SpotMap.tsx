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
  setZoom(zoom: number): void;
  fitBounds(
    bounds: NaverLatLng[],
    options: { top: number; right: number; bottom: number; left: number },
  ): void;
  getBounds(): NaverBounds;
  destroy(): void;
}

interface NaverEventListener {
  readonly _brand: 'naverEventListener';
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
    ): NaverEventListener;
    removeListener(listener: NaverEventListener): void;
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
const FIT_BOUNDS_PADDING = 48;

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
  /** 지도를 띄웠거나 띄우지 못한 것이 판가름 났을 때 한 번 부른다. */
  onSettled?: () => void;
  /** 중심을 현재 위치로 표시할지. 스팟 마커가 아니라 맥동하는 점으로 그린다. */
  hasLocationDot?: boolean;
  /** 현재 위치가 없을 때 저장된 핀이 모두 들어오도록 최초 범위를 맞춘다. */
  fitMarkers?: boolean;
}

const frame = css({
  position: 'relative',
  width: 'full',
  height: 'full',
  bg: 'ui.muted',
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
  bg: 'ui.accent',
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
  borderColor: 'ui.surface',
});

const SPOT_PIN_WIDTH = 40;
const SPOT_PIN_HEIGHT = 40;

// 저장된 스팟 핀. 기본 마커는 파란색이라 프라이머리와 어긋나고, 다른 서비스의
// 지도와 구분되지 않는다. 브랜드 마크가 이미 핀 모양이라 그대로 쓴다.
const spotPin = css({
  display: 'block',
  width: '[40px]',
  height: '[40px]',
  // 원본이 512px이라 축소해서 쓴다. 고밀도 화면에서도 뭉개지지 않는다.
  objectFit: 'contain',
});

// 스팟 핀은 한 곳에서 만든다. 중심으로 열린 스팟과 목록에서 그린 스팟이 다른
// 모양이면, 핀을 고르는 순간 같은 자리의 핀이 바뀐 것처럼 보인다.
function gemPinIcon(maps: NaverMaps) {
  return {
    content: `<img class="${spotPin}" src="/brand/gemspot-mark.png" alt="" />`,
    // 마크의 아래 꼭짓점이 실제 좌표를 가리킨다.
    anchor: new maps.Point(SPOT_PIN_WIDTH / 2, SPOT_PIN_HEIGHT),
  };
}

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
  bg: 'ui.accent',
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
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

export function SpotMap({
  latitude,
  longitude,
  placeName,
  hasMarker = true,
  markers = [],
  hasLocationDot = false,
  onMarkerSelect,
  onSettled,
  fitMarkers = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<NaverMaps | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const [status, setStatus] = useState<MapStatus>('loading');

  // 계약은 숫자를 약속하지만 NaN도 숫자다. 지도에 넘기기 전에 한 번 거른다 —
  // NaN이 들어가면 핀이 조용히 사라지고 원인이 이 자리에서 멀어진다.
  const hasCoordinate = Number.isFinite(latitude) && Number.isFinite(longitude);

  // 최초 중심은 지도를 만들 때 한 번만 쓴다. 이후 이동은 아래 effect가 맡으므로
  // 여기 값이 바뀐다고 지도를 다시 만들지 않는다.
  const initialCenterRef = useRef({ latitude, longitude });

  // 지도는 한 번만 만든다. 좌표나 마커가 바뀔 때마다 새로 만들면 이전 지도와
  // 그 리스너가 같은 자리에 그대로 남아 겹겹이 쌓인다.
  useEffect(() => {
    if (!hasCoordinate) return;

    let cancelled = false;

    loadNaverMaps()
      .then(maps => {
        const element = containerRef.current;
        if (cancelled || element === null) return;

        const { latitude: startLatitude, longitude: startLongitude } =
          initialCenterRef.current;
        const center = new maps.LatLng(startLatitude, startLongitude);

        mapsRef.current = maps;
        mapRef.current = new maps.Map(element, { center, zoom: DEFAULT_ZOOM });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [hasCoordinate]);

  // 성공이든 실패든 판가름이 나면 한 번 알린다. 위를 덮고 있는 인트로가
  // 그때 물러난다 — 실패했는데 인트로가 남아 있으면 화면이 멈춘 것처럼 보인다.
  useEffect(() => {
    if (status === 'loading') return;
    onSettled?.();
  }, [status, onSettled]);

  // 중심 이동은 지도를 다시 만들지 않고 옮기기만 한다.
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (maps === null || map === null || !hasCoordinate) return;

    map.setCenter(new maps.LatLng(latitude, longitude));
  }, [status, latitude, longitude, hasCoordinate]);

  // 위치 권한 없이 저장된 핀으로 시작할 때만 전체 범위를 맞춘다. 한 건은
  // 경계의 폭과 높이가 0이라 SDK가 과도하게 확대할 수 있어 기본 줌을 쓴다.
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (maps === null || map === null || !fitMarkers || markers.length === 0)
      return;

    const positions = markers.map(
      marker => new maps.LatLng(marker.latitude, marker.longitude),
    );
    if (positions.length === 1) {
      const only = positions[0];
      if (only === undefined) return;
      map.setCenter(only);
      map.setZoom(DEFAULT_ZOOM);
      return;
    }

    map.fitBounds(positions, {
      top: FIT_BOUNDS_PADDING,
      right: FIT_BOUNDS_PADDING,
      bottom: FIT_BOUNDS_PADDING,
      left: FIT_BOUNDS_PADDING,
    });
  }, [status, fitMarkers, markers]);

  // 중심 표시(스팟 마커 · 현재 위치 점).
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (maps === null || map === null || !hasCoordinate) return;

    const position = new maps.LatLng(latitude, longitude);
    const marks: NaverMarker[] = [];

    if (hasMarker) {
      marks.push(new maps.Marker({ position, map, icon: gemPinIcon(maps) }));
    }
    if (hasLocationDot) {
      marks.push(
        new maps.Marker({
          position,
          map,
          title: '현재 위치',
          icon: {
            content: `<div class="${locationDot}"><span class="${locationRing}"></span><span class="${locationEdge}"></span></div>`,
            anchor: new maps.Point(
              LOCATION_DOT_SIZE / 2,
              LOCATION_DOT_SIZE / 2,
            ),
          },
        }),
      );
    }

    return () => {
      for (const mark of marks) mark.setMap(null);
    };
  }, [status, latitude, longitude, hasCoordinate, hasMarker, hasLocationDot]);

  // 저장된 스팟은 보이는 영역에 드는 것만 그린다. 지도를 옮기면 들어온 것을
  // 만들고 나간 것을 지운다 — 매번 전부 만들면 이전 마커가 그대로 남는다.
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (maps === null || map === null) return;

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
            icon: gemPinIcon(maps),
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

    const listener = maps.Event.addListener(map, 'idle', redraw);
    redraw();

    return () => {
      maps.Event.removeListener(listener);
      for (const marker of drawn.values()) marker.setMap(null);
      drawn.clear();
    };
  }, [status, markers, onMarkerSelect]);

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
