'use server';

import { saveSpot } from '@/domain/spot';
import type {
  RegisteredSpot,
  RegisterRejection,
  RegisterSpotRequest,
  RegisterSpotsResult,
} from './registerState';

/**
 * 고른 후보를 스팟으로 저장한다 — T23(#32)의 저장 진입점.
 *
 * `src/app/spots/new/actions.ts`와 같은 `saveSpot`을 부른다. 입구가
 * 둘(손으로 적은 주소 · OCR이 읽은 주소)이어도 **저장 경로는 하나여야 한다** —
 * 좌표 없이는 저장하지 않는다는 규칙(T22)이 경로마다 따로 있으면 그중 하나는
 * 언젠가 그것을 빠뜨린다.
 *
 * 좌표를 받지 않는 것도 같은 이유다. 서버가 주소로 다시 Geocoding을 돌린
 * 결과만 저장된다.
 *
 * **한 건이 막혀도 멈추지 않는다.** 앞 건에서 끊으면 사용자가 고른 나머지는
 * 시도조차 되지 않은 채로 남고, 화면은 그 둘("막혔다"와 "해 보지 않았다")을
 * 구분해 말할 수 없다.
 *
 * 순서대로 돈다. 건수가 한 장에서 나온 두세 건이라 병렬로 얻을 것이 크지
 * 않은 반면, Geocoding을 한꺼번에 때리면 호출 한도에 먼저 걸린다.
 */
export async function registerSpotsAction(
  requests: readonly RegisterSpotRequest[],
): Promise<RegisterSpotsResult> {
  const registered: RegisteredSpot[] = [];
  const rejected: RegisterRejection[] = [];

  for (const request of requests) {
    const outcome = await saveSpot({
      name: request.name,
      address: request.address,
      // 사용자가 STEP 3에서 고른 값을 그대로 쓴다. 고르지 않았으면 화면이
      // 'other'를 실어 보낸다 — 여기서 이름을 보고 추측하지 않는다.
      category: request.category,
      // 이 주소가 어디서 왔는지는 이 진입점이 안다. 폼에서 읽으면 클라이언트가
      // 기록을 정하게 된다.
      origin: 'ocr',
    });

    if (outcome.kind === 'failed') {
      rejected.push({
        candidateId: request.candidateId,
        name: request.name,
        failure: outcome.failure,
      });
      continue;
    }

    registered.push({
      candidateId: request.candidateId,
      name: request.name,
      spotId: outcome.spot.id,
    });
  }

  return { registered, rejected };
}
