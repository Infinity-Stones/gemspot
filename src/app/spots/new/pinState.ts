import type { GeocodedSpotLocation, SaveSpotFailure } from '@/domain/spot';
import type { SpotCategory } from '@/shared/spot';

/**
 * 핀 찍기 화면이 서버 액션과 주고받는 상태 — T51(#108).
 *
 * 한 폼, 세 의도(`intent`): `search`는 주소 후보를 찾고, `locate`는 고른 후보의
 * 좌표를 확인해 미리보기를 만들고, `save`는 저장한다. 저장이 성공하면 상태를 돌려주지 않고 홈 `?result=<id>`로
 * 리다이렉트하므로 성공 상태는 여기 없다.
 */
export interface PinDraft {
  readonly name: string;
  readonly address: string;
  readonly category: SpotCategory;
}

export type PinFormState =
  | { readonly status: 'idle' }
  | { readonly status: 'invalid'; readonly field: 'name' | 'address'; readonly message: string; readonly draft: PinDraft }
  /** 검색 결과가 여럿이다. 사용자가 하나를 고르면 located로 간다. */
  | { readonly status: 'searched'; readonly draft: PinDraft; readonly candidates: readonly GeocodedSpotLocation[] }
  /** 좌표가 확인됐다. 지도에 핀을 미리 보이고 저장 버튼을 연다. */
  | { readonly status: 'located'; readonly draft: PinDraft; readonly location: GeocodedSpotLocation }
  | { readonly status: 'failed'; readonly failure: SaveSpotFailure; readonly draft: PinDraft };

export const IDLE_PIN_STATE: PinFormState = { status: 'idle' };
