import type { SpotCandidate } from '@/shared/spot';

/**
 * 도로명 주소 판별과 성공·실패 가르기 — 순수 규칙.
 *
 * **VLM이 읽어낸 주소를 검증하는 자리다.** 명세는 이미지를 그대로 VLM에 넘겨
 * 상호명과 주소를 받는 쪽으로 정해졌지만, 받은 주소가 지오코딩에 넣을 수 있는
 * 모양인지는 규칙이 봐야 한다. 모델은 `용산동2가`를 주소라고 내놓을 수 있고,
 * 그걸 그대로 STEP 4로 보내면 저장 단계에서야 실패한다. 여기서 가르면 그
 * 건은 STEP 3의 실패 목록에 올라 사용자가 직접 칠 수 있다.
 *
 * 명세가 정한 기준은 하나다. **도로명 주소인가.** 여기서
 * 말하는 성공·실패는 OCR이 읽어냈는가이지 지도에 핀이 찍혔는가가 아니다 —
 * 좌표로 바꾸는 일은 STEP 4(#29)이고, 거기서 또 실패할 수 있다.
 *
 * 동 이름만으로 핀을 찍으면 엉뚱한 곳에 꽂힌다. `용산동2가`는 그 동 전체를
 * 가리키므로 가게 위치가 아니다. 그래서 번지 없는 주소는 실패로 보내
 * 사용자에게 직접 입력을 받는다(T17 · #24).
 */

/**
 * 도로명 + 건물번호.
 *
 * - `[가-힣A-Za-z0-9]*[로길]` — 도로명. 숫자를 품는 것은 `한강대로15길` 때문이다.
 *   탐욕 매칭이 그 토큰의 **마지막** 로·길을 잡으므로 `한강대로15길`이 통째로
 *   도로명이 된다.
 * - `\s*\d+(?:-\d+)?` — 건물번호와 부번. 공백이 없어도(`한강대로56`) 받는다.
 * - `(?![가-힣0-9A-Za-z])` — 숫자 뒤에 글자가 이어지면 건물번호가 아니다.
 *   `종로 3가`는 동 이름, `대로 5000원`은 가격, `바로 200m 앞`은 길안내다.
 *   이 한 줄이 없으면 셋 다 도로명 주소로 통과한다. 라틴 문자까지 막는 것은
 *   `200m` 하나 때문인데, 건물번호 뒤에 영문이 붙는 한국 주소는 없으므로
 *   잃는 것이 없다.
 *
 * 시도·시군구를 요구하지 않는 이유: 명세의 기준이 "도로명 주소가 찍혀
 * 있는가"이지 "완전한 주소인가"가 아니다. `화랑로 608`만 찍힌 스크린샷을
 * 실패로 보내면 지오코딩이 풀 수 있었던 건을 사용자에게 다시 치게 한다.
 *
 * 갈래도로(`한강대로15길` · `봉은사로 68번길` · `성수이로 7길`)는 따로 다루지
 * 않아도 잡힌다 — 탐욕 매칭이 `15길` · `68번길` · `7길`을 도로명으로 읽고 그
 * 뒤의 번호를 건물번호로 읽는다. 공백이 끼어 있어도(`성수이로 7길 20`) 같다.
 * 시드 데이터(src/domain/spot/seed.ts)에 그 표기가 실제로 들어 있어서, 여기서
 * 못 읽으면 시드조차 실패로 떨어진다.
 *
 * **지번 주소는 실패다.** `한강로2가 40-1`은 번지가 있어도 도로명이 아니다.
 * 명세가 기준을 "도로명 주소가 찍혀 있는지 하나"로 못 박았고 계약의 필드
 * 이름도 roadAddress다. 규칙의 부작용이 아니라 의도이므로 테스트로 고정한다.
 */
const ROAD_ADDRESS =
  /[가-힣A-Za-z0-9]*[로길]\s*\d+(?:-\d+)?(?![가-힣0-9A-Za-z])/u;

/** 이 문자열에 도로명 주소가 들어 있는가. */
export function isRoadAddress(text: string): boolean {
  return ROAD_ADDRESS.test(text);
}

/**
 * VLM이 읽어낸 한 건. 어댑터(T09 · #13)의 출력 모양이고, 그 어댑터가
 * 무엇이든 이 둘만 주면 된다 — 도메인은 제공자도 응답 형식도 모른다.
 */
export interface ReadSpot {
  /** 상호명. 읽어내지 못했으면 빈 문자열. */
  readonly name: string;
  /** 주소. 읽어내지 못했으면 빈 문자열. 도로명인지는 아래에서 가른다. */
  readonly address: string;
}

/**
 * 읽어낸 건을 스팟 후보 계약으로 옮긴다.
 *
 * `roadAddress`가 `null`인 것이 STEP 3의 실패 건이다 — 그 판정을 여기서 한 번
 * 내리면 화면은 다시 판단하지 않는다.
 *
 * id를 이미지와 순서로 만드는 이유는 **같은 입력이 같은 id를 내야** 하기
 * 때문이다. 난수로 만들면 목록을 다시 그릴 때마다 사용자가 고른 선택 상태가
 * 풀린다. 저장소가 부여하는 id와는 다른 값이고, 그 둘을 섞지 않으려고
 * `SpotCandidate`와 `SavedSpot`의 id를 계약에서 갈라 두었다.
 */
export function toSpotCandidates(
  read: readonly ReadSpot[],
  imageId: string,
): readonly SpotCandidate[] {
  return read.map((candidate, index) => ({
    id: `${imageId}:${String(index)}`,
    name: candidate.name,
    roadAddress: isRoadAddress(candidate.address) ? candidate.address : null,
    origin: 'ocr',
  }));
}

export interface RoadAddressPartition {
  /** 도로명 주소가 잡힌 건. STEP 3의 "성공한 건". */
  readonly resolved: readonly SpotCandidate[];
  /** 도로명 주소가 없는 건. STEP 3의 "실패한 건" — 직접 입력을 받는다. */
  readonly unresolved: readonly SpotCandidate[];
}

/**
 * 성공 건과 실패 건으로 가른다. **버리지 않는다** — 둘을 합치면 넣은 수다.
 *
 * 입력 순서를 지킨다. 사용자가 앨범에서 고른 순서가 목록 순서여야 어느 사진의
 * 결과인지 눈으로 이을 수 있다.
 */
export function partitionByRoadAddress(
  candidates: readonly SpotCandidate[],
): RoadAddressPartition {
  const resolved: SpotCandidate[] = [];
  const unresolved: SpotCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.roadAddress === null) unresolved.push(candidate);
    else resolved.push(candidate);
  }

  return { resolved, unresolved };
}
