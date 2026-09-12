import { css } from 'styled-system/css';
import type { PlanFailure } from '@/domain/route';
import { labelOf } from '@/shared/spotCategory';
import { formatSeoulHourMinute } from '@/shared/time';
import { DROP_REASON_TEXT } from './routePresentation';

/**
 * 제안하지 않는 경우 — T47(#62).
 *
 * **빈 화면으로 끝나는 경로가 없다.** 다섯 경우가 각각 다른 문구를 받고, 왜
 * 안 됐는지와 다음에 무엇을 하면 되는지를 함께 말한다.
 *
 * 되묻기(`needs_clarification`)는 여기서 다루지 않는다. 그것은 실패가 아니라
 * 대화의 한 턴이라 입력창 위 말풍선으로 간다.
 */

const box = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  p: '6',
  rounded: 'panel',
  bg: 'ui.muted',
  color: 'ui.ink',
  textStyle: 'bodySm',
});

const detail = css({ textStyle: 'bodySm', color: 'ui.subtle' });

const droppedList = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  listStyle: 'none',
  p: '0',
  m: '0',
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

interface Props {
  readonly failure: PlanFailure;
}

export function PlanFailureNotice({ failure }: Props) {
  if (failure.kind === 'no_candidates') {
    // "없다"만 말하면 스팟을 더 저장해야 하는지 시간을 바꿔야 하는지 모른다.
    // 무엇이 왜 빠졌는지 보이면 다음 수가 스스로 떠오른다.
    return (
      <div className={box} role="alert">
        <p>
          {formatSeoulHourMinute(failure.window.start)}~
          {formatSeoulHourMinute(failure.window.end)}에 {failure.areaName}에서
          갈 만한 스팟이 없어요.
        </p>
        {failure.dropped.length > 0 && (
          <ul className={droppedList}>
            {failure.dropped.map(item => (
              <li key={`${item.candidate.id}-${item.reason}`}>
                {item.candidate.name} ({labelOf(item.candidate.category)}) —{' '}
                {DROP_REASON_TEXT[item.reason]}
              </li>
            ))}
          </ul>
        )}
        <p className={detail}>
          시간대를 바꾸거나 다른 동네로 다시 말해 주세요.
        </p>
      </div>
    );
  }

  if (failure.kind === 'area_not_found') {
    return (
      <div className={box} role="alert">
        <p>&apos;{failure.areaName}&apos;의 위치를 찾지 못했어요.</p>
        <p className={detail}>
          동네 이름을 다시 알려 주세요. 구 이름을 붙이면(예: 성동구 성수동) 더
          잘 찾습니다.
        </p>
      </div>
    );
  }

  if (failure.kind === 'interpretation_failed') {
    return (
      <div className={box} role="alert">
        <p>요청을 이해하지 못했어요.</p>
        <p className={detail}>
          언제, 어디서 걷고 싶은지를 넣어 다시 말해 주세요. 예: 오늘 저녁
          7시부터 9시까지 성수동에서 카페 들르면서.
        </p>
      </div>
    );
  }

  if (failure.kind === 'service_unavailable') {
    return (
      <div className={box} role="alert">
        <p>지금은 동선을 만들 수 없어요.</p>
        <p className={detail}>
          {failure.service === 'llm' ? '요청을 해석하는' : '동네 위치를 찾는'}{' '}
          기능이 응답하지 않습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  // needs_clarification은 입력창 위 말풍선이 맡는다. 여기 오면 분기가 어긋난 것이라
  // 빈 화면 대신 마지막 그물을 둔다.
  return (
    <div className={box} role="alert">
      <p>동선을 제안하지 못했어요. 다시 말해 주세요.</p>
    </div>
  );
}
