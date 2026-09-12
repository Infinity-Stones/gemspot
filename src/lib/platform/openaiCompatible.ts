import type { HttpFailure } from './httpClient';
import { httpFailure } from './httpClient';

/** 텍스트·이미지 구조화 응답을 기다리는 공통 기본 상한. */
export const DEFAULT_AI_TIMEOUT_MS = 30_000;

/** 전송 오류와 응답 형식 오류를 기존 도메인의 실패 계약에 맞춰 전달한다. */
class CompletionError extends Error {
  readonly failure: HttpFailure;

  constructor(failure: HttpFailure) {
    super(failure.message);
    this.failure = failure;
  }
}

export function completionFailure(cause: unknown): HttpFailure {
  if (cause instanceof CompletionError) return cause.failure;
  const isTimeout =
    cause instanceof Error &&
    (cause.name === 'TimeoutError' || cause.name === 'AbortError');
  return httpFailure(isTimeout ? 'timeout' : 'network', cause);
}

type ContentPart =
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'image_url';
      readonly image_url: { readonly url: string };
    };

interface ChatMessage {
  readonly role: 'system' | 'user';
  readonly content: string | readonly ContentPart[];
}

interface CompletionInput {
  readonly apiKey: string;
  readonly baseUrl: string | null;
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly schema: Readonly<Record<string, unknown>>;
  readonly temperature: number;
  readonly signal: AbortSignal;
}

function completionUrl(baseUrl: string | null, model: string): string {
  const message = 'OPENAI_BASE_URL과 OPENAI_MODEL 설정을 확인해 주세요';
  if (!baseUrl?.trim() || !model.trim()) {
    throw new CompletionError({ kind: 'network', message });
  }
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new CompletionError({ kind: 'network', message });
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new CompletionError({ kind: 'network', message });
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/chat/completions`;
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 기존 필드·필수 값·null 허용은 유지하고 구조화 출력의 객체 조건을 붙인다. */
export function closeResponseSchema(
  schema: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...schema };
  const properties = schema['properties'];
  if (schema['type'] === 'object' || isRecord(properties)) {
    result['additionalProperties'] = false;
  }
  if (isRecord(properties)) {
    result['properties'] = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        isRecord(value) ? closeResponseSchema(value) : value,
      ]),
    );
  }
  const items = schema['items'];
  if (isRecord(items)) result['items'] = closeResponseSchema(items);
  for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
    const variants = schema[keyword];
    if (Array.isArray(variants)) {
      result[keyword] = variants.map((value: unknown) =>
        isRecord(value) ? closeResponseSchema(value) : value,
      );
    }
  }
  return result;
}

/** Google 전용 필드 없이 OpenAI Chat Completions 형식으로 요청한다. */
export async function callChatCompletion(
  input: CompletionInput,
): Promise<string> {
  const response = await fetch(completionUrl(input.baseUrl, input.model), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gemspot_response',
          strict: true,
          schema: closeResponseSchema(input.schema),
        },
      },
    }),
    signal: input.signal,
    redirect: 'error',
  });
  if (!response.ok) {
    // 제공자 오류 본문에는 요청·키가 포함될 수 있어 그대로 노출하지 않는다.
    throw new CompletionError({
      kind: 'status',
      status: response.status,
      message: `모델 API 요청 실패 (${String(response.status)})`,
    });
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (cause) {
    if (input.signal.aborted) throw input.signal.reason;
    throw new CompletionError(httpFailure('parse', cause));
  }
  const choices = isRecord(raw) ? raw['choices'] : undefined;
  const first: unknown = Array.isArray(choices) ? choices[0] : undefined;
  const message = isRecord(first) ? first['message'] : undefined;
  const content = isRecord(message) ? message['content'] : undefined;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new CompletionError({
      kind: 'parse',
      message: '모델 응답 본문이 비어 있거나 형식이 잘못되었습니다',
    });
  }
  if (isRecord(first) && first['finish_reason'] === 'length') {
    throw new CompletionError({
      kind: 'parse',
      message: '모델 응답이 길이 제한으로 잘렸습니다',
    });
  }
  return content;
}
