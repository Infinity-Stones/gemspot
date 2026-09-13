'use client';

import { useEffect, useRef, useState } from 'react';
import { css } from 'styled-system/css';
import type { Itinerary } from '@/domain/route';
import { useTheme } from '@/hooks/useTheme';
import { loadNaverMaps, subscribeNaverMapsAuthFailure } from '../naverMaps';
import type { NaverMap, NaverMaps, NaverMarker } from '../naverMaps';
import { legsToLines } from './routePresentation';

const pin = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '8',
  height: '8',
  px: '2',
  rounded: 'full',
  bg: 'violet.600',
  color: 'white',
  fontWeight: 'bold',
  boxShadow: 'md',
  borderWidth: '2px',
  borderColor: 'white',
  _dark: { bg: 'violet.400', color: 'slate.950', borderColor: 'slate.950' },
});
const frame = css({
  position: 'relative',
  height: '[360px]',
  rounded: 'xl',
  overflow: 'hidden',
  bg: 'slate.100',
  _dark: { bg: 'slate.900' },
});
const canvas = css({
  width: 'full',
  height: 'full',
  color: 'violet.600',
  _dark: { color: 'violet.400' },
});
const overlay = css({
  position: 'absolute',
  inset: '0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '3',
  p: '6',
  textAlign: 'center',
  textStyle: 'sm',
  color: 'slate.700',
  bg: 'slate.100',
  _dark: { color: 'slate.300', bg: 'slate.900' },
});
const retryButton = css({
  rounded: 'lg',
  px: '4',
  py: '2',
  bg: 'violet.600',
  color: 'white',
  cursor: 'pointer',
  _dark: { bg: 'violet.500' },
});

export function RouteMap({ itinerary }: { readonly itinerary: Itinerary }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<{ maps: NaverMaps; map: NaverMap } | null>(null);
  const firstPoint = useRef(itinerary.start.coord);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  const { theme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeNaverMapsAuthFailure(() => {
      if (!cancelled) setStatus('failed');
    });
    let map: NaverMap | null = null;
    loadNaverMaps()
      .then(maps => {
        if (cancelled || container.current === null) return;
        const point = firstPoint.current;
        map = new maps.Map(container.current, {
          center: new maps.LatLng(point.latitude, point.longitude),
          zoom: 16,
        });
        instance.current = { maps, map };
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });
    return () => {
      cancelled = true;
      unsubscribe();
      instance.current = null;
      // 인증 실패 시 SDK가 내부 객체를 먼저 정리할 수 있다.
      try {
        map?.destroy();
      } catch {
        /* 이미 무효화된 지도 */
      }
    };
  }, [attempt]);

  useEffect(() => {
    const current = instance.current;
    const element = container.current;
    if (status !== 'ready' || current === null || element === null) return;
    const { maps, map } = current;
    const overlays: NaverMarker[] = [];
    const points = [
      itinerary.start.coord,
      ...itinerary.stops.map(stop => stop.candidate.coord),
    ];
    const positions = points.map(
      point => new maps.LatLng(point.latitude, point.longitude),
    );
    const color = getComputedStyle(element).color;
    for (const line of legsToLines(itinerary.legs)) {
      const path = line.path.map(
        point => new maps.LatLng(point.latitude, point.longitude),
      );
      positions.push(...path);
      overlays.push(
        new maps.Polyline({
          map,
          path,
          strokeColor: color,
          strokeWeight: 5,
          strokeOpacity: 0.85,
          strokeStyle: line.source === 'estimate' ? 'shortdash' : 'solid',
        }),
      );
    }
    points.forEach((point, i) => {
      const label = i === 0 ? '출발' : String(i);
      overlays.push(
        new maps.Marker({
          map,
          position: new maps.LatLng(point.latitude, point.longitude),
          title:
            i === 0
              ? '출발점'
              : `${label}. ${itinerary.stops[i - 1]?.candidate.name ?? ''}`,
          icon: {
            content: `<span class="${pin}">${label}</span>`,
            anchor: new maps.Point(16, 16),
          },
        }),
      );
    });
    map.fitBounds(positions, { top: 48, right: 48, bottom: 48, left: 48 });
    return () => {
      for (const item of overlays) {
        try {
          item.setMap(null);
        } catch {
          /* 인증 실패로 SDK가 이미 정리한 오버레이 */
        }
      }
    };
  }, [status, itinerary, theme]);

  return (
    <section
      aria-label="도보 동선 지도"
      className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}
    >
      <div className={frame}>
        <div
          ref={container}
          className={canvas}
          role="application"
          aria-label="출발점과 방문 순서를 표시한 지도"
        />
        {status !== 'ready' && (
          <div className={overlay} role="status">
            <p>
              {status === 'loading'
                ? '도보 동선 지도를 불러오는 중입니다'
                : '지도를 불러오지 못했어요. 아래 방문 목록은 계속 확인할 수 있어요.'}
            </p>
            {status === 'failed' && (
              <button
                type="button"
                className={retryButton}
                onClick={() => {
                  setStatus('loading');
                  setAttempt(value => value + 1);
                }}
              >
                지도 다시 불러오기
              </button>
            )}
          </div>
        )}
      </div>
      <p
        className={css({
          textStyle: 'sm',
          color: 'slate.600',
          _dark: { color: 'slate.400' },
        })}
      >
        출발 → {itinerary.stops.map((_, i) => String(i + 1)).join(' → ')}
        {itinerary.hasEstimatedLegs
          ? ' · 점선은 보행 경로를 확인하지 못한 추정 구간입니다.'
          : ' · 보행 경로를 기준으로 한 예상 시간입니다.'}
      </p>
    </section>
  );
}
