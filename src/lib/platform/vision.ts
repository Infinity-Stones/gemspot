import { Buffer } from 'node:buffer';
import { openaiApiKey, openaiBaseUrl, openaiModel } from './env';
import {
  callChatCompletion,
  completionFailure,
  DEFAULT_AI_TIMEOUT_MS,
} from './openaiCompatible';
import type { HttpFailure } from './httpClient';
import { httpFailure } from './httpClient';

/**
 * 이미지에서 가게를 읽는 어댑터 — D02(#12)의 결정(Gemini 멀티모달).
 *
 * 명세(커밋 484684e)가 정한 방향이다. 글자만 떼어 읽는 OCR을 쓰지 않고 이미지를
 * 그대로 VLM에 넘겨 **상호명과 주소를 이미 나뉜 형태로** 받는다. 화면에 적힌
 * 것이 주소인지 해시태그인지 가게 이름인지 가르는 일은 결국 문맥 판단이고,
 * 글자만 읽으면 그 판단이 후처리로 밀린다.
 *
 * 호환 통신 형식은 `openaiCompatible.ts`에서 처리한다. 노출하는 것은 제공자 중립 함수
 * `readSpotsFromImage` 하나 — "이미지를 넣어 가게 목록을 받는다"만 안다.
 * 호환 제공자는 환경 변수로 교체한다.
 *
 * 출력 타입을 여기서 선언하는 이유는 레이어 규칙이다. platform은 shared만 열 수
 * 있어 도메인의 타입을 가져올 수 없다. 도메인 쪽 입력 타입(`ReadSpot`)과 필드가
 * 같아 구조적으로 호환되고, 잇는 것은 유스케이스(app)의 일이다. 어느 한쪽이
 * 필드 이름을 바꾸면 그 자리에서 타입 검사가 걸린다.
 */

/** 읽어낸 가게 한 곳. */
export interface VisionSpot {
  /** 상호명. 읽어내지 못했으면 빈 문자열. */
  readonly name: string;
  /**
   * 주소. 읽어내지 못했으면 빈 문자열.
   *
   * **화면에 적힌 그대로다.** 도로명인지 판단하는 것도, 지오코딩에 넣을 모양으로
   * 다듬는 것도 여기서 하지 않는다 — 모델이 주소를 "보완"하면 화면에 없던 글자가
   * 들어오고, 그때 도로명 검증(#15)이 지어낸 주소를 성공으로 통과시킨다.
   */
  readonly address: string;
}

export interface ReadSpotsInput {
  /** 이미지 바이트. 업로드 가드(#10)를 통과한 것만 여기 온다. */
  readonly bytes: Uint8Array;
  /** MIME 타입. `image/png` · `image/jpeg` · `image/webp`. */
  readonly mimeType: string;
  readonly timeoutMs?: number;
}

export type ReadSpotsResult =
  | { readonly ok: true; readonly spots: readonly VisionSpot[] }
  | {
      readonly ok: false;
      readonly error: HttpFailure | { readonly kind: 'no_api_key' };
    };

export type ReadSpotsFromImage = (
  input: ReadSpotsInput,
) => Promise<ReadSpotsResult>;

/**
 * 응답 모양을 강제하는 스키마.
 *
 * 배열인 것이 T12(#16)다 — 올리는 이미지는 한 장이지만 그 안의 가게는 여러
 * 곳일 수 있다. 피롤츠와 파브리키친이 한 화면에 들어오는 게시물이 그 경우다.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    spots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
        },
        required: ['name', 'address'],
      },
    },
  },
  required: ['spots'],
} as const;

/**
 * 지시문.
 *
 * 세 줄이 계약이다. **지어내지 말라**는 줄이 없으면 모델이 주소를 그럴듯하게
 * 채우고, 그 주소는 도로명 검증(#15)을 통과해 지도에 엉뚱한 핀으로 꽂힌다.
 * **그대로 적으라**는 줄이 없으면 모델이 시·도를 보태거나 층수를 떼는데, 그
 * 편집이 맞는지 확인할 방법이 없다. **가게마다 한 항목**이라는 줄이 T12다.
 */
const EXTRACT_PROMPT = [
  '이미지에서 가게의 상호명과 주소를 읽어낸다.',
  '',
  '- 한 장에 가게가 여러 곳이면 가게마다 한 항목으로 나눈다.',
  '- 화면에 보이는 글자를 그대로 적는다. 시·도를 보태거나 층수를 떼지 않는다.',
  '- 보이지 않는 것을 지어내지 않는다. 상호명이나 주소가 없으면 빈 문자열로 둔다.',
  '- 해시태그·계정명·좋아요 수·본문 설명은 상호명이 아니다.',
  '- 가게가 하나도 보이지 않으면 빈 목록을 돌려준다.',
].join('\n');

/** API 호출 한 번의 최소 면. 테스트와 실측에서 이것만 갈아 끼운다. */
export type VisionCaller = (params: {
  readonly model: string;
  readonly mimeType: string;
  readonly dataBase64: string;
  readonly prompt: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly signal: AbortSignal;
}) => Promise<string | undefined>;

function apiCaller(apiKey: string, baseUrl: string | null): VisionCaller {
  return ({ model, mimeType, dataBase64, prompt, schema, signal }) =>
    callChatCompletion({
      apiKey,
      baseUrl,
      model,
      schema,
      signal,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${dataBase64}` },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 응답을 어댑터의 모양으로 옮긴다(anti-corruption layer).
 *
 * 스키마를 강제했어도 **믿지 않는다.** 모델이 필드를 빠뜨리거나 숫자를 넣는
 * 일이 있고, 그때 캐스팅으로 넘기면 `undefined.trim()`이 화면에서 터진다.
 *
 * 항목 하나가 깨졌다고 목록 전체를 버리지 않는다. 한 가게가 이상하다고 같은
 * 사진의 나머지 가게를 잃으면 사용자는 그 사진을 다시 올려야 한다.
 */
export function parseVisionSpots(raw: unknown): readonly VisionSpot[] {
  // 대괄호 접근인 것은 `noPropertyAccessFromIndexSignature` 때문이다 — 인덱스
  // 시그니처에서 온 속성을 점으로 읽으면 TS4111로 막힌다. 바깥에서 온 값이라
  // 선언된 속성이 있을 수 없고, 그게 정확한 상태다.
  const candidates = isRecord(raw) ? raw['spots'] : undefined;
  if (!Array.isArray(candidates)) return [];

  const spots: VisionSpot[] = [];
  for (const item of candidates) {
    if (!isRecord(item)) continue;
    const name = item['name'];
    const address = item['address'];
    if (typeof name !== 'string' || typeof address !== 'string') continue;

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    // 둘 다 비어 있으면 읽어낸 것이 없다는 뜻이다. 목록에 올리면 STEP 3에
    // 아무것도 적히지 않은 빈 줄이 생긴다.
    if (trimmedName.length === 0 && trimmedAddress.length === 0) continue;

    spots.push({ name: trimmedName, address: trimmedAddress });
  }

  return spots;
}

export interface CreateReadSpotsOptions {
  readonly apiKey?: string | null;
  readonly baseUrl?: string | null;
  readonly model?: string;
  readonly caller?: VisionCaller;
}

/**
 * `readSpotsFromImage`를 만든다. 기본은 env의 키·모델과 실제 API.
 *
 * 키가 없으면 매 호출이 `no_api_key`로 끝난다 — 만들 때 던지지 않는 이유는 키
 * 없이도 앱이 떠야 하기 때문이다(`llm.ts`와 같은 판단).
 *
 * **빈 결과와 실패를 가른다.** 가게가 하나도 없는 사진은 실패가 아니라
 * `ok: true`에 빈 목록이다. 둘을 같은 값으로 접으면 "읽었는데 가게가 없었다"와
 * "읽지 못했다"가 화면에서 구분되지 않고, 사용자는 재시도해야 할 때와 직접
 * 입력해야 할 때를 알 수 없다.
 */
export function createReadSpotsFromImage(
  options: CreateReadSpotsOptions = {},
): ReadSpotsFromImage {
  const apiKey = options.apiKey === undefined ? openaiApiKey() : options.apiKey;
  const model = options.model ?? openaiModel() ?? '';
  const baseUrl =
    options.baseUrl === undefined ? openaiBaseUrl() : options.baseUrl;
  const caller =
    options.caller ?? (apiKey === null ? null : apiCaller(apiKey, baseUrl));

  return async ({ bytes, mimeType, timeoutMs = DEFAULT_AI_TIMEOUT_MS }) => {
    if (caller === null) return { ok: false, error: { kind: 'no_api_key' } };

    let text: string | undefined;
    try {
      text = await caller({
        model,
        mimeType,
        dataBase64: Buffer.from(bytes).toString('base64'),
        prompt: EXTRACT_PROMPT,
        schema: RESPONSE_SCHEMA,
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

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (cause) {
      return { ok: false, error: httpFailure('parse', cause) };
    }

    return { ok: true, spots: parseVisionSpots(raw) };
  };
}

/** 기본 인스턴스. 모듈 로드 시점이 아니라 첫 호출에서 만든다(키 읽기 지연). */
let defaultInstance: ReadSpotsFromImage | null = null;

export function readSpotsFromImage(
  input: ReadSpotsInput,
): Promise<ReadSpotsResult> {
  defaultInstance ??= createReadSpotsFromImage();
  return defaultInstance(input);
}
