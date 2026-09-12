/**
 * 스팟 계약 — 모든 레이어가 보는 같은 모양.
 *
 * shared(최하단)에 두는 이유는 이 어휘를 쓰는 자리가 레이어를 가로지르기
 * 때문이다. OCR 후보를 만드는 것은 extraction 도메인, 좌표를 붙여 저장하는
 * 것은 spot 도메인, 시간대로 거르는 것은 route 도메인, 목록으로 그리는 것은
 * 화면이다. 넷 중 어느 한 곳에 두면 나머지 셋이 그 레이어를 열어야 한다.
 *
 * 이 모듈은 아무것도 import하지 않는다 — 모든 청크에 함께 실려 가는 바닥이라
 * 여기 붙는 의존 하나가 앱 전체로 번진다. 그 방향은 eslint.config.mts의
 * boundaries가 강제한다.
 *
 * **바깥 응답의 모양이 아니다.** 네이버 Geocoding이 무엇을 어떤 타입으로
 * 주는지는 어댑터(platform·repository)만 알고, 여기 모양으로 옮기는 것이
 * 그쪽의 일이다.
 */

/**
 * 카테고리 — 동선 가이드(M7)가 시간대로 후보를 거르는 축이다.
 *
 * 값이 코드 식별자(영문)인 것은 화면 문구와 분리하기 위한 것이다. 라벨을
 * 여기 두면 "카페"라는 단어를 바꾸는 일이 계약 변경이 된다.
 *
 * 이 목록은 D11의 카테고리별 적합 시간대 표와 기본 체류 시간의 행 집합과
 * 같다 — **하나를 늘리면 저쪽에 행이 하나 없는 상태가 된다.** 그래서 값이
 * 늘거나 줄면 그 표를 함께 고쳐야 한다.
 */
export const SPOT_CATEGORIES = [
  // 카페 · 디저트.
  'cafe',
  // 밥집 — 끼니를 먹는 곳. 점심·저녁 시간대에만 후보다.
  'restaurant',
  // 술집 — 저녁 이후 시간대를 가른다.
  'bar',
  // 상점 — 편집숍 · 서점처럼 물건을 보는 곳.
  'shop',
  // 구경거리 — 전시 · 공원처럼 머물며 보는 곳.
  'sight',
  // 위 다섯에 들어가지 않는 곳. AI 분류가 못 맞힐 것을 계약이 표현할 수
  // 있어야 한다 — 없으면 분류기가 억지로 가까운 값을 고르고, 그 스팟은
  // 엉뚱한 시간대의 후보가 된다.
  'other',
] as const;

export type SpotCategory = (typeof SPOT_CATEGORIES)[number];

/**
 * 임의의 문자열이 카테고리인지 좁힌다.
 *
 * AI 분류와 저장소가 돌려주는 값은 둘 다 문자열이다. 좁히지 않고 캐스팅하면
 * 목록에 없는 값이 `SpotCategory`인 척 흘러가고, 그 스팟은 시간대 표에서
 * 아무 행에도 걸리지 않아 후보 선별에서 조용히 사라진다.
 */
export function isSpotCategory(value: string): value is SpotCategory {
  return (SPOT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * 주소가 어디서 왔는지.
 *
 * STEP 3의 실패 건은 사용자가 직접 입력하고(T17), 그 건도 성공 건과 같은
 * 검증을 지나 저장된다. 둘을 구분해 두는 이유는 검증을 다르게 하려는 게
 * 아니라, 나중에 "직접 입력이 얼마나 필요했나"를 물을 수 있게 하려는 것이다.
 */
export type SpotAddressOrigin = 'ocr' | 'manual';

/**
 * 좌표. **숫자다.**
 *
 * 네이버 Geocoding은 `x`(경도) · `y`(위도)를 **문자열로** 준다. 계약에서
 * 숫자로 좁히는 쪽을 골랐다 — 문자열로 들고 다니면 파싱이 소비자 수만큼
 * 흩어지고, 지도 SDK에 넘기는 자리마다 `Number()`가 붙는다. 그중 하나가
 * `NaN`을 만들면 핀이 조용히 사라지고 원인은 그 자리에서 멀다. 변환과
 * 유한성 검사는 어댑터 한 곳(T19)에서 한 번만 하고, 여기를 지난 값은
 * 유한한 숫자임이 보장된다.
 *
 * 이름을 `x` · `y`가 아니라 경도 · 위도로 두는 것도 같은 이유다 — 어느 쪽이
 * 위도인지 매번 다시 확인해야 하는 이름은 뒤집어 쓰기 쉽다.
 */
export interface SpotCoordinates {
  /** 경도. 네이버 Geocoding 응답의 `x`. */
  readonly longitude: number;
  /** 위도. 네이버 Geocoding 응답의 `y`. */
  readonly latitude: number;
}

/**
 * 지역 구분 — 나중 목록 필터(B01)의 축이다.
 *
 * 네이버 `addressElements`의 `SIDO` · `SIGUGUN`에서 온다. 둘 다 없을 수
 * 있어서 각각 nullable이다 — 한쪽만 온 응답을 객체 전체 null로 접으면
 * 남은 한쪽으로 걸를 수 있었던 스팟이 필터에서 빠진다.
 */
export interface SpotRegion {
  /** 예: '서울특별시'. */
  readonly sido: string | null;
  /** 예: '용산구'. */
  readonly sigugun: string | null;
}

/**
 * STEP 3의 확정 전 후보 — OCR이 읽어냈을 뿐 아직 스팟이 아니다.
 *
 * 좌표와 카테고리가 **없는 것이 이 타입의 정의다.** 좌표는 STEP 4의
 * Geocoding이 붙이고, 카테고리는 저장 시점에 붙는다. 그래서 후보를 저장된
 * 스팟이 필요한 자리에 넘기면 타입 검사가 막는다 — "좌표가 없으면 저장하지
 * 않는다"(T22)를 런타임 검사 전에 타입이 한 번 거른다.
 */
export interface SpotCandidate {
  /** 목록의 선택·삭제 상태를 잇는 키. 저장소의 id가 아니다. */
  readonly id: string;
  /** 상호명. OCR이 읽어낸 값이거나 사용자가 적은 값이다. */
  readonly name: string;
  /**
   * OCR이 읽어낸 도로명 주소. **`null`이 STEP 3의 실패 건이다** — 화면에
   * 도로명 주소가 찍혀 있는지가 성공과 실패를 가르는 유일한 기준이고,
   * 동 이름만으로는 핀을 찍을 수 없다.
   */
  readonly roadAddress: string | null;
  readonly origin: SpotAddressOrigin;
}

/**
 * 저장된 스팟 — 좌표 검증을 지난 것만 이 모양이 된다.
 *
 * 후보와 달리 좌표와 카테고리가 필수다. 지도가 핀을 찍을 수 있고(M5·M6)
 * 동선 가이드가 시간대로 거를 수 있는(M7) 최소 조건이 그 둘이다.
 */
export interface SavedSpot {
  /** 저장소가 부여한 id. */
  readonly id: string;
  readonly name: string;
  /**
   * 도로명 주소 · 지번 주소. Geocoding이 둘 다 주지만 어느 쪽이든 빈
   * 응답이 있어서 nullable이다. 저장의 필요조건은 주소가 아니라 좌표다.
   */
  readonly roadAddress: string | null;
  readonly jibunAddress: string | null;
  readonly coordinates: SpotCoordinates;
  readonly region: SpotRegion;
  readonly category: SpotCategory;
  readonly origin: SpotAddressOrigin;
}
