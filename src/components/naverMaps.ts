import { NAVER_MAP_CLIENT_ID } from '@/shared/naverMap';

/**
 * 지도 SDK가 window에 심는 것 중 이 화면이 쓰는 만큼만 적는다. 전체를 받아
 * 적으면 SDK가 올라갈 때마다 여기가 따라 틀어진다.
 */
export interface NaverLatLng {
  readonly _brand: 'naverLatLng';
}

interface NaverBounds {
  hasLatLng(position: NaverLatLng): boolean;
}

export interface NaverMap {
  setCenter(position: NaverLatLng): void;
  setZoom(zoom: number): void;
  fitBounds(
    bounds: NaverLatLng[],
    options: { top: number; right: number; bottom: number; left: number },
  ): void;
  getBounds(): NaverBounds;
  destroy(): void;
}

export interface NaverEventListener {
  readonly _brand: 'naverEventListener';
}

export interface NaverMarker {
  setMap(map: NaverMap | null): void;
}

interface NaverPoint {
  readonly _brand: 'naverPoint';
}

export interface NaverMaps {
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  Point: new (x: number, y: number) => NaverPoint;
  Map: new (
    element: HTMLElement,
    options: {
      center: NaverLatLng;
      zoom: number;
      logoControlOptions?: { position: number };
      mapDataControlOptions?: { position: number };
      scaleControlOptions?: { position: number };
    },
  ) => NaverMap;
  /** 컨트롤을 놓을 자리. SDK가 주는 상수를 그대로 쓴다. */
  Position: { BOTTOM_LEFT: number };
  Marker: new (options: {
    position: NaverLatLng;
    map: NaverMap;
    title?: string;
    icon?: { content: string; anchor: NaverPoint };
  }) => NaverMarker;
  Polyline: new (options: {
    map: NaverMap;
    path: NaverLatLng[];
    strokeColor: string;
    strokeWeight: number;
    strokeOpacity: number;
    strokeStyle: 'solid' | 'shortdash';
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

const SCRIPT_ID = 'naver-maps-sdk';
const SCRIPT_SOURCE = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}`;
let pending: Promise<NaverMaps> | null = null;
let authenticationFailed = false;
const authFailureListeners = new Set<() => void>();

/** 인증 실패는 SDK의 load 이벤트 이후에도 발생할 수 있다. */
export function subscribeNaverMapsAuthFailure(
  listener: () => void,
): () => void {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

/**
 * 네이버 로고와 저작권 표기를 왼쪽 아래로 모은다.
 *
 * 가리면 안 되는 표기인데(이용약관) 기본 자리가 오른쪽 아래라, 화면 아래
 * 떠 있는 동작 버튼과 겹친다. 로고가 이미 있는 쪽으로 붙여 둔다.
 */
export function bottomLeftControls(maps: NaverMaps) {
  const position = maps.Position.BOTTOM_LEFT;
  return {
    logoControlOptions: { position },
    mapDataControlOptions: { position },
    scaleControlOptions: { position },
  };
}

export function readNaverMaps(): NaverMaps | null {
  return (globalThis as { naver?: { maps?: NaverMaps } }).naver?.maps ?? null;
}

/** 여러 지도에서 SDK를 공유한다. 실패한 script는 제거해 다음 시도에서 다시 받는다. */
export function loadNaverMaps(): Promise<NaverMaps> {
  const retryAuthentication = authenticationFailed;
  if (retryAuthentication) {
    document.getElementById(SCRIPT_ID)?.remove();
    pending = null;
    authenticationFailed = false;
  }
  const host = globalThis as { navermap_authFailure?: () => void };
  host.navermap_authFailure = () => {
    authenticationFailed = true;
    for (const listener of authFailureListeners) listener();
  };
  if (pending !== null) return pending;
  const loaded = readNaverMaps();
  if (loaded !== null && !retryAuthentication) return Promise.resolve(loaded);
  pending = new Promise<NaverMaps>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    // 인증 실패로 전역 객체가 사라진 script에서는 load 이벤트가 다시 오지 않는다.
    if (
      existing instanceof HTMLScriptElement &&
      existing.dataset['state'] !== 'loading'
    ) {
      existing.remove();
      reject(new Error('지도 SDK를 사용할 수 없습니다'));
      return;
    }
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : document.createElement('script');
    const cleanup = () => {
      clearTimeout(timer);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onError = () => {
      cleanup();
      script.dataset['state'] = 'failed';
      script.remove();
      reject(new Error('지도를 불러오지 못했습니다'));
    };
    const onLoad = () => {
      script.dataset['state'] = 'loaded';
      const maps = readNaverMaps();
      if (maps === null || authenticationFailed) {
        onError();
        return;
      }
      cleanup();
      resolve(maps);
    };
    const timer = setTimeout(onError, 15_000);
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (existing === null) {
      script.id = SCRIPT_ID;
      script.dataset['state'] = 'loading';
      script.src = SCRIPT_SOURCE;
      script.async = true;
      document.head.appendChild(script);
    }
  }).finally(() => {
    // 성공 이후에도 SDK가 제거될 수 있으므로 완료된 인스턴스는 캐시하지 않는다.
    pending = null;
  });
  return pending;
}
