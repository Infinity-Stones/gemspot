import type {
  FoundPlace,
  GeocodedSpotLocation,
  SaveSpotFailure,
} from '@/domain/spot';
import type { SpotCategory } from '@/shared/spot';

/**
 * 핀 찍기 화면이 서버 액션과 주고받는 상태 — T51(#108) · T52(#124).
 *
 * 한 폼, 네 의도(`intent`): `search_place`는 가게 이름으로 업체를 찾고,
 * `search`는 주소 후보를 찾고, `locate`는 고른 후보의 좌표를 확인해 미리보기를
 * 만들고, `save`는 저장한다. 저장이 성공하면 상태를 돌려주지 않고 홈
 * `?result=<id>`로 리다이렉트하므로 성공 상태는 여기 없다.
 */
export interface PinDraft {
  readonly name: string;
  readonly address: string;
  readonly category: SpotCategory;
}

/**
 * 저장 실패(도메인)에 이름 검색 실패 둘을 더한 것. 이름 검색은 저장 경로가
 * 아니라 입력을 돕는 단계라서 도메인의 `SaveSpotFailure`에 섞지 않는다.
 */
export type PinFailure =
  | SaveSpotFailure
  | { readonly kind: 'place_not_found' }
  | { readonly kind: 'place_search_unconfigured' }
  | { readonly kind: 'place_search_unavailable' };

export type PinFormState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'invalid';
      readonly field: 'name' | 'address';
      readonly message: string;
      readonly draft: PinDraft;
    }
  /** 가게 이름으로 찾은 업체들. 하나를 고르면 이름 · 주소가 채워지고 located로 간다. */
  | {
      readonly status: 'place_searched';
      readonly draft: PinDraft;
      readonly places: readonly FoundPlace[];
    }
  /** 주소 검색 결과가 여럿이다. 사용자가 하나를 고르면 located로 간다. */
  | {
      readonly status: 'searched';
      readonly draft: PinDraft;
      readonly candidates: readonly GeocodedSpotLocation[];
    }
  /** 좌표가 확인됐다. 지도에 핀을 미리 보이고 저장 버튼을 연다. */
  | {
      readonly status: 'located';
      readonly draft: PinDraft;
      readonly location: GeocodedSpotLocation;
    }
  | {
      readonly status: 'failed';
      readonly failure: PinFailure;
      readonly draft: PinDraft;
    };

export const IDLE_PIN_STATE: PinFormState = { status: 'idle' };
