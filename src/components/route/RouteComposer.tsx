'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { css } from 'styled-system/css';
import type { RoutePlanState } from '@/app/(main)/route/planState';
import { IDLE_STATE, MAX_SENTENCE_LENGTH } from '@/app/(main)/route/planState';
import type { PlanFailure } from '@/domain/route';
import { ItineraryList } from './ItineraryList';
import { ItineraryMap } from './ItineraryMap';
import { PlanFailureNotice } from './PlanFailureNotice';
import { UPLOAD_PATH } from '@/shared/routes';

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
  p: { base: '6', md: '8' },
  boxShadow: 'preview',
});

const textarea = css({
  width: 'full',
  minHeight: '48',
  px: '5',
  py: '5',
  rounded: 'input',
  borderWidth: '1px',
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

const button = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  px: '5',
  py: '3',
  rounded: 'control',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'ui.action',
  bg: 'ui.action',
  color: 'ui.onAction',
  cursor: 'pointer',
  textStyle: 'button',
  fontWeight: 'semibold',
  transition: 'colors',
  _hover: { bg: 'ui.actionHover', borderColor: 'ui.action' },
  _disabled: { opacity: '0.5', cursor: 'not-allowed' },
});

const notice = css({
  px: '6',
  py: '8',
  rounded: 'panel',
  bg: 'ui.blueWash',
  color: 'ui.ink',
  textStyle: 'bodySm',
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
  rounded: 'nav',
  bg: 'ui.blueWash',
  color: 'ui.ink',
  textStyle: 'bodySm',
});

const link = css({ color: 'ui.accentText', textDecoration: 'underline' });

/** 되묻기 상태인가 — 이때만 이전 문장을 이어 붙인다. */
function clarificationOf(
  state: RoutePlanState,
): Extract<PlanFailure, { kind: 'needs_clarification' }> | null {
  if (state.status !== 'done' || state.outcome.kind !== 'failed') return null;
  const { failure } = state.outcome;
  return failure.kind === 'needs_clarification' ? failure : null;
}

export function RouteComposer({ action, spotCount, loadFailed }: Props) {
  const [state, submit, pending] = useActionState(action, IDLE_STATE);
  const [draft, setDraft] = useState('');

  const clarification = clarificationOf(state);
  // 되묻기 중이면 지금까지의 문장이 history다. 결과가 나왔거나 실패했으면
  // 다음 문장은 새 요청이다 — 이전 문장을 끌고 가면 "아까 그 시간"이 섞인다.
  const history =
    clarification !== null && state.status === 'done' ? state.sentence : '';

  if (loadFailed) {
    return (
      <div className={shell}>
        <p className={notice} role="alert">
          저장한 스팟을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  if (spotCount === 0) {
    return (
      <div className={shell}>
        <p className={notice} role="status">
          저장된 스팟이 없어요. 먼저{' '}
          <Link className={link} href={UPLOAD_PATH}>
            스크린샷을 올려
          </Link>{' '}
          스팟을 저장해 주세요. 스팟이 없으면 동선을 만들 수 없습니다.
        </p>
      </div>
    );
  }

  const canSubmit = draft.trim().length > 0 && !pending;

  return (
    <div className={shell}>
      {clarification !== null && state.status === 'done' && (
        <ol className={transcript} aria-label="지금까지의 대화">
          {state.sentence.split('\n').map((line, index) => (
            <li key={`${String(index)}-${line}`} className={said}>
              {line}
            </li>
          ))}
          <li className={asked} role="status">
            {clarification.question}
          </li>
        </ol>
      )}

      <form
        className={form}
        action={formData => {
          submit(formData);
          setDraft('');
        }}
      >
        <label className={css({ srOnly: true })} htmlFor="route-sentence">
          {clarification === null ? '어떻게 걷고 싶은지' : '되묻기에 답하기'}
        </label>
        <textarea
          id="route-sentence"
          name="sentence"
          className={textarea}
          value={draft}
          onChange={event => {
            setDraft(event.target.value.slice(0, MAX_SENTENCE_LENGTH));
          }}
          placeholder={
            clarification === null ? EXAMPLE : clarification.question
          }
          maxLength={MAX_SENTENCE_LENGTH}
          disabled={pending}
        />
        <input type="hidden" name="history" value={history} />
        <div className={row}>
          <span className={counter} aria-live="polite">
            {String(draft.length)} / {String(MAX_SENTENCE_LENGTH)}
          </span>
          <button type="submit" className={button} disabled={!canSubmit}>
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
          저장한 스팟을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {state.status === 'done' && state.outcome.kind === 'ok' && (
        <ItineraryMap itinerary={state.outcome.itinerary} />
      )}

      {state.status === 'done' && state.outcome.kind === 'ok' && (
        <ItineraryList
          itinerary={state.outcome.itinerary}
          areaName={state.outcome.request.area.name}
          unmatchedRequiredNames={state.outcome.unmatchedRequiredNames}
        />
      )}

      {state.status === 'done' &&
        state.outcome.kind === 'failed' &&
        clarification === null && (
          <PlanFailureNotice failure={state.outcome.failure} />
        )}
    </div>
  );
}
