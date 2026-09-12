import type { SaveSpotFailure } from '@/domain/spot';
import type { SpotCategory } from '@/shared/spot';

/**
 * STEP 3이 고른 후보를 스팟으로 저장한 결과 — T23(#32) · T24(#33).
 *
 * **건별로 가른다.** T23의 완료 기준이 "부분 실패가 응답에서 구분된다"인
 * 이유는 화면이 할 일이 건마다 다르기 때문이다 — 들어간 건은 지도로 가는
 * 길을 주고, 막힌 건은 무엇이 막혔는지 말해야 한다. 목록 전체를 성공과
 * 실패 하나로 접으면 그 둘이 같은 문장을 받는다.
 *
 * 후보 id를 결과에 들고 다니는 것은 화면이 그것으로 카드를 다시 찾기
 * 때문이다. 이름은 저장소가 정규화할 수 있어 짝을 맞추는 열쇠가 되지 못한다.
 */

export interface RegisterSpotRequest {
  /** STEP 3의 후보 id. 저장소 id가 아니다. */
  readonly candidateId: string;
  readonly name: string;
  /** OCR이 읽은 도로명 주소. 좌표는 서버가 이 주소로 다시 구한다. */
  readonly address: string;
  /**
   * 사용자가 STEP 3에서 고른 카테고리.
   *
   * 주소와 달리 OCR이 주지 못하는 값이라 화면이 실어 보낸다 — 서버가 이름만
   * 보고 정하려 들면 "피롤츠"가 카페인지 밥집인지 추측해야 한다. 고르지 않은
   * 건은 `'other'`로 온다.
   */
  readonly category: SpotCategory;
}

export interface RegisteredSpot {
  readonly candidateId: string;
  readonly name: string;
  /** 저장소가 부여한 id. 홈 지도를 그 스팟으로 여는 열쇠다. */
  readonly spotId: string;
}

export interface RegisterRejection {
  readonly candidateId: string;
  readonly name: string;
  readonly failure: SaveSpotFailure;
}

export interface RegisterSpotsResult {
  readonly registered: readonly RegisteredSpot[];
  readonly rejected: readonly RegisterRejection[];
}
