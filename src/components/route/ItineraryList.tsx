import { css } from 'styled-system/css';
import type { Itinerary } from '@/domain/route';
import { labelOf } from '@/shared/spotCategory';
import { formatSeoulHourMinute } from '@/shared/time';
import { DROP_REASON_TEXT } from './routePresentation';
import { actionButton, row } from './routeStyles';

/**
 * 제안된 여정 — T49(#73).
 *
 * 지도(T46)는 이 위에 얹는 부가 정보다. **이 목록만으로 여정을 따라갈 수
 * 있어야 한다** — 지도를 못 불러와도 어디를 몇 시에 가는지는 알아야 한다.
 *
 * 조건부로만 나오는 줄이 여럿이다(이유 · 배지 · 경고 · 빠진 스팟). 없을 때
 * 빈 칸을 남기지 않는 이유는, 빈 자리가 "아직 로딩 중"처럼 보이기 때문이다.
 */

const shell = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  px: '6',
  py: '6',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
});

const head = css({ display: 'flex', flexDirection: 'column', gap: '1' });
const headline = css({ textStyle: 'subheading' });
const muted = css({ textStyle: 'bodySm', color: 'ui.subtle' });

const badge = css({
  px: '3',
  py: '2',
  rounded: 'control',
  bg: 'ui.tag',
  color: 'ui.ink',
  textStyle: 'bodySm',
});

// 종료 시각 초과는 정보가 아니라 경고다. 회색에 섞어 두면 지나친다.
const warning = css({
  px: '3',
  py: '2',
  rounded: 'control',
  bg: 'ui.muted',
  color: 'ui.ink',
  textStyle: 'bodySm',
});

const list = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  listStyle: 'none',
  p: '0',
  m: '0',
});

const legLine = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  pl: '9',
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

const stopRow = css({ display: 'flex', alignItems: 'flex-start', gap: '3' });

const number = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  width: '6',
  height: '6',
  rounded: 'full',
  bg: 'ui.tag',
  color: 'ui.onTag',
  textStyle: 'caption',
  fontWeight: 'medium',
});

const stopBody = css({ display: 'flex', flexDirection: 'column', gap: '1' });
const stopTitle = css({ textStyle: 'body', fontWeight: 'medium' });
const edge = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
  fontWeight: 'medium',
});

const droppedSection = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});
const droppedList = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  listStyle: 'none',
  p: '0',
  m: '0',
});

function kilometers(meters: number): string {
  return (meters / 1000).toFixed(1);
}

interface Props {
  readonly itinerary: Itinerary;
  readonly areaName: string;
  /** 문장에서 "꼭 갈 곳"으로 나왔지만 저장된 스팟과 짝이 안 맞은 이름. */
  readonly unmatchedRequiredNames?: readonly string[];
  readonly pending?: boolean;
  readonly onEdit?: (
    intent: 'remove' | 'up' | 'down' | 'restore',
    spotId: string,
  ) => void;
}

export function ItineraryList({
  itinerary,
  areaName,
  unmatchedRequiredNames = [],
  pending = false,
  onEdit,
}: Props) {
  const { stops, legs, dropped } = itinerary;
  const overMinutes = Math.ceil(itinerary.overBySeconds / 60);

  return (
    <section className={shell} aria-label="제안된 동선">
      <header className={head}>
        <p className={headline}>
          {formatSeoulHourMinute(itinerary.window.start)}~
          {formatSeoulHourMinute(itinerary.window.end)} · {areaName}
        </p>
        <p className={muted}>
          총 도보 {String(itinerary.totalWalkMinutes)}분 ·{' '}
          {kilometers(itinerary.totalDistanceM)} km
          {itinerary.hasEstimatedLegs
            ? legs.every(leg => leg.source === 'estimate')
              ? ' · 전체 구간 추정'
              : ' · 일부 구간 추정'
            : ''}
        </p>
        <p className={muted}>
          장소에서 머무는 시간은 총{' '}
          {String(stops.reduce((sum, stop) => sum + stop.dwellMinutes, 0))}
          분이에요. 실제 영업시간은 방문 전에 확인해 주세요.
        </p>
      </header>

      {itinerary.ordering === 'rule' && (
        <p className={badge} role="status">
          규칙 기반 순서 — AI 제안을 받지 못해 가까운 곳부터 정렬했어요.
        </p>
      )}

      {itinerary.overBySeconds > 0 && (
        <p className={warning} role="status">
          예정한 종료 시각보다 {String(overMinutes)}분 넘어요. 한 곳을 빼거나
          시간을 늘려 주세요.
        </p>
      )}

      {unmatchedRequiredNames.length > 0 && (
        <p className={badge} role="status">
          저장된 스팟에서 찾지 못한 이름: {unmatchedRequiredNames.join(', ')}
        </p>
      )}

      <p className={edge}>
        {formatSeoulHourMinute(itinerary.start.departAt)} 출발
      </p>

      <ol className={list}>
        {stops.map((stop, index) => {
          const leg = legs[index];
          return (
            <li key={stop.candidate.id}>
              {leg !== undefined && (
                <p className={legLine}>
                  도보 {String(Math.round(leg.durationS / 60))}분 ·{' '}
                  {String(leg.distanceM)}m
                  {leg.source === 'estimate' ? ' (추정)' : ''}
                </p>
              )}
              <div className={stopRow}>
                <span className={number} aria-hidden="true">
                  {String(index + 1)}
                </span>
                <div className={stopBody}>
                  <p className={stopTitle}>
                    {formatSeoulHourMinute(stop.arriveAt)} {stop.candidate.name}
                  </p>
                  <p className={muted}>
                    {labelOf(stop.candidate.category)} · 체류{' '}
                    {String(stop.dwellMinutes)}분
                    {stop.required ? ' · 꼭 갈 곳' : ''}
                  </p>
                  {stop.reason !== null && (
                    <p className={muted}>{stop.reason}</p>
                  )}
                  {onEdit !== undefined && (
                    <div className={row}>
                      <button
                        type="button"
                        className={actionButton}
                        aria-label={`${stop.candidate.name} 위로`}
                        disabled={pending || index === 0}
                        onClick={() => onEdit('up', stop.candidate.id)}
                      >
                        위로
                      </button>
                      <button
                        type="button"
                        className={actionButton}
                        aria-label={`${stop.candidate.name} 아래로`}
                        disabled={pending || index === stops.length - 1}
                        onClick={() => onEdit('down', stop.candidate.id)}
                      >
                        아래로
                      </button>
                      <button
                        type="button"
                        className={actionButton}
                        aria-label={`${stop.candidate.name} 빼기`}
                        disabled={pending || stops.length === 1}
                        title={
                          stops.length === 1
                            ? '동선에는 한 곳 이상이 필요해요'
                            : undefined
                        }
                        onClick={() => onEdit('remove', stop.candidate.id)}
                      >
                        빼기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className={edge}>{formatSeoulHourMinute(itinerary.endAt)} 끝</p>

      {dropped.length > 0 && (
        <section className={droppedSection} aria-label="빠진 스팟">
          <p className={muted}>이번 동선에서 빠진 곳</p>
          <ul className={droppedList}>
            {dropped.map(item => (
              <li key={`${item.candidate.id}-${item.reason}`} className={muted}>
                {item.candidate.name} — {DROP_REASON_TEXT[item.reason]}
                {item.reason === 'user' && onEdit !== undefined && (
                  <button
                    type="button"
                    className={actionButton}
                    aria-label={`${item.candidate.name} 되돌리기`}
                    disabled={pending}
                    onClick={() => onEdit('restore', item.candidate.id)}
                  >
                    되돌리기
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
