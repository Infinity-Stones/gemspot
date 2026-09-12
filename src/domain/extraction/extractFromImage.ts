import { readSpotsFromImage } from '@/lib/platform/vision';
import type { SpotCandidate } from '@/shared/spot';
import { toSpotCandidates } from './roadAddress';

/**
 * 추출 유스케이스 — 어댑터와 규칙을 잇는 한 줄기.
 *
 * 조립을 도메인에 두는 이유는 레이어 규칙이다. app은 `lib/platform`을 직접
 * 열 수 없으므로(eslint의 boundaries), 화면이 VLM 어댑터를 부를 방법은 도메인
 * 배럴을 지나는 것뿐이다. 그 제약이 있어서 화면이 제공자도 응답 형식도 모른다.
 *
 * 어댑터를 기본 인자로 열어 두는 것은 `src/domain/route`의 선례를 따른 것이다.
 * 네트워크 없이 이 조립을 확인할 수 있어야 한다.
 */

export type ExtractFailureReason =
  'no_api_key' | 'network' | 'timeout' | 'parse';

export type ExtractOutcome =
  | { readonly ok: true; readonly candidates: readonly SpotCandidate[] }
  | { readonly ok: false; readonly reason: ExtractFailureReason };

export interface ExtractFromImageInput {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  /**
   * 후보 id의 앞자리. 같은 사진이 같은 id를 내야 목록을 다시 그릴 때 사용자가
   * 고른 선택 상태가 풀리지 않는다.
   */
  readonly imageId: string;
}

/**
 * 이미지 한 장에서 확정 전 후보를 만든다.
 *
 * **빈 목록은 실패가 아니다.** 가게가 하나도 없는 사진은 `ok: true`에 빈
 * 목록이고, 화면은 "읽었는데 없었다"와 "읽지 못했다"를 다르게 말해야 한다.
 * 실패를 빈 목록으로 접으면 사용자는 재시도해야 할 때와 직접 입력해야 할 때를
 * 알 수 없다.
 */
export async function extractFromImage(
  { bytes, mimeType, imageId }: ExtractFromImageInput,
  read = readSpotsFromImage,
): Promise<ExtractOutcome> {
  const result = await read({ bytes, mimeType });

  if (!result.ok) {
    return { ok: false, reason: reasonOf(result.error.kind) };
  }

  return { ok: true, candidates: toSpotCandidates(result.spots, imageId) };
}

/**
 * 어댑터의 실패 종류를 도메인의 어휘로 좁힌다.
 *
 * `status`(HTTP 상태 실패)를 `network`로 접는 이유: 화면이 할 수 있는 일이
 * 같다 — 다시 해 보거나 직접 입력하는 것뿐이다. 상태 코드를 화면까지 올리면
 * 사용자가 읽을 수 없는 숫자가 하나 늘 뿐이다.
 */
function reasonOf(kind: string): ExtractFailureReason {
  if (kind === 'no_api_key') return 'no_api_key';
  if (kind === 'timeout') return 'timeout';
  if (kind === 'parse') return 'parse';
  return 'network';
}
