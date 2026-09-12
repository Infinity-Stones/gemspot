import { css } from 'styled-system/css';
import type { DroppedSpot, Itinerary } from '@/domain/route';
import { labelOf } from '@/shared/spotCategory';
import { formatSeoulHourMinute } from '@/shared/time';

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
  px: '4',
  py: '4',
  rounded: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  _dark: { borderColor: 'slate.800' },
});

const head = css({ display: 'flex', flexDirection: 'column', gap: '1' });
const headline = css({ textStyle: 'lg', fontWeight: 'semibold' });
const muted = css({ textStyle: 'sm', color: 'slate.600', _dark: { color: 'slate.400' } });

const badge = css({
  px: '3',
  py: '2',
  rounded: 'lg',
  bg: 'slate.100',
  color: 'slate.700',
  textStyle: 'sm',
  _dark: { bg: 'slate.900', color: 'slate.300' },
});

// 종료 시각 초과는 정보가 아니라 경고다. 회색에 섞어 두면 지나친다.
const warning = css({
  px: '3',
  py: '2',
  rounded: 'lg',
  bg: 'amber.100',
  color: 'amber.900',
  textStyle: 'sm',
  _dark: { bg: 'amber.950', color: 'amber.200' },
});

const list = css({ display: 'flex', flexDirection: 'column', gap: '3', listStyle: 'none', p: '0', m: '0' });

const legLine = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  pl: '9',
  textStyle: 'sm',
  color: 'slate.500',
  _dark: { color: 'slate.400' },
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
  bg: 'violet.600',
  color: 'white',
  textStyle: 'sm',
  fontWeight: 'semibold',
  _dark: { bg: 'violet.500', color: 'slate.950' },
});

const stopBody = css({ display: 'flex', flexDirection: 'column', gap: '1' });
const stopTitle = css({ textStyle: 'md', fontWeight: 'medium' });
const edge = css({ textStyle: 'sm', color: 'slate.600', fontWeight: 'medium', _dark: { color: 'slate.400' } });

const droppedSection = css({ display: 'flex', flexDirection: 'column', gap: '2' });
const droppedList = css({ display: 'flex', flexDirection: 'column', gap: '1', listStyle: 'none', p: '0', m: '0' });

const DROP_REASON_TEXT: Readonly<Record<DroppedSpot['reason'], string>> = {
  outside_window: '이 시간대엔 문을 열지 않아요',
  outside_area: '그 동네에서 멀어요',
  over_time: '시간이 부족해 뺐어요',
  user: '직접 뺐어요',
};

function kilometers(meters: number): string {
  return (meters / 1000).toFixed(1);
}

interface Props {
  readonly itinerary: Itinerary;
  readonly areaName: string;
  /** 문장에서 "꼭 갈 곳"으로 나왔지만 저장된 스팟과 짝이 안 맞은 이름. */
  readonly unmatchedRequiredNames?: readonly string[];
}

export function ItineraryList({ itinerary, areaName, unmatchedRequiredNames = [] }: Props) {
  const { stops, legs, dropped } = itinerary;
  const overMinutes = Math.ceil(itinerary.overBySeconds / 60);

  return (
    <section className={shell} aria-label="제안된 동선">
      <header className={head}>
        <p className={headline}>
          {formatSeoulHourMinute(itinerary.window.start)}~{formatSeoulHourMinute(itinerary.window.end)} · {areaName}
        </p>
        <p className={muted}>
          총 도보 {String(itinerary.totalWalkMinutes)}분 · {kilometers(itinerary.totalDistanceM)} km
          {itinerary.hasEstimatedLegs ? ' · 일부 구간 추정' : ''}
        </p>
      </header>

      {itinerary.ordering === 'rule' && (
        <p className={badge} role="status">
          규칙 기반 순서 — AI 제안을 받지 못해 가까운 곳부터 정렬했어요.
        </p>
      )}

      {itinerary.overBySeconds > 0 && (
        <p className={warning} role="status">
          꼭 갈 곳만 남겨도 종료 시각을 {String(overMinutes)}분 넘어요. 한 곳을 빼거나 시간을 늘려 주세요.
        </p>
      )}

      {unmatchedRequiredNames.length > 0 && (
        <p className={badge} role="status">
          저장된 스팟에서 찾지 못한 이름: {unmatchedRequiredNames.join(', ')}
        </p>
      )}

      <p className={edge}>{formatSeoulHourMinute(itinerary.start.departAt)} 출발</p>

      <ol className={list}>
        {stops.map((stop, index) => {
          const leg = legs[index];
          return (
            <li key={stop.candidate.id}>
              {leg !== undefined && (
                <p className={legLine}>
                  도보 {String(Math.round(leg.durationS / 60))}분 · {String(leg.distanceM)}m
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
                    {labelOf(stop.candidate.category)} · 체류 {String(stop.dwellMinutes)}분
                    {stop.required ? ' · 꼭 갈 곳' : ''}
                  </p>
                  {stop.reason !== null && <p className={muted}>{stop.reason}</p>}
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
