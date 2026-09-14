'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { css } from 'styled-system/css';
import type { Itinerary } from '@/domain/route';
import type { SpotCoordinates } from '@/shared/spot';

const frame = css({
  position: 'relative',
  isolation: 'isolate',
  height: { base: '[360px]', md: '[480px]' },
  rounded: 'panel',
  overflow: 'hidden',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
});
const canvas = css({
  width: 'full',
  height: 'full',
  color: 'ui.accent',
  bg: 'ui.muted',
});
const markerClass = css({
  width: 'full',
  height: 'full',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  rounded: 'full',
  bg: 'ui.action',
  color: 'ui.onAction',
  borderWidth: 'thick',
  borderStyle: 'solid',
  borderColor: 'ui.surface',
  textStyle: 'bodySm',
  fontWeight: 'semibold',
});
const overlay = css({
  position: 'absolute',
  inset: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: '6',
  bg: 'ui.surface',
  color: 'ui.subtle',
  textStyle: 'bodySm',
});
const caption = css({ textStyle: 'bodySm', color: 'ui.subtle', mt: '3' });
const link = css({ color: 'ui.accentText', textDecoration: 'underline' });

export function ItineraryMap({ itinerary }: { readonly itinerary: Itinerary }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );
  const [tileFailure, setTileFailure] = useState(false);
  const hasOsm = itinerary.legs.some(leg => leg.source === 'osm');

  useEffect(() => {
    const element = elementRef.current;
    if (element === null) return;
    let cancelled = false;
    let map: LeafletMap | undefined;
    let resizeObserver: ResizeObserver | undefined;

    // Leaflet는 window를 사용한다. 서버 렌더에서는 실행하지 않고 결과가 있을 때만 싣는다.
    void import('leaflet')
      .then(L => {
        if (cancelled) return;
        const point = (coord: SpotCoordinates): LatLngTuple => [
          coord.latitude,
          coord.longitude,
        ];
        const markers = [
          { coord: itinerary.start.coord, name: '출발', label: '출발' },
          ...itinerary.stops.map((stop, index) => ({
            coord: stop.candidate.coord,
            name: `${String(index + 1)}. ${stop.candidate.name}`,
            label: String(index + 1),
          })),
        ];
        const bounds = L.latLngBounds([
          ...markers.map(marker => point(marker.coord)),
          ...itinerary.legs.flatMap(leg => leg.path.map(point)),
        ]);
        map = L.map(element, { scrollWheelZoom: false });
        const fitRoute = () => {
          map?.invalidateSize({ pan: false });
          map?.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 16,
            animate: false,
          });
        };
        fitRoute();
        // 레이아웃 변경은 window.resize 없이도 일어날 수 있다.
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(fitRoute);
          resizeObserver.observe(element);
        }
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on('tileerror', () => {
            if (!cancelled) setTileFailure(true);
          })
          .addTo(map);

        for (const marker of markers) {
          // 가게 이름은 HTML로 해석하지 않는다.
          const tooltip = document.createElement('span');
          tooltip.textContent = marker.name;
          L.marker(point(marker.coord), {
            title: marker.name,
            icon: L.divIcon({
              // Leaflet의 unlayered .leaflet-marker-icon { display: block }과
              // Panda 레이어가 충돌하지 않도록 실제 배지는 안쪽에 둔다.
              className: '',
              html: `<span class="${markerClass}">${marker.label}</span>`,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            }),
          })
            .bindTooltip(tooltip)
            .addTo(map);
        }
        for (const leg of itinerary.legs) {
          if (leg.path.length < 2) continue;
          L.polyline(leg.path.map(point), {
            color: getComputedStyle(element).color,
            weight: 5,
            opacity: leg.source === 'estimate' ? 0.65 : 0.9,
            ...(leg.source === 'estimate' ? { dashArray: '8 10' } : {}),
          }).addTo(map);
        }
        setTileFailure(false);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      // 경로·마커·이벤트도 함께 제거해 StrictMode와 새 동선 생성에 안전하다.
      map?.remove();
    };
  }, [itinerary]);

  return (
    <section aria-label="동선 지도">
      <div className={frame}>
        <div
          ref={elementRef}
          className={canvas}
          role="application"
          aria-label="동선 지도"
        />
        {status !== 'ready' && (
          <p className={overlay} role="status">
            {status === 'loading'
              ? '지도를 불러오고 있어요.'
              : '지도를 불러오지 못했어요. 아래 일정 목록을 확인해 주세요.'}
          </p>
        )}
      </div>
      {tileFailure && (
        <p className={caption} role="status">
          지도 배경을 일부 불러오지 못했어요. 경로와 아래 일정 목록을 확인해
          주세요.
        </p>
      )}
      <p className={caption}>
        출발 → 번호 순서로 걸어보세요. 실선은 도보 경로예요.
        {itinerary.hasEstimatedLegs &&
          ' 점선은 경로를 확인하지 못한 구간의 직선 추정이에요.'}
      </p>
      {hasOsm && (
        <p className={caption}>
          도보 경로 ©{' '}
          <a className={link} href="https://www.openstreetmap.org/copyright">
            OpenStreetMap contributors
          </a>
          {' · '}
          <a
            className={link}
            href="https://routing.openstreetmap.de/about.html"
          >
            OSRM / FOSSGIS
          </a>
          {' · '}
          <a className={link} href="https://www.openstreetmap.org/fixthemap">
            지도 오류 수정
          </a>
        </p>
      )}
    </section>
  );
}
