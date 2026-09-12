'use server';

import { redirect } from 'next/navigation';
import { locateAddress, saveSpot } from '@/domain/spot';
import { HOME_PATH } from '@/shared/routes';
import type { SpotCategory } from '@/shared/spot';
import { isSpotCategory } from '@/shared/spot';
import type { PinDraft, PinFormState } from './pinState';

/**
 * 핀 찍기 서버 액션 — T51(#108) · T23(#32)의 진입점.
 *
 * Geocoding 키와 Supabase 키가 서버 전용이라 여기서 돈다. 폼을 읽어 도메인
 * (`locateAddress` · `saveSpot`)에 넘기고 결과를 화면 상태로 접는 것만 한다 —
 * 좌표를 폼에서 받지 않는다. 저장은 서버가 다시 Geocoding을 돌려 얻은 좌표로만
 * 한다(T22).
 */
export async function pinSpotAction(_previous: PinFormState, formData: FormData): Promise<PinFormState> {
  const draft = readDraft(formData);
  const intent = readText(formData, 'intent') === 'save' ? 'save' : 'locate';

  if (draft.name.length === 0) {
    return { status: 'invalid', field: 'name', message: '장소 이름을 적어 주세요.', draft };
  }
  if (draft.address.length === 0) {
    return { status: 'invalid', field: 'address', message: '주소를 적어 주세요. 도로명 주소면 가장 정확합니다.', draft };
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

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function readDraft(formData: FormData): PinDraft {
  const rawCategory = readText(formData, 'category');
  const category: SpotCategory = isSpotCategory(rawCategory) ? rawCategory : 'other';
  return { name: readText(formData, 'name'), address: readText(formData, 'address'), category };
}
