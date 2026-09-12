import type { SpotCandidate } from '@/shared/spot';
import type { ExtractedCandidate } from './extractCandidates';

/**
 * 도로명 주소 판별과 성공·실패 가르기 — 순수 규칙.
 *
 * 명세가 정한 기준은 하나다. **화면에 도로명 주소가 찍혀 있는가.** 여기서
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
 * - `(?![가-힣0-9])` — 숫자 뒤에 한글이 이어지면 건물번호가 아니다.
 *   `종로 3가`는 동 이름이고 `대로 5000원`은 가격이다. 이 한 줄이 없으면
 *   둘 다 도로명 주소로 통과한다.
 *
 * 시도·시군구를 요구하지 않는 이유: 명세의 기준이 "도로명 주소가 찍혀
 * 있는가"이지 "완전한 주소인가"가 아니다. `화랑로 608`만 찍힌 스크린샷을
 * 실패로 보내면 지오코딩이 풀 수 있었던 건을 사용자에게 다시 치게 한다.
 */
const ROAD_ADDRESS = /[가-힣A-Za-z0-9]*[로길]\s*\d+(?:-\d+)?(?![가-힣0-9])/u;

/** 이 문자열에 도로명 주소가 들어 있는가. */
export function isRoadAddress(text: string): boolean {
  return ROAD_ADDRESS.test(text);
}

/**
 * 뽑아낸 후보를 스팟 후보 계약으로 옮긴다.
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
  extracted: readonly ExtractedCandidate[],
  imageId: string,
): readonly SpotCandidate[] {
  return extracted.map((candidate, index) => ({
    id: `${imageId}:${String(index)}`,
    name: candidate.name,
    roadAddress: isRoadAddress(candidate.addressLine)
      ? candidate.addressLine
      : null,
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
