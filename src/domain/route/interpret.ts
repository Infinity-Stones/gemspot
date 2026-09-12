import type { GenerateJson, GenerateJsonResult } from '@/lib/platform/llm';
import { generateJson as defaultGenerateJson } from '@/lib/platform/llm';
import type { TimeWindow } from '@/shared/routeRequest';
import { timeWindowProblem } from '@/shared/routeRequest';
import type { SpotCategory } from '@/shared/spot';
import { SPOT_CATEGORIES, isSpotCategory } from '@/shared/spot';
import { SPOT_CATEGORY_TABLE } from '@/shared/spotCategory';
import { parseIso } from '@/shared/time';
import type { InterpretationDraft, MissingField } from './types';

/**
 * 자연어 요청 해석 — T35(#50) · T36(#51).
 *
 * 프롬프트와 검증은 도메인 안에 있다. LLM 어댑터(platform)는 "문장을 넣어
 * JSON을 받는다"만 알고, 무엇을 뽑는지 · 뽑힌 것이 말이 되는지는 여기서 정한다.
 *
 * LLM이 문장에서 뽑는 것은 넷 — 시간대, 동네, 카테고리 선호, 꼭 갈 스팟.
 * 빠진 것은 `null`이고 **기본값으로 채우지 않는다.** 빠졌는지의 판정은 LLM에
 * 맡기지 않고 `null` 필드에서 기계적으로 만든다 — 판정을 LLM에 맡기면 "대충
 * 성수동이겠지"가 스며든다.
 */

export const QUESTION_WINDOW = '몇 시부터 몇 시까지요?';
export const QUESTION_AREA = '어느 동네에서 걸을까요?';
export const QUESTION_BOTH = '몇 시부터 몇 시까지, 어느 동네에서 걸을까요?';

export type InterpretationResult =
  | { readonly kind: 'complete'; readonly draft: InterpretationDraft & { window: TimeWindow; areaName: string } }
  | {
      readonly kind: 'incomplete';
      readonly missing: readonly MissingField[];
      readonly question: string;
      readonly draft: InterpretationDraft;
    }
  | { readonly kind: 'failed'; readonly error: Extract<GenerateJsonResult, { ok: false }>['error'] | { kind: 'invalid_schema' } };

export interface InterpretInput {
  readonly sentence: string;
  /** 요청 시각. 오프셋이 붙은 ISO. "오늘 2시" · "지금부터 두 시간"의 기준. */
  readonly now: string;
  /** 저장된 스팟 이름들. "꼭 갈 곳"을 이 이름으로 답하게 한다. */
  readonly spotNames: readonly string[];
  readonly generate?: GenerateJson;
}

const nullable = (schema: Record<string, unknown>): Record<string, unknown> => ({
  anyOf: [schema, { type: 'null' }],
});

export const INTERPRETATION_SCHEMA: Readonly<Record<string, unknown>> = {
  type: 'object',
  properties: {
    window: nullable({
      type: 'object',
      properties: {
        start: { type: 'string', description: '오프셋이 붙은 ISO 8601. 예: 2026-09-12T14:00:00+09:00' },
        end: { type: 'string', description: '오프셋이 붙은 ISO 8601' },
      },
      required: ['start', 'end'],
    }),
    areaName: nullable({ type: 'string', description: '동네 이름 그대로. 예: 성수동' }),
    preferredCategories: {
      type: 'array',
      items: { type: 'string', enum: [...SPOT_CATEGORIES] },
    },
    requiredSpotNames: {
      type: 'array',
      items: { type: 'string' },
      description: '주어진 스팟 이름 목록에 있는 이름만',
    },
  },
  required: ['window', 'areaName', 'preferredCategories', 'requiredSpotNames'],
};

export function buildSystemPrompt(): string {
  const categories = SPOT_CATEGORIES.map((c) => `- ${c}: ${SPOT_CATEGORY_TABLE[c].label}`).join('\n');
  return [
    '너는 산책 요청 문장을 구조화하는 해석기다. 사용자가 저장해 둔 장소 중 오늘 갈 곳을 고르는 데 쓰인다.',
    '문장에서 다음 넷만 뽑는다.',
    '1. window: 시작·종료 시각. 반드시 오프셋(+09:00)이 붙은 ISO 8601로. 상대 표현("지금부터 두 시간", "오늘 2시")은 함께 주어지는 요청 시각을 기준으로 절대 시각으로 바꾼다. 시각이 문장에 없으면 null. 추측해서 채우지 마라.',
    '2. areaName: 동네·지역 이름 그대로(예: 성수동, 연남동). 문장에 없으면 null. 추측해서 채우지 마라.',
    '3. preferredCategories: "카페 들르면서"처럼 드러난 선호를 아래 코드로. 없으면 빈 배열.',
    '4. requiredSpotNames: "꼭", "반드시", 특정 장소 이름처럼 꼭 가겠다고 한 곳. 주어진 저장된 스팟 이름 목록에 있는 이름만 그대로 넣는다. 없으면 빈 배열.',
    '',
    '카테고리 코드:',
    categories,
    '',
    '모르는 것은 null 또는 빈 배열이다. 문장에 없는 정보를 만들어 내지 않는다.',
  ].join('\n');
}

export function buildUserPrompt(input: { sentence: string; now: string; spotNames: readonly string[] }): string {
  const names = input.spotNames.length > 0 ? input.spotNames.join(', ') : '(없음)';
  return [
    `요청 시각(Asia/Seoul): ${input.now}`,
    `저장된 스팟 이름: ${names}`,
    '',
    `문장: ${input.sentence}`,
  ].join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * LLM 응답을 `InterpretationDraft`로 좁힌다. 스키마 밖이면 `null`.
 * 표에 없는 카테고리 코드는 버리고 나머지는 살린다.
 */
export function parseDraft(raw: unknown, now: string): InterpretationDraft | null {
  if (!isRecord(raw)) return null;
  const { window, areaName, preferredCategories, requiredSpotNames } = raw;

  let parsedWindow: TimeWindow | null = null;
  if (window !== null && window !== undefined) {
    if (!isRecord(window) || typeof window['start'] !== 'string' || typeof window['end'] !== 'string') {
      return null;
    }
    const candidate = { start: window['start'], end: window['end'] };
    // 형식이 틀렸거나, 역순이거나, 종료가 이미 지났으면 "시간대가 없다"로 본다.
    // 지난 시각을 그대로 받으면 사용자는 어제 동선을 받는다.
    const nowMs = parseIso(now);
    const endMs = parseIso(candidate.end);
    const usable =
      timeWindowProblem(candidate) === null && nowMs !== null && endMs !== null && endMs > nowMs;
    parsedWindow = usable ? candidate : null;
  }

  if (areaName !== null && areaName !== undefined && typeof areaName !== 'string') return null;
  const parsedArea = typeof areaName === 'string' && areaName.trim().length > 0 ? areaName.trim() : null;

  const categories: SpotCategory[] = Array.isArray(preferredCategories)
    ? preferredCategories.filter(isSpotCategory)
    : [];
  const names: string[] = Array.isArray(requiredSpotNames)
    ? requiredSpotNames.filter((n): n is string => typeof n === 'string' && n.length > 0)
    : [];

  return {
    window: parsedWindow,
    areaName: parsedArea,
    preferredCategories: [...new Set(categories)],
    requiredSpotNames: [...new Set(names)],
  };
}

/** `null` 필드에서 기계적으로. 선호 · 필수는 없어도 정당한 상태라 묻지 않는다. */
export function missingOf(draft: InterpretationDraft): readonly MissingField[] {
  const missing: MissingField[] = [];
  if (draft.window === null) missing.push('window');
  if (draft.areaName === null) missing.push('area');
  return missing;
}

export function questionFor(missing: readonly MissingField[]): string {
  const askWindow = missing.includes('window');
  const askArea = missing.includes('area');
  if (askWindow && askArea) return QUESTION_BOTH;
  if (askWindow) return QUESTION_WINDOW;
  return QUESTION_AREA;
}

export async function interpret(input: InterpretInput): Promise<InterpretationResult> {
  const generate = input.generate ?? defaultGenerateJson;
  const result = await generate({
    system: buildSystemPrompt(),
    user: buildUserPrompt(input),
    schema: INTERPRETATION_SCHEMA,
  });
  if (!result.ok) return { kind: 'failed', error: result.error };

  const draft = parseDraft(result.data, input.now);
  if (draft === null) return { kind: 'failed', error: { kind: 'invalid_schema' } };

  const missing = missingOf(draft);
  if (draft.window !== null && draft.areaName !== null) {
    return { kind: 'complete', draft: { ...draft, window: draft.window, areaName: draft.areaName } };
  }
  return { kind: 'incomplete', missing, question: questionFor(missing), draft };
}
