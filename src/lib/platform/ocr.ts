import { Buffer } from 'node:buffer';
import { GoogleGenAI } from '@google/genai';
import { geminiApiKey, geminiModel } from './env';
import type { HttpFailure } from './httpClient';
import { httpFailure } from './httpClient';

/**
 * OCR 어댑터 — D02(#12)의 결정(Gemini 멀티모달, `@google/genai`).
 *
 * 제공자를 아는 파일은 **이것 하나**다. 노출하는 것은 제공자 중립 함수
 * `readImageText` 하나 — "이미지를 넣어 글자를 받는다"만 안다. 도메인은
 * 제공자 이름도 모델 이름도 모른다.
 *
 * **글자를 읽는 데까지만 맡긴다.** 가게명과 주소를 짝짓고 도로명인지 가르는
 * 일은 `src/domain/extraction`의 규칙이 한다. 읽기와 해석을 한 번에 시키면
 * 편하지만 두 가지를 잃는다 — 모델이 없는 주소를 지어내도 드러나지 않고,
 * 같은 스크린샷에 매번 같은 답이 온다는 보장이 없다. 그 오류는 테스트로
 * 고정되지 않는다.
 *
 * 전용 OCR API(CLOVA · Vision) 대신 멀티모달을 고른 이유는 붙이는 비용이다.
 * `@google/genai`와 `GEMINI_API_KEY`가 이미 트리에 있어(D12 · #44) 새 의존성도
 * 새 키도 새 콘솔도 생기지 않는다.
 */

export interface ReadImageTextInput {
  /** 이미지 바이트. 업로드 가드(#10)를 통과한 것만 여기 온다. */
  readonly bytes: Uint8Array;
  /** MIME 타입. `image/png` · `image/jpeg` · `image/webp`. */
  readonly mimeType: string;
  readonly timeoutMs?: number;
}

export type ReadImageTextResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false;
      readonly error: HttpFailure | { readonly kind: 'no_api_key' };
    };

export type ReadImageText = (
  input: ReadImageTextInput,
) => Promise<ReadImageTextResult>;

/** 이미지 한 장을 읽는 데 몇 초가 걸린다. 문장 생성(15초)보다 넉넉하게 둔다. */
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * 옮겨 적기 지시문.
 *
 * **줄 순서를 유지하라는 줄이 계약의 일부다.** 가게명과 주소를 잇는 규칙(#98)이
 * "주소 바로 앞 줄이 가게명"에 기대기 때문이다. 순서가 흐트러지면 두 가게의
 * 이름과 주소가 뒤바뀐다.
 *
 * 해석을 금지하는 줄도 마찬가지다. 모델이 주소를 "정리"하면 화면에 없던 글자가
 * 들어오고, 그때 도로명 판별(#97)은 지어낸 주소를 성공으로 통과시킨다.
 */
const TRANSCRIBE_PROMPT = [
  '이미지에 보이는 글자를 그대로 옮겨 적는다.',
  '',
  '- 화면에 보이는 순서대로 줄 단위로 옮기고, 줄바꿈을 유지한다.',
  '- 보이지 않는 글자를 지어내지 않는다. 흐릿하면 보이는 만큼만 적는다.',
  '- 번역하지 않고, 맞춤법을 고치지 않고, 요약하지 않는다.',
  '- 설명·사과·머리말·따옴표를 붙이지 않는다. 옮긴 글자만 출력한다.',
  '- 글자가 하나도 없으면 아무것도 출력하지 않는다.',
].join('\n');

/** SDK 호출 한 번의 최소 면. 테스트에서 이것만 갈아 끼운다. */
export type ImageTextCaller = (params: {
  readonly model: string;
  readonly mimeType: string;
  readonly dataBase64: string;
  readonly prompt: string;
  readonly signal: AbortSignal;
}) => Promise<string | undefined>;

function sdkCaller(apiKey: string): ImageTextCaller {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, mimeType, dataBase64, prompt, signal }) => {
    const response = await ai.models.generateContent({
      model,
      contents: [
        { inlineData: { mimeType, data: dataBase64 } },
        { text: prompt },
      ],
      config: {
        // 옮겨 적기에 창의성은 오답이다. 같은 이미지가 같은 글자를 내야 한다.
        temperature: 0,
        abortSignal: signal,
      },
    });
    return response.text;
  };
}

export interface CreateReadImageTextOptions {
  readonly apiKey?: string | null;
  readonly model?: string;
  readonly caller?: ImageTextCaller;
}

/**
 * `readImageText`를 만든다. 기본은 env의 키·모델과 실제 SDK.
 *
 * 키가 없으면 매 호출이 `no_api_key`로 끝난다 — 만들 때 던지지 않는 이유는
 * 키 없이도 앱이 떠야 하기 때문이다(`llm.ts`와 같은 판단).
 *
 * **빈 결과와 실패를 가른다.** 글자가 하나도 없는 사진은 실패가 아니라
 * `ok: true`에 빈 문자열이다. 그 둘을 같은 값으로 접으면 "읽었는데 글자가
 * 없었다"와 "읽지 못했다"가 화면에서 구분되지 않고, 사용자는 재시도해야 할
 * 때와 직접 입력해야 할 때를 알 수 없다.
 */
export function createReadImageText(
  options: CreateReadImageTextOptions = {},
): ReadImageText {
  const apiKey = options.apiKey === undefined ? geminiApiKey() : options.apiKey;
  const model = options.model ?? geminiModel();
  const caller = options.caller ?? (apiKey === null ? null : sdkCaller(apiKey));

  return async ({ bytes, mimeType, timeoutMs = DEFAULT_TIMEOUT_MS }) => {
    if (caller === null) return { ok: false, error: { kind: 'no_api_key' } };

    let text: string | undefined;
    try {
      text = await caller({
        model,
        mimeType,
        dataBase64: Buffer.from(bytes).toString('base64'),
        prompt: TRANSCRIBE_PROMPT,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      const isTimeout =
        cause instanceof Error &&
        (cause.name === 'TimeoutError' || cause.name === 'AbortError');
      return {
        ok: false,
        error: httpFailure(isTimeout ? 'timeout' : 'network', cause),
      };
    }

    // 응답 자체가 없는 것은 실패다. 빈 문자열(글자 없는 사진)과 다르다.
    if (text === undefined) {
      return {
        ok: false,
        error: { kind: 'parse', message: '응답 본문이 비어 있습니다' },
      };
    }

    return { ok: true, text: text.trim() };
  };
}

/** 기본 인스턴스. 모듈 로드 시점이 아니라 첫 호출에서 만든다(키 읽기 지연). */
let defaultInstance: ReadImageText | null = null;

export function readImageText(
  input: ReadImageTextInput,
): Promise<ReadImageTextResult> {
  defaultInstance ??= createReadImageText();
  return defaultInstance(input);
}
