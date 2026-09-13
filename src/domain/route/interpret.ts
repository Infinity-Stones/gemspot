import type { GenerateJson, GenerateJsonResult } from '@/lib/platform/llm';
import { generateJson as defaultGenerateJson } from '@/lib/platform/llm';
import type { TimeWindow } from '@/shared/routeRequest';
import { timeWindowProblem } from '@/shared/routeRequest';
import type { SpotCategory } from '@/shared/spot';
import { SPOT_CATEGORIES, isSpotCategory } from '@/shared/spot';
import { SPOT_CATEGORY_TABLE } from '@/shared/spotCategory';
import { normalizeSeoulIso, parseIso } from '@/shared/time';
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
/**
 * 시간대를 **읽었는데 이미 지난** 경우. 없는 것과 같은 질문을 돌려주면 사용자는
 * 같은 답을 반복하고 고리에서 빠져나오지 못한다(#144).
 */
export const QUESTION_PAST_WINDOW =
  '그 시간은 이미 지났어요. 날짜와 시작·종료 시각을 알려주세요. 예: 내일 오후 2시부터 4시까지, 또는 지금부터 두 시간.';
export const QUESTION_PAST_WINDOW_AND_AREA =
  '그 시간은 이미 지났어요. 몇 시부터 몇 시까지, 어느 동네에서 걸을까요?';

/** 시간대를 못 쓰게 된 이유. 되묻는 문구가 여기서 갈린다. */
export type WindowIssue = 'ok' | 'absent' | 'unusable' | 'past';

export type InterpretationResult =
  | {
      readonly kind: 'complete';
      readonly draft: InterpretationDraft & {
        window: TimeWindow;
        areaName: string;
      };
    }
  | {
      readonly kind: 'incomplete';
      readonly missing: readonly MissingField[];
      readonly question: string;
      readonly draft: InterpretationDraft;
    }
  | {
      readonly kind: 'failed';
      readonly error:
        | Extract<GenerateJsonResult, { ok: false }>['error']
        | { kind: 'invalid_schema' };
    };

export interface InterpretInput {
  readonly sentence: string;
  /** 요청 시각. 오프셋이 붙은 ISO. "오늘 2시" · "지금부터 두 시간"의 기준. */
  readonly now: string;
  /** 저장된 스팟 이름들. "꼭 갈 곳"을 이 이름으로 답하게 한다. */
  readonly spotNames: readonly string[];
  readonly generate?: GenerateJson;
}

const nullable = (
  schema: Record<string, unknown>,
): Record<string, unknown> => ({
  anyOf: [schema, { type: 'null' }],
});

export const INTERPRETATION_SCHEMA: Readonly<Record<string, unknown>> = {
  type: 'object',
  properties: {
    window: nullable({
      type: 'object',
      properties: {
        start: {
          type: 'string',
          description: '오프셋이 붙은 ISO 8601. 예: 2026-09-12T14:00:00+09:00',
        },
        end: { type: 'string', description: '오프셋이 붙은 ISO 8601' },
      },
      required: ['start', 'end'],
    }),
    areaName: nullable({
      type: 'string',
      description: '동네 이름 그대로. 예: 성수동',
    }),
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
  const categories = SPOT_CATEGORIES.map(
    c => `- ${c}: ${SPOT_CATEGORY_TABLE[c].label}`,
  ).join('\n');
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
    '이전 대화와 최신 답변이 함께 주어지면 최신 답변에서 수정한 날짜·시간·지역을 우선한다. 이전의 지난 시간대로 되돌리지 마라. 최신 답변에 없는 조건만 이전 대화에서 유지한다.',
    '시작 시간만 수정했고 종료 시간을 확정할 수 없으면 window는 null이다. 오전·오후나 종료 시간을 임의로 만들어 내지 마라.',
  ].join('\n');
}

export function buildUserPrompt(input: {
  sentence: string;
  now: string;
  spotNames: readonly string[];
}): string {
  const names =
    input.spotNames.length > 0 ? input.spotNames.join(', ') : '(없음)';
  const lines = input.sentence
    .split('\n')
    .filter(line => line.trim().length > 0);
  const latest = lines.at(-1) ?? '';
  const history = lines.slice(0, -1).join('\n');
  return [
    `요청 시각(Asia/Seoul): ${input.now}`,
    `저장된 스팟 이름: ${names}`,
    '',
    ...(history.length > 0 ? [`이전 대화: ${history}`] : []),
    `최신 답변: ${latest}`,
  ].join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 응답의 시간대를 읽는다. 오프셋이 없는 벽시계 시각도 받아들인다 — 모델이
 * 같은 프롬프트에도 오프셋을 붙였다 말았다 하기 때문이다(#144).
 *
 * 읽기는 했지만 못 쓰는 경우를 이유별로 갈라 돌려준다. 전부 "없음"으로 접으면
 * 화면이 왜 거절됐는지 말할 수 없다.
 */
export function readWindow(
  raw: unknown,
  now: string,
): { readonly window: TimeWindow | null; readonly issue: WindowIssue } {
  if (raw === null || raw === undefined)
    return { window: null, issue: 'absent' };
  if (!isRecord(raw)) return { window: null, issue: 'unusable' };

  const rawStart = raw['start'];
  const rawEnd = raw['end'];
  if (typeof rawStart !== 'string' || typeof rawEnd !== 'string') {
    return { window: null, issue: 'unusable' };
  }
  const start = normalizeSeoulIso(rawStart);
  const end = normalizeSeoulIso(rawEnd);
  if (start === null || end === null)
    return { window: null, issue: 'unusable' };

  const candidate = { start, end };
  if (timeWindowProblem(candidate) !== null)
    return { window: null, issue: 'unusable' };

  // 지난 시각을 그대로 받으면 사용자는 어제 동선을 받는다. 다만 "없음"과는
  // 구분한다 — 이유를 말해야 다른 답을 할 수 있다.
  const nowMs = parseIso(now);
  const endMs = parseIso(end);
  if (nowMs === null || endMs === null)
    return { window: null, issue: 'unusable' };
  if (endMs <= nowMs) return { window: null, issue: 'past' };

  return { window: candidate, issue: 'ok' };
}

/**
 * LLM 응답을 `InterpretationDraft`로 좁힌다. 스키마 밖이면 `null`.
 * 표에 없는 카테고리 코드는 버리고 나머지는 살린다.
 */
export function parseDraft(
  raw: unknown,
  now: string,
): {
  readonly draft: InterpretationDraft;
  readonly windowIssue: WindowIssue;
} | null {
  if (!isRecord(raw)) return null;
  const { window, areaName, preferredCategories, requiredSpotNames } = raw;

  const { window: parsedWindow, issue: windowIssue } = readWindow(window, now);

  if (
    areaName !== null &&
    areaName !== undefined &&
    typeof areaName !== 'string'
  )
    return null;
  const parsedArea =
    typeof areaName === 'string' && areaName.trim().length > 0
      ? areaName.trim()
      : null;

  const categories: SpotCategory[] = Array.isArray(preferredCategories)
    ? preferredCategories.filter(isSpotCategory)
    : [];
  const names: string[] = Array.isArray(requiredSpotNames)
    ? requiredSpotNames.filter(
        (n): n is string => typeof n === 'string' && n.length > 0,
      )
    : [];

  return {
    draft: {
      window: parsedWindow,
      areaName: parsedArea,
      preferredCategories: [...new Set(categories)],
      requiredSpotNames: [...new Set(names)],
    },
    windowIssue,
  };
}

/** `null` 필드에서 기계적으로. 선호 · 필수는 없어도 정당한 상태라 묻지 않는다. */
export function missingOf(draft: InterpretationDraft): readonly MissingField[] {
  const missing: MissingField[] = [];
  if (draft.window === null) missing.push('window');
  if (draft.areaName === null) missing.push('area');
  return missing;
}

export function questionFor(
  missing: readonly MissingField[],
  windowIssue: WindowIssue = 'absent',
): string {
  const askWindow = missing.includes('window');
  const askArea = missing.includes('area');
  if (askWindow && windowIssue === 'past') {
    return askArea ? QUESTION_PAST_WINDOW_AND_AREA : QUESTION_PAST_WINDOW;
  }
  if (askWindow && askArea) return QUESTION_BOTH;
  if (askWindow) return QUESTION_WINDOW;
  return QUESTION_AREA;
}

export async function interpret(
  input: InterpretInput,
): Promise<InterpretationResult> {
  const generate = input.generate ?? defaultGenerateJson;
  const result = await generate({
    system: buildSystemPrompt(),
    user: buildUserPrompt(input),
    schema: INTERPRETATION_SCHEMA,
  });
  if (!result.ok) return { kind: 'failed', error: result.error };

  const parsed = parseDraft(result.data, input.now);
  if (parsed === null)
    return { kind: 'failed', error: { kind: 'invalid_schema' } };

  const { draft, windowIssue } = parsed;
  const missing = missingOf(draft);
  if (draft.window !== null && draft.areaName !== null) {
    return {
      kind: 'complete',
      draft: { ...draft, window: draft.window, areaName: draft.areaName },
    };
  }
  return {
    kind: 'incomplete',
    missing,
    question: questionFor(missing, windowIssue),
    draft,
  };
}
