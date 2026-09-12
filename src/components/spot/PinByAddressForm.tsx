'use client';

import { useActionState } from 'react';
import { css } from 'styled-system/css';
import type { PinFormState } from '@/app/spots/new/pinState';
import { IDLE_PIN_STATE } from '@/app/spots/new/pinState';
import type { SaveSpotFailure } from '@/domain/spot';
import { SPOT_CATEGORIES } from '@/shared/spot';
import { labelOf } from '@/shared/spotCategory';
import { SpotMap } from '../SpotMap';

/**
 * 이름 · 주소 · 카테고리를 받아 좌표를 확인하고 저장하는 폼 — T51(#108).
 *
 * 한 폼에 버튼이 둘이다. "위치 찾기"는 `intent=locate`, "이 위치로 저장"은
 * `intent=save`. 저장 버튼은 좌표가 확인된 뒤에만 나타난다 — 미리보기를 건너뛰고
 * 저장할 수 있으면 사용자는 엉뚱한 곳에 핀이 찍힌 것을 홈에서야 안다.
 *
 * 좌표는 폼에 담지 않는다. 저장은 서버가 다시 Geocoding을 돌린 결과로만 한다.
 *
 * `action`을 prop으로 받는 이유는 테스트다. 서버 액션은 jsdom에서 돌지 않는다.
 */

export type PinSpotAction = (state: PinFormState, formData: FormData) => Promise<PinFormState>;

interface Props {
  readonly action: PinSpotAction;
}

const form = css({ display: 'flex', flexDirection: 'column', gap: '5', width: 'full' });

const field = css({ display: 'flex', flexDirection: 'column', gap: '2' });

const label = css({ textStyle: 'sm', fontWeight: 'medium', color: 'slate.700', _dark: { color: 'slate.300' } });

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
  _dark: { borderColor: 'slate.700', bg: 'slate.900', color: 'slate.100', _placeholder: { color: 'slate.500' } },
});

const hint = css({ textStyle: 'sm', color: 'slate.500', _dark: { color: 'slate.400' } });

const row = css({ display: 'flex', flexWrap: 'wrap', gap: '3' });

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
  _dark: { borderColor: 'violet.500', bg: 'violet.500', _hover: { bg: 'violet.400', borderColor: 'violet.400' } },
});

const secondary = css({
  display: 'inline-flex',
  alignItems: 'center',
  px: '5',
  py: '3',
  rounded: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.300',
  bg: 'white',
  color: 'slate.800',
  cursor: 'pointer',
  textStyle: 'md',
  fontWeight: 'medium',
  _disabled: { opacity: '0.5', cursor: 'not-allowed' },
  _dark: { borderColor: 'slate.700', bg: 'slate.900', color: 'slate.100' },
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

const previewText = css({ px: '4', pb: '4', display: 'flex', flexDirection: 'column', gap: '1' });

const alert = css({
  px: '4',
  py: '3',
  rounded: 'lg',
  bg: 'slate.100',
  color: 'slate.800',
  textStyle: 'sm',
  _dark: { bg: 'slate.900', color: 'slate.200' },
});

function failureMessage(failure: SaveSpotFailure): string {
  switch (failure.kind) {
    case 'invalid_input':
      return failure.field === 'name' ? '장소 이름을 적어 주세요.' : '주소를 적어 주세요.';
    case 'address_not_found':
      return '이 주소로는 위치를 찾지 못했어요. 도로명 주소나 번지까지 적어 다시 시도해 주세요.';
    case 'geocoding_unavailable':
      return '지금은 주소를 좌표로 바꿀 수 없어요. 잠시 후 다시 시도해 주세요.';
    case 'store_unconfigured':
      return '저장소가 연결되지 않아 저장할 수 없어요. 환경 변수(SUPABASE_URL · SUPABASE_SECRET_KEY)를 확인해 주세요.';
    case 'store_error':
      return `저장하지 못했어요: ${failure.message}`;
  }
}

export function PinByAddressForm({ action }: Props) {
  const [state, submit, pending] = useActionState(action, IDLE_PIN_STATE);

  const draft = state.status === 'idle' ? null : state.draft;
  const located = state.status === 'located' ? state : null;

  return (
    <form className={form} action={submit}>
      <div className={field}>
        <label className={label} htmlFor="spot-name">
          장소 이름
        </label>
        <input
          id="spot-name"
          name="name"
          className={control}
          defaultValue={draft?.name ?? ''}
          placeholder="피롤츠 커피하우스"
          maxLength={200}
          required
          disabled={pending}
        />
      </div>

      <div className={field}>
        <label className={label} htmlFor="spot-address">
          주소
        </label>
        <input
          id="spot-address"
          name="address"
          className={control}
          defaultValue={draft?.address ?? ''}
          placeholder="서울 용산구 한강대로 56-1"
          required
          disabled={pending}
        />
        <p className={hint}>동 이름만으로는 위치를 특정할 수 없어요. 번지나 건물명까지 적어 주세요.</p>
      </div>

      <div className={field}>
        <label className={label} htmlFor="spot-category">
          카테고리
        </label>
        <select id="spot-category" name="category" className={control} defaultValue={draft?.category ?? 'other'} disabled={pending}>
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

      {located !== null && (
        <section className={preview} aria-label="찾은 위치 미리보기">
          <div className={mapFrame}>
            <SpotMap
              latitude={located.location.coordinates.latitude}
              longitude={located.location.coordinates.longitude}
              placeName={located.draft.name}
            />
          </div>
          <div className={previewText}>
            <p className={label}>{located.draft.name}</p>
            <p className={hint}>
              {located.location.roadAddress.length > 0 ? located.location.roadAddress : located.location.jibunAddress}
            </p>
          </div>
        </section>
      )}

      <div className={row}>
        <button type="submit" name="intent" value="locate" className={located === null ? primary : secondary} disabled={pending}>
          {pending ? '처리 중…' : located === null ? '위치 찾기' : '다시 찾기'}
        </button>
        {located !== null && (
          <button type="submit" name="intent" value="save" className={primary} disabled={pending}>
            이 위치로 저장
          </button>
        )}
      </div>
    </form>
  );
}
