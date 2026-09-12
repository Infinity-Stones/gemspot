import type { PlanOutcome } from '@/domain/route';

/**
 * 동선 만들기 화면이 서버 액션과 주고받는 상태.
 *
 * 서버 액션의 반환값이자 `useActionState`의 state다. 직렬화 경계를 넘으므로
 * 전부 plain object · 문자열이어야 한다 — `PlanOutcome`은 그 조건을 이미
 * 지킨다(ISO 시각 · 배열 · 판별 유니온).
 */
export type RoutePlanState =
  | { readonly status: 'idle' }
  /** 문장이 비었다. 서버까지 가지 않고 돌려보낸다. */
  | { readonly status: 'invalid'; readonly message: string }
  /** 제출 시점에 저장 스팟을 다시 읽지 못했다. */
  | { readonly status: 'load_failed' }
  | {
      readonly status: 'done';
      /** 되묻기 답을 이어 붙인 뒤의 전체 문장. 다음 제출의 history가 된다. */
      readonly sentence: string;
      readonly outcome: PlanOutcome;
    };

export const IDLE_STATE: RoutePlanState = { status: 'idle' };

/** 문장 상한. LLM에 무제한 입력을 흘리지 않는다. API 라우트와 같은 값. */
export const MAX_SENTENCE_LENGTH = 500;
