'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { css } from 'styled-system/css';
import { primaryButton } from '../uiStyles';
import type { RoutePlanState } from '@/app/(main)/route/planState';
import { IDLE_STATE, MAX_SENTENCE_LENGTH } from '@/app/(main)/route/planState';
import type { PlanFailure, PlanSuccess } from '@/domain/route';
import { ItineraryList } from './ItineraryList';
import { PlanFailureNotice } from './PlanFailureNotice';
import { SPOT_NEW_PATH, UPLOAD_PATH } from '@/shared/routes';
import type { RouteCandidate, RouteConditions } from '@/shared/routeRequest';
import { InterpretationCard } from './InterpretationCard';
import { RouteMap } from './RouteMap';

/**
 * 한 문장을 받아 동선을 청하는 입력 — T44(#59).
 *
 * 입력은 `<textarea>` 하나다. 시간 · 동네 · 취향을 따로 받는 칸을 두지 않는다 —
 * 그 칸이 생기는 순간 폼이 된다. 빠진 조건은 서버가 되묻고(T36), 사용자는 같은
 * 칸에 이어서 답한다. 이전 문장은 위에 남고 다음 제출은 둘을 합쳐 보낸다.
 *
 * 결과는 세 상태로만 가른다 — 되묻기 · 여정 · 실패. 각 상태의 **내용**은
 * 해당 이슈가 채운다(T49 여정 목록, T47 실패 문구, T37 해석 카드). 여기는
 * 분기의 골격과 자리다.
 *
 * `action`을 prop으로 받는 이유는 테스트다. 서버 액션은 jsdom에서 돌지
 * 않으므로, 페이지가 실제 액션을 꽂고 테스트는 가짜를 꽂는다.
 */

export type PlanRouteAction = (
  state: RoutePlanState,
  formData: FormData,
) => Promise<RoutePlanState>;

interface Props {
  readonly action: PlanRouteAction;
  readonly spotCount: number;
  readonly loadFailed: boolean;
  readonly spots?: readonly RouteCandidate[];
  readonly replanAction?: PlanRouteAction;
  readonly editAction?: PlanRouteAction;
}

const EXAMPLE = '지금부터 두 시간 동안 성수동에서 카페 들르면서 걷고 싶어';

const shell = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
  width: 'full',
});

const form = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  bg: 'ui.surface',
  rounded: 'panel',
  p: { base: '4', md: '6' },
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
});

const textarea = css({
  width: 'full',
  minHeight: '40',
  px: '3',
  py: '3',
  rounded: 'input',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.border',
  bg: 'ui.input',
  color: 'ui.ink',
  textStyle: 'body',
  resize: 'vertical',
  _placeholder: { color: 'ui.subtle' },
});

const row = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
});

const counter = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
  fontFamily: 'sans',
});

const button = primaryButton;

// 안내는 프라이머리 계열의 옅은 바탕에 둔다. 파란 바탕은 이 화면 어디에도
// 없는 색이라 알림만 다른 서비스에서 온 것처럼 보인다.
const notice = css({
  px: '4',
  py: '4',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.accentBorder',
  bg: 'ui.accentMuted',
  color: 'ui.ink',
  textStyle: 'body',
});

const transcript = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  listStyle: 'none',
  p: '0',
  m: '0',
});

const said = css({
  alignSelf: 'flex-end',
  maxWidth: '[85%]',
  px: '4',
  py: '2',
  rounded: 'nav',
  bg: 'ui.tag',
  color: 'ui.onTag',
  textStyle: 'bodySm',
  whiteSpace: 'pre-wrap',
});

const asked = css({
  alignSelf: 'flex-start',
  maxWidth: '[85%]',
  px: '4',
  py: '2',
  rounded: 'control',
  bg: 'ui.tag',
  color: 'ui.ink',
  textStyle: 'bodySm',
});

const link = css({ color: 'ui.accentText', textDecoration: 'underline' });

/** 이미 해석한 조건을 보존하면서 추가 답을 받는 상태인가. */
function clarificationOf(
  state: RoutePlanState,
): Extract<PlanFailure, { kind: 'needs_clarification' }> | null {
  if (state.status !== 'done' || state.outcome.kind !== 'failed') return null;
  const { failure } = state.outcome;
  return failure.kind === 'needs_clarification' ? failure : null;
}

export function RouteComposer({
  action,
  spotCount,
  loadFailed,
  spots = [],
  replanAction,
  editAction,
}: Props) {
  const [state, setState] = useState<RoutePlanState>(IDLE_STATE);
  const [result, setResult] = useState<PlanSuccess | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const clarification = clarificationOf(state);
  const context = clarification?.draft ?? state.context;

  function run(
    nextAction: PlanRouteAction,
    formData: FormData,
    change = false,
  ) {
    if (pending) return;
    if (!change) setResult(null);
    startTransition(async () => {
      try {
        const next = await nextAction(state, formData);
        setState(next);
        if (next.status === 'done' && next.outcome.kind === 'ok') {
          setResult(next.outcome);
          if (!change) setDraft('');
        } else if (!change && clarificationOf(next) !== null) setDraft('');
      } catch {
        setState({
          status: 'invalid',
          message:
            '요청을 전송하지 못했어요. 입력한 내용으로 다시 시도해 주세요.',
          ...(context === undefined ? {} : { context }),
        });
      }
    });
  }

  function replan(conditions: RouteConditions) {
    if (replanAction === undefined) return;
    const data = new FormData();
    data.set('conditions', JSON.stringify(conditions));
    run(replanAction, data, true);
  }

  function edit(intent: 'remove' | 'up' | 'down' | 'restore', spotId: string) {
    if (editAction === undefined || result === null) return;
    const data = new FormData();
    data.set('plan', JSON.stringify(result));
    data.set('intent', intent);
    data.set('spotId', spotId);
    run(editAction, data, true);
  }

  if (loadFailed)
    return (
      <div className={shell}>
        <p className={notice} role="alert">
          저장한 스팟을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  if (spotCount === 0)
    return (
      <div className={shell}>
        <p className={notice} role="status">
          저장된 스팟이 없어요.{' '}
          <Link className={link} href={SPOT_NEW_PATH}>
            장소를 검색하거나
          </Link>{' '}
          <Link className={link} href={UPLOAD_PATH}>
            스크린샷을 올려
          </Link>{' '}
          스팟을 저장해 주세요.
        </p>
      </div>
    );

  return (
    <div className={shell}>
      {clarification !== null && state.status === 'done' && (
        <ol className={transcript} aria-label="지금까지의 대화">
          <li className={said}>{state.sentence}</li>
          <li className={asked} role="status">
            {clarification.question}
          </li>
        </ol>
      )}
      {context !== undefined && result === null && (
        <InterpretationCard draft={context} spots={spots} pending={pending} />
      )}
      <form className={form} action={formData => run(action, formData)}>
        <label className={css({ srOnly: true })} htmlFor="route-sentence">
          {clarification === null ? '어떻게 걷고 싶은지' : '되묻기에 답하기'}
        </label>
        <textarea
          id="route-sentence"
          name="sentence"
          className={textarea}
          value={draft}
          onChange={event =>
            setDraft(event.target.value.slice(0, MAX_SENTENCE_LENGTH))
          }
          placeholder={clarification?.question ?? EXAMPLE}
          maxLength={MAX_SENTENCE_LENGTH}
          disabled={pending}
        />
        <div className={row}>
          <span className={counter} aria-live="polite">
            {String(draft.length)} / {String(MAX_SENTENCE_LENGTH)}
          </span>
          <button
            type="submit"
            className={button}
            disabled={!draft.trim() || pending}
          >
            {pending
              ? '동선을 짜고 있어요…'
              : clarification === null
                ? '동선 만들기'
                : '이어서 답하기'}
          </button>
        </div>
      </form>
      {state.status === 'invalid' && (
        <p className={notice} role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'load_failed' && (
        <p className={notice} role="alert">
          저장한 스팟을 불러오지 못했어요. 입력한 내용으로 다시 시도해 주세요.
        </p>
      )}
      {state.status === 'done' &&
        state.outcome.kind === 'failed' &&
        clarification === null && (
          <PlanFailureNotice failure={state.outcome.failure} />
        )}
      {result !== null && (
        <div className={shell} aria-busy={pending}>
          {pending && (
            <p role="status" className={notice}>
              변경한 조건으로 다시 계산하고 있어요. 완료되면 지도와 시간이 함께
              바뀝니다.
            </p>
          )}
          <InterpretationCard
            key={JSON.stringify(result.request)}
            request={result.request}
            spots={spots}
            pending={pending}
            {...(replanAction === undefined ? {} : { onSubmit: replan })}
          />
          <RouteMap itinerary={result.itinerary} />
          <ItineraryList
            itinerary={result.itinerary}
            areaName={result.request.area.name}
            unmatchedRequiredNames={result.unmatchedRequiredNames}
            pending={pending}
            {...(editAction === undefined ? {} : { onEdit: edit })}
          />
        </div>
      )}
    </div>
  );
}
