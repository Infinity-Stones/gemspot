'use client';

import { useActionState, useRef, useState } from 'react';
import { css } from 'styled-system/css';
import type { PinDraft, PinFormState } from '@/app/spots/new/pinState';
import { IDLE_PIN_STATE } from '@/app/spots/new/pinState';
import type { PinFailure } from '@/app/spots/new/pinState';
import { SPOT_CATEGORIES } from '@/shared/spot';
import { labelOf } from '@/shared/spotCategory';
import { FloatingActionBar } from '../FloatingActionBar';
import { SpotMap } from '../SpotMap';
import { saveFailureMessage } from './saveFailureMessage';

/**
 * 이름 · 주소 · 카테고리를 받아 좌표를 확인하고 저장하는 폼 — T51(#108) · T52(#124).
 *
 * 찾는 길이 둘이다. **이름으로**(`intent=search_place`)는 카카오 Local API로
 * 업체를 찾아 이름과 주소를 함께 채우고, **주소로**(`intent=search`)는 Maps
 * Geocoding으로 주소 후보를 받는다. 둘 다 후보를 골라(`pickPlace=<번호>` ·
 * `pick=<주소>`) 좌표 확인(`located`)으로 모이고, 거기서만 "이 위치로 저장"
 * (`intent=save`)이 열린다 — 미리보기를 건너뛰고 저장할 수 있으면 사용자는
 * 엉뚱한 곳에 핀이 찍힌 것을 홈에서야 안다. 주소 후보가 하나면 바로 미리보기다.
 *
 * 이름 검색을 먼저 두는 이유: 사용자가 아는 것은 대개 주소가 아니라 가게
 * 이름이다. 다만 Local API에 등록되지 않은 가게는 0건이라 주소 길을 함께 남긴다.
 *
 * 좌표는 폼에 담지 않는다. 저장은 서버가 다시 Geocoding을 돌린 결과로만 한다.
 *
 * `action`을 prop으로 받는 이유는 테스트다. 서버 액션은 jsdom에서 돌지 않는다.
 */

export type PinSpotAction = (
  state: PinFormState,
  formData: FormData,
) => Promise<PinFormState>;

interface Props {
  readonly action: PinSpotAction;
}

const form = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
  width: 'full',
});

const field = css({ display: 'flex', flexDirection: 'column', gap: '2' });

const label = css({
  textStyle: 'sm',
  fontWeight: 'medium',
  color: 'slate.700',
  _dark: { color: 'slate.300' },
});

const control = css({
  width: 'full',
  px: '4',
  py: '3',
  rounded: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.300',
  bg: 'white',
  color: 'slate.900',
  textStyle: 'md',
  _placeholder: { color: 'slate.400' },
  _dark: {
    borderColor: 'slate.700',
    bg: 'slate.900',
    color: 'slate.100',
    _placeholder: { color: 'slate.500' },
  },
});

const hint = css({
  textStyle: 'sm',
  color: 'slate.500',
  _dark: { color: 'slate.400' },
});

// 플로팅 자리의 버튼은 줄을 꽉 채운다 — 화면 아래에서 좌우로 흔들리지 않는다.
const blockAction = css({
  justifyContent: 'center',
  width: 'full',
  minHeight: '12',
});

const primary = css({
  display: 'inline-flex',
  alignItems: 'center',
  px: '5',
  py: '3',
  rounded: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'violet.600',
  bg: 'violet.600',
  color: 'white',
  cursor: 'pointer',
  textStyle: 'md',
  fontWeight: 'semibold',
  _hover: { bg: 'violet.700', borderColor: 'violet.700' },
  _disabled: { opacity: '0.5', cursor: 'not-allowed' },
  _dark: {
    borderColor: 'violet.500',
    bg: 'violet.500',
    _hover: { bg: 'violet.400', borderColor: 'violet.400' },
  },
});

/**
 * 화면 안에서 후보를 불러오는 동작 — 검색. 저장과 같은 무게로 두면 무엇을
 * 먼저 눌러야 하는지가 사라지므로 면을 채우지 않는다.
 */
const secondary = css({
  display: 'inline-flex',
  alignItems: 'center',
  px: '5',
  py: '3',
  rounded: 'lg',
  borderWidth: '[1.5px]',
  borderStyle: 'solid',
  borderColor: 'violet.600',
  bg: 'transparent',
  color: 'violet.700',
  cursor: 'pointer',
  textStyle: 'md',
  fontWeight: 'medium',
  _hover: { bg: 'violet.50' },
  _disabled: { opacity: '0.5', cursor: 'not-allowed' },
  _dark: {
    borderColor: 'violet.400',
    color: 'violet.300',
    _hover: { bg: 'violet.950' },
  },
});

const preview = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  rounded: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  overflow: 'hidden',
  _dark: { borderColor: 'slate.800' },
});

const mapFrame = css({ height: '64', width: 'full' });

const previewText = css({
  px: '4',
  pb: '4',
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
});

// 이름 칸과 찾기 버튼은 한 줄에 둔다. 버튼이 아래로 내려가면 이름과 떨어져
// 무엇을 찾는 버튼인지 한눈에 붙지 않는다.
const inline = css({ display: 'flex', alignItems: 'center', gap: '2' });

// control이 width:full이라 그대로 두면 버튼을 줄 밖으로 밀어낸다. 남는 만큼만
// 차지하게 되돌린다.
const inlineField = css({
  flexGrow: '1',
  flexBasis: '0',
  width: '[auto]',
  minWidth: '0',
});

const inlineAction = css({
  flexShrink: '0',
  justifyContent: 'center',
  // 입력 칸과 높이를 맞추고, 글자가 접히지 않을 만큼은 넓힌다.
  minWidth: '24',
  minHeight: '12',
  whiteSpace: 'nowrap',
});

const candidateList = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  listStyle: 'none',
  p: '0',
  m: '0',
});

const candidateButton = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '1',
  width: 'full',
  px: '4',
  py: '3',
  rounded: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  bg: 'white',
  color: 'slate.900',
  textAlign: 'left',
  cursor: 'pointer',
  _hover: { borderColor: 'violet.500', bg: 'violet.50' },
  _dark: {
    borderColor: 'slate.800',
    bg: 'slate.900',
    color: 'slate.100',
    _hover: { bg: 'violet.950', borderColor: 'violet.400' },
  },
});

const alert = css({
  px: '4',
  py: '3',
  rounded: 'lg',
  bg: 'slate.100',
  color: 'slate.800',
  textStyle: 'sm',
  _dark: { bg: 'slate.900', color: 'slate.200' },
});

/**
 * 이 화면에만 있는 실패는 여기서 말하고, 저장 경로가 내는 실패는
 * `saveFailureMessage`에 맡긴다 — 같은 실패를 추출 결과 화면도 설명해야 한다.
 */
function failureMessage(failure: PinFailure): string {
  switch (failure.kind) {
    case 'place_not_found':
      return '그 이름으로 등록된 가게를 찾지 못했어요. 아래에 주소를 직접 넣어 찾아 주세요.';
    case 'place_search_unavailable':
      return '지금은 이름으로 찾을 수 없어요. 주소로 찾거나 잠시 후 다시 시도해 주세요.';
    case 'place_search_unconfigured':
      return '가게 검색이 아직 연결되지 않았어요. 주소를 직접 입력해 위치를 찾아 주세요.';
    default:
      return saveFailureMessage(failure);
  }
}

/**
 * 검색 뒤에도 편집을 이어간다. 액션의 자동 리셋은 제어 select까지 첫 옵션으로
 * 돌릴 수 있다. React 커밋 중에는 합성 onReset이 호출되지 않으므로 DOM 이벤트를
 * 취소하고, 입력값은 서버 응답과 사용자의 편집으로만 갱신한다.
 */
function preserveDraftOnReset(form: HTMLFormElement) {
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener('reset', preventReset);
  return () => form.removeEventListener('reset', preventReset);
}

export function PinSpotForm({ action }: Props) {
  const [draft, setDraft] = useState<PinDraft>({
    name: '',
    address: '',
    category: 'other',
  });
  const addressSearchRef = useRef<HTMLButtonElement>(null);
  const [state, submit, pending] = useActionState(
    async (previous: PinFormState, formData: FormData) => {
      const next = await action(previous, formData);
      // 선택 결과와 편집 중인 값을 제어 입력으로 맞춘다.
      if (next.status !== 'idle') setDraft(next.draft);
      return next;
    },
    IDLE_PIN_STATE,
  );

  // 각 검색은 자기 입력 칸만 채워지면 활성화한다. 선택으로 채운 주소도 포함한다.
  const hasName = draft.name.trim().length > 0;
  const hasAddress = draft.address.trim().length > 0;
  const addressMatches =
    state.status !== 'idle' && state.draft.address === draft.address.trim();
  const located = state.status === 'located' && addressMatches ? state : null;
  const searched = state.status === 'searched' && addressMatches ? state : null;
  const placeSearched =
    state.status === 'place_searched' && state.draft.name === draft.name.trim()
      ? state
      : null;

  return (
    <form
      className={form}
      action={submit}
      aria-busy={pending}
      ref={preserveDraftOnReset}
    >
      <div className={field}>
        <label className={label} htmlFor="spot-name">
          가게 이름
        </label>
        <div className={inline}>
          <input
            id="spot-name"
            name="name"
            className={`${control} ${inlineField}`}
            value={draft.name}
            onChange={event => setDraft({ ...draft, name: event.target.value })}
            placeholder="피롤츠 커피하우스"
            maxLength={200}
            disabled={pending}
          />
          <button
            type="submit"
            name="intent"
            value="search_place"
            className={`${secondary} ${inlineAction}`}
            disabled={pending || !hasName}
          >
            검색
          </button>
        </div>
        <p className={hint}>
          상호명과 지역을 함께 검색하면 찾기 쉬워요. 예: 성수 블루보틀. 목록에서
          고르면 주소가 채워집니다.
        </p>
      </div>

      {placeSearched !== null && (
        <section className={field} aria-label="가게 검색 결과">
          <p className={label}>
            {String(placeSearched.places.length)}곳이 나왔어요. 맞는 가게를 골라
            주세요.
          </p>
          <ul className={candidateList}>
            {placeSearched.places.map((place, index) => (
              <li key={`${place.name}-${place.address}`}>
                <button
                  type="submit"
                  name="pickPlace"
                  value={String(index)}
                  className={candidateButton}
                  disabled={pending}
                >
                  <span>{place.name}</span>
                  <span className={hint}>
                    {place.category.length > 0 ? `${place.category} · ` : ''}
                    {place.address}
                  </span>
                  {place.secondaryAddress !== null && (
                    <span className={hint}>지번: {place.secondaryAddress}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className={hint}>
            카카오 검색 결과를 최대 15곳까지 보여 줍니다. 찾는 가게가 없으면
            지역이나 지점명을 더해 검색해 주세요.
          </p>
        </section>
      )}

      <div className={field}>
        <label className={label} htmlFor="spot-address">
          주소
        </label>
        <input
          id="spot-address"
          name="address"
          className={control}
          value={draft.address}
          onChange={event =>
            setDraft({ ...draft, address: event.target.value })
          }
          onKeyDown={event => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (!pending && addressSearchRef.current !== null) {
              event.currentTarget.form?.requestSubmit(addressSearchRef.current);
            }
          }}
          placeholder="서울 용산구 한강대로 56-1"
          disabled={pending}
        />
        <p className={hint}>
          주소로 찾습니다 — 가게 이름은 위 칸에서 찾아 주세요. 동 이름만으로는
          위치를 특정할 수 없으니 도로명이나 번지까지 적어 주세요. 여러 곳이
          나오면 골라 주세요.
        </p>
      </div>

      <div className={field}>
        <label className={label} htmlFor="spot-category">
          카테고리
        </label>
        <select
          id="spot-category"
          name="category"
          className={control}
          value={draft.category}
          onChange={event => {
            const category = SPOT_CATEGORIES.find(
              code => code === event.target.value,
            );
            if (category !== undefined) setDraft({ ...draft, category });
          }}
          disabled={pending}
        >
          {SPOT_CATEGORIES.map(code => (
            <option key={code} value={code}>
              {labelOf(code)}
            </option>
          ))}
        </select>
      </div>

      {state.status === 'invalid' && (
        <p className={alert} role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'failed' && (
        <p className={alert} role="alert">
          {failureMessage(state.failure)}
        </p>
      )}

      {searched !== null && (
        <section className={field} aria-label="주소 검색 결과">
          <p className={label}>
            {String(searched.candidates.length)}곳이 나왔어요. 맞는 곳을 골라
            주세요.
          </p>
          <ul className={candidateList}>
            {searched.candidates.map(candidate => {
              const primary =
                candidate.roadAddress.length > 0
                  ? candidate.roadAddress
                  : candidate.jibunAddress;
              const secondary =
                candidate.roadAddress.length > 0 &&
                candidate.jibunAddress.length > 0
                  ? candidate.jibunAddress
                  : null;
              return (
                <li key={primary}>
                  <button
                    type="submit"
                    name="pick"
                    value={primary}
                    className={candidateButton}
                    disabled={pending}
                  >
                    <span>{primary}</span>
                    {secondary !== null && (
                      <span className={hint}>{secondary}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {located !== null && (
        <section className={preview} aria-label="찾은 위치 미리보기">
          <div className={mapFrame}>
            <SpotMap
              latitude={located.location.coordinates.latitude}
              longitude={located.location.coordinates.longitude}
              placeName={draft.name}
            />
          </div>
          <div className={previewText}>
            {/* 주소부터 찾은 사람은 아직 이름이 없다. 저장이 막히는 이유를
                여기서 미리 말한다 — 눌러 보고 알게 하지 않는다. */}
            <p className={label}>
              {draft.name.trim().length > 0
                ? draft.name
                : '저장하려면 위에 가게 이름을 적어 주세요'}
            </p>
            <p className={hint}>
              {located.location.roadAddress.length > 0
                ? located.location.roadAddress
                : located.location.jibunAddress}
            </p>
          </div>
        </section>
      )}

      <FloatingActionBar>
        {located !== null && (
          <button
            type="submit"
            name="intent"
            value="save"
            className={`${primary} ${blockAction}`}
            disabled={pending}
          >
            이 위치로 저장
          </button>
        )}
        <button
          ref={addressSearchRef}
          type="submit"
          name="intent"
          value="search"
          // 주소 검색은 이 화면을 앞으로 미는 동작이라 면을 채운다. 미리보기가
          // 열린 뒤의 "다시 검색"은 되돌리는 쪽이라 한 단 물러난다.
          className={`${located === null ? primary : secondary} ${blockAction}`}
          disabled={pending || !hasAddress}
        >
          {pending ? '처리 중…' : located === null ? '주소 검색' : '다시 검색'}
        </button>
      </FloatingActionBar>
    </form>
  );
}
