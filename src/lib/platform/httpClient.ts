/**
 * HTTP 어댑터 — 바깥 세계와 이야기하는 유일한 통로.
 *
 * 이 레이어가 존재하는 이유는 `fetch`를 감싸는 것 자체가 아니라, **실패의
 * 모양을 한 곳에서 정하기 위해서**다. 화면과 도메인이 각자 try/catch를 쓰면
 * 같은 장애가 "네트워크 끊김"인지 "500"인지 "JSON 깨짐"인지 부르는 이름이
 * 파일마다 달라진다.
 *
 * 던지지 않고 `HttpResult`를 돌려준다. 예외는 "여기서 처리할 수 없다"는
 * 선언인데, HTTP 실패는 대부분 도메인이 **처리할 수 있는** 사건이다(캐시로
 * 폴백, 빈 목록, 재시도). 어느 쪽인지는 도메인이 알고 어댑터는 모르므로,
 * 결정을 도메인으로 넘긴다.
 */

/** 실패의 종류. 판별 유니온이라 `status`가 있는 경우만 status를 들고 있다. */
export type HttpFailure =
  | { readonly kind: 'network'; readonly message: string }
  | { readonly kind: 'timeout'; readonly message: string }
  | {
      readonly kind: 'status';
      readonly status: number;
      readonly message: string;
    }
  | { readonly kind: 'parse'; readonly message: string };

export type HttpResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: HttpFailure };

export interface GetJsonOptions {
  readonly timeoutMs?: number;
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * 테스트용 주입구. 전역 `fetch`를 monkey-patch하는 대신 인자로 받으면,
   * 테스트가 서로의 전역 상태를 밟지 않고 병렬로 돌 수 있다.
   */
  readonly fetchImpl?: typeof fetch;
}

export type PostJsonOptions = GetJsonOptions;

/**
 * 기본 타임아웃. 없으면 `fetch`는 OS의 TCP 타임아웃(수십 초)까지 매달려 있고,
 * 그동안 서버 컴포넌트 렌더가 통째로 멈춘다.
 */
const DEFAULT_TIMEOUT_MS = 5_000;

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function httpFailure(kind: 'network' | 'timeout' | 'parse', cause: unknown): HttpFailure {
  return { kind, message: messageOf(cause) };
}

/**
 * GET · POST가 공유하는 본체. 메서드와 본문만 다르고 실패를 접는 방식은 같아야
 * 하므로 한 함수다 — 둘로 나누면 타임아웃 · 상태 코드 처리가 조용히 어긋난다.
 */
async function requestJson<T>(
  method: 'GET' | 'POST',
  url: string,
  body: unknown,
  options: GetJsonOptions,
): Promise<HttpResult<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers,
    // 브라우저의 `fetch`는 `this`가 window여야 한다 — `const f = globalThis.fetch`
    // 로 떼어내 부르면 "Illegal invocation"으로 죽는다. 기본값 자리에서 미리
    // 묶어 둔다.
    fetchImpl = globalThis.fetch.bind(globalThis),
  } = options;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    // AbortSignal.timeout()이 끊으면 TimeoutError, 그 외 전송 실패는 TypeError.
    // 둘을 갈라 두는 이유: 타임아웃은 재시도가 말이 되고 네트워크 끊김은
    // 대개 아니다 — 그 판단을 도메인이 하려면 구분이 있어야 한다.
    const isTimeout = cause instanceof Error && cause.name === 'TimeoutError';
    return { ok: false, error: httpFailure(isTimeout ? 'timeout' : 'network', cause) };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        kind: 'status',
        status: response.status,
        message: `${String(response.status)} ${response.statusText}`,
      },
    };
  }

  try {
    // `T`는 이 함수가 **검증하지 않은** 약속이다. 응답 본문의 실제 모양을
    // 확인하는 것은 도메인 repository의 일이다(여기서 하면 어댑터가 도메인
    // 스키마를 알게 된다).
    const data: unknown = await response.json();
    return { ok: true, data: data as T };
  } catch (cause) {
    return { ok: false, error: httpFailure('parse', cause) };
  }
}

export async function getJson<T>(
  url: string,
  options: GetJsonOptions = {},
): Promise<HttpResult<T>> {
  return requestJson<T>('GET', url, undefined, options);
}

/** JSON 본문을 보내고 JSON을 받는다. 실패 모양은 `getJson`과 같다. */
export async function postJson<T>(
  url: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<HttpResult<T>> {
  return requestJson<T>('POST', url, body, options);
}
