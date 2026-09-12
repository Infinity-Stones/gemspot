import { openaiApiKey, openaiBaseUrl, openaiModel } from './env';
import { callChatCompletion, completionFailure } from './openaiCompatible';
import type { HttpFailure } from './httpClient';
import { httpFailure } from './httpClient';

/**
 * 언어 모델 어댑터 — OpenAI 호환 API로 구조화된 응답을 받는다(#149).
 *
 * 호환 통신 형식은 `openaiCompatible.ts`에서 처리한다. 노출하는 것은 제공자 중립 함수
 * `generateJson` 하나 — "지시문과 문장을 넣어 JSON을 받는다"만 안다. 프롬프트
 * 내용과 응답 검증은 도메인의 일이다(platform은 shared만 열 수 있어 도메인
 * 규칙을 알 수 없고, 알아서도 안 된다). 호환 제공자는 환경 변수로 교체한다.
 *
 * 실패 모양은 httpClient의 `HttpFailure`를 그대로 쓴다. 도메인의 폴백 판단이
 * HTTP 실패와 같은 판별 유니온으로 갈려야 코드가 하나로 모인다.
 */

export interface GenerateJsonInput {
  /** 시스템 지시문. 역할 · 출력 규칙. */
  readonly system: string;
  /** 사용자 문장 + 도메인이 붙인 컨텍스트. */
  readonly user: string;
  /** JSON Schema(제공자가 지원하는 부분집합). 응답이 이 모양으로 강제된다. */
  readonly schema: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
}

export type GenerateJsonResult =
  | { readonly ok: true; readonly data: unknown }
  | {
      readonly ok: false;
      readonly error: HttpFailure | { readonly kind: 'no_api_key' };
    };

export type GenerateJson = (
  input: GenerateJsonInput,
) => Promise<GenerateJsonResult>;

/** 구조화 출력은 수 초가 걸린다. GET 기본값(5초)보다 넉넉해야 한다. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** API 호출 한 번의 최소 면. 테스트에서 이것만 갈아 끼운다. */
export type JsonCaller = (params: {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly signal: AbortSignal;
}) => Promise<string | undefined>;

function apiCaller(apiKey: string, baseUrl: string | null): JsonCaller {
  return ({ model, system, user, schema, signal }) =>
    callChatCompletion({
      apiKey,
      baseUrl,
      model,
      schema,
      signal,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
}

export interface CreateGenerateJsonOptions {
  readonly apiKey?: string | null;
  readonly baseUrl?: string | null;
  readonly model?: string;
  readonly caller?: JsonCaller;
}

/**
 * `generateJson`을 만든다. 기본은 env의 키 · 모델과 실제 API. 키가 없으면 매
 * 호출이 `no_api_key`로 끝난다 — 만들 때 던지지 않는 이유는 키 없이도 앱이
 * 떠야 하기 때문이다.
 */
export function createGenerateJson(
  options: CreateGenerateJsonOptions = {},
): GenerateJson {
  const apiKey = options.apiKey === undefined ? openaiApiKey() : options.apiKey;
  const model = options.model ?? openaiModel() ?? '';
  const baseUrl =
    options.baseUrl === undefined ? openaiBaseUrl() : options.baseUrl;
  const caller =
    options.caller ?? (apiKey === null ? null : apiCaller(apiKey, baseUrl));

  return async ({ system, user, schema, timeoutMs = DEFAULT_TIMEOUT_MS }) => {
    if (caller === null) return { ok: false, error: { kind: 'no_api_key' } };

    let text: string | undefined;
    try {
      text = await caller({
        model,
        system,
        user,
        schema,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      return { ok: false, error: completionFailure(cause) };
    }

    if (text === undefined || text.length === 0) {
      return {
        ok: false,
        error: { kind: 'parse', message: '응답 본문이 비어 있습니다' },
      };
    }
    try {
      return { ok: true, data: JSON.parse(text) as unknown };
    } catch (cause) {
      return { ok: false, error: httpFailure('parse', cause) };
    }
  };
}

/** 기본 인스턴스. 모듈 로드 시점이 아니라 첫 호출에서 만든다(키 읽기 지연). */
let defaultInstance: GenerateJson | null = null;

export function generateJson(
  input: GenerateJsonInput,
): Promise<GenerateJsonResult> {
  defaultInstance ??= createGenerateJson();
  return defaultInstance(input);
}
