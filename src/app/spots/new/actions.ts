'use server';

import { redirect } from 'next/navigation';
import { locateAddress, saveSpot, searchAddress, searchPlaces } from '@/domain/spot';
import { HOME_PATH } from '@/shared/routes';
import type { SpotCategory } from '@/shared/spot';
import { isSpotCategory } from '@/shared/spot';
import type { FoundPlace } from '@/domain/spot';
import type { PinDraft, PinFormState } from './pinState';

/**
 * 핀 찍기 서버 액션 — T51(#108) · T23(#32)의 진입점. 이름 검색은 T52(#124).
 *
 * 검색 · Geocoding · Supabase 키가 전부 서버 전용이라 여기서 돈다. 폼을 읽어
 * 도메인(`searchPlaces` · `locateAddress` · `saveSpot`)에 넘기고 결과를 화면
 * 상태로 접는 것만 한다 — 좌표를 폼에서 받지 않는다. 저장은 서버가 다시
 * Geocoding을 돌려 얻은 좌표로만 한다(T22).
 */
export async function pinSpotAction(previous: PinFormState, formData: FormData): Promise<PinFormState> {
  // 후보를 고르는 버튼은 값을 함께 실어야 해서 intent와 갈라 두었다.
  // 주소 후보는 `pick=<주소>`, 업체 후보는 `pickPlace=<직전 목록의 번호>`다.
  // 업체는 이름과 주소 둘을 옮겨야 해서 값 하나에 담기지 않는다 — 직전 상태가
  // 그 목록을 들고 있으므로 번호로 집는다.
  const pick = readText(formData, 'pick');
  const picked = readPickedPlace(previous, formData);
  const rawIntent = readText(formData, 'intent');
  const intent: 'search_place' | 'search' | 'locate' | 'save' =
    picked !== null || pick.length > 0
      ? 'locate'
      : rawIntent === 'save'
        ? 'save'
        : rawIntent === 'locate'
          ? 'locate'
          : rawIntent === 'search_place'
            ? 'search_place'
            : 'search';
  const typed = readDraft(formData);
  const draft: PinDraft =
    picked !== null
      ? { ...typed, name: picked.name, address: picked.address }
      : pick.length > 0
        ? { ...typed, address: pick }
        : typed;

  if (draft.name.length === 0) {
    return { status: 'invalid', field: 'name', message: '장소 이름을 적어 주세요.', draft };
  }
  if (draft.address.length === 0) {
    return { status: 'invalid', field: 'address', message: '주소를 적어 주세요. 도로명 주소면 가장 정확합니다.', draft };
  }

  if (intent === 'search_place') {
    const found = await searchPlaces(draft.name);
    if (found.kind === 'results') return { status: 'place_searched', draft, places: found.places };
    return {
      status: 'failed',
      draft,
      failure: found.kind === 'not_found' ? { kind: 'place_not_found' } : { kind: 'place_search_unavailable' },
    };
  }

  if (intent === 'search') {
    const searched = await searchAddress(draft.address);
    if (searched.kind === 'results') {
      // 후보가 하나면 고를 것이 없다 — 바로 미리보기로.
      const only = searched.candidates.length === 1 ? searched.candidates[0] : undefined;
      if (only !== undefined) return { status: 'located', draft: { ...draft, address: addressOf(only) }, location: only };
      return { status: 'searched', draft, candidates: searched.candidates };
    }
    return {
      status: 'failed',
      draft,
      failure: searched.kind === 'not_found' ? { kind: 'address_not_found' } : { kind: 'geocoding_unavailable' },
    };
  }

  if (intent === 'locate') {
    const located = await locateAddress(draft.address);
    if (located.kind === 'ready') return { status: 'located', draft, location: located.location };
    return {
      status: 'failed',
      draft,
      failure: located.kind === 'not_found' ? { kind: 'address_not_found' } : { kind: 'geocoding_unavailable' },
    };
  }

  const outcome = await saveSpot({ name: draft.name, address: draft.address, category: draft.category, origin: 'manual' });
  if (outcome.kind === 'failed') return { status: 'failed', draft, failure: outcome.failure };

  // 저장 결과는 홈 지도가 그린다(T26~T28). 성공 상태를 이 화면에 두면 같은
  // 지도를 두 번 만들게 된다.
  redirect(`${HOME_PATH}?result=${encodeURIComponent(outcome.spot.id)}`);
}

/**
 * 고른 업체. 번호가 직전 목록의 범위 밖이면 `null`이다 — 폼 값은 사용자가
 * 고칠 수 있으므로 범위를 믿지 않는다.
 */
function readPickedPlace(previous: PinFormState, formData: FormData): FoundPlace | null {
  const raw = readText(formData, 'pickPlace');
  if (raw.length === 0 || previous.status !== 'place_searched') return null;
  const index = Number.parseInt(raw, 10);
  if (!Number.isInteger(index)) return null;
  return previous.places[index] ?? null;
}

/** 저장 · 재확인에 쓸 주소 문자열. 도로명이 있으면 도로명, 없으면 지번. */
function addressOf(location: { readonly roadAddress: string; readonly jibunAddress: string }): string {
  return location.roadAddress.length > 0 ? location.roadAddress : location.jibunAddress;
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function readDraft(formData: FormData): PinDraft {
  const rawCategory = readText(formData, 'category');
  const category: SpotCategory = isSpotCategory(rawCategory) ? rawCategory : 'other';
  return { name: readText(formData, 'name'), address: readText(formData, 'address'), category };
}
