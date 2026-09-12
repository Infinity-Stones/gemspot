import type { ExtractFailureReason } from '@/domain/extraction';
import type { SpotCandidate } from '@/shared/spot';

/**
 * 업로드 화면이 서버 액션과 주고받는 상태.
 *
 * 서버 액션의 반환값이자 `useActionState`의 state다. 직렬화 경계를 넘으므로
 * 전부 plain object · 문자열이어야 한다 — `SpotCandidate`는 그 조건을 이미
 * 지킨다(문자열과 `null`뿐).
 */
export type ExtractState =
  | { readonly status: 'idle' }
  /** 파일이 없다. 서버까지 가지 않고 돌려보낸다. */
  | { readonly status: 'invalid'; readonly message: string }
  | { readonly status: 'failed'; readonly reason: ExtractFailureReason }
  | {
      readonly status: 'done';
      readonly candidates: readonly SpotCandidate[];
    };

export const IDLE_EXTRACT_STATE: ExtractState = { status: 'idle' };

/**
 * 만든 후보를 결과 화면으로 넘기는 자리.
 *
 * 결과가 다른 라우트에 있고(D03 · #17), 고른 파일은 `File` 객체라 라우트를
 * 넘지 못한다. 확정 전 후보를 저장소에 넣을 수도 없다 — 사용자가 확정해야
 * 스팟이 된다는 것이 STEP 3의 전제다.
 *
 * 그래서 브라우저의 `sessionStorage`를 거친다. 탭 안에서만 살고 닫으면
 * 사라지는 값인데, 확정 전 후보의 수명이 정확히 그렇다. 서버로 갈 이유도
 * 없다 — 사용자가 저장을 고르기 전까지 이 데이터는 아무 데도 남지 않아야 한다.
 */
export const CANDIDATES_SESSION_KEY = 'gemspot:extraction-candidates';
