import type { PinDraft } from './pinState';

/**
 * 핀 찍기 폼의 의도와, 그 의도가 요구하는 입력 — T51(#108) · T52(#124).
 *
 * 의도마다 필요한 칸이 다르다. **이름으로 찾을 때 주소를 요구하면 그 길이
 * 통째로 막힌다** — 이름만 아는 사람이 쓰라고 만든 길이기 때문이다. 반대로
 * 주소로 찾을 때 이름을 요구하면 "주소로 핀을 찍고 나중에 이름을 붙이는" 길이
 * 막힌다. 둘 다 필요한 것은 저장할 때뿐이다.
 *
 * 그 규칙을 순수 함수로 떼어 둔 이유는 서버 액션이 I/O 없이 시험되지 않기
 * 때문이다. 한때 이름 검색이 주소를 요구해 동작하지 않았고, 그 회귀를 잡는
 * 곳이 여기다.
 */
export type PinIntent = 'search_place' | 'search' | 'locate' | 'save';

export const NAME_REQUIRED_MESSAGE = '가게 이름을 적어 주세요.';
export const ADDRESS_REQUIRED_MESSAGE = '주소를 적어 주세요. 도로명 주소면 가장 정확합니다.';

/** 폼이 보낸 값에서 의도를 정한다. 후보를 고른 것은 언제나 좌표 확인이다. */
export function resolveIntent(input: {
  readonly rawIntent: string;
  readonly hasPickedAddress: boolean;
  readonly hasPickedPlace: boolean;
}): PinIntent {
  if (input.hasPickedPlace || input.hasPickedAddress) return 'locate';
  if (input.rawIntent === 'save') return 'save';
  if (input.rawIntent === 'locate') return 'locate';
  if (input.rawIntent === 'search_place') return 'search_place';
  return 'search';
}

/** 그 의도에 모자란 칸. 없으면 `null`. */
export function missingFieldFor(intent: PinIntent, draft: PinDraft): 'name' | 'address' | null {
  // 이름으로 찾는 데 필요한 것은 이름뿐이다. 주소는 이 검색이 채워 줄 값이다.
  if (intent === 'search_place') return draft.name.length === 0 ? 'name' : null;
  // 주소로 찾고 좌표를 확인하는 데 이름은 쓰이지 않는다. 이름은 저장 전에만
  // 있으면 되고, 그래야 주소부터 찾고 이름을 붙이는 순서가 가능하다.
  if (intent === 'search' || intent === 'locate') return draft.address.length === 0 ? 'address' : null;
  if (draft.name.length === 0) return 'name';
  return draft.address.length === 0 ? 'address' : null;
}

export function messageForMissing(field: 'name' | 'address'): string {
  return field === 'name' ? NAME_REQUIRED_MESSAGE : ADDRESS_REQUIRED_MESSAGE;
}
