import type { GenerateJson, GenerateJsonResult } from '@/lib/platform/llm';
import { generateJson as defaultGenerateJson } from '@/lib/platform/llm';
import type { SpotCoordinates } from '@/shared/spot';
import type { RouteCandidate, TimeWindow } from '@/shared/routeRequest';
import type { SpotCategory } from '@/shared/spot';
import { dwellMinutesOf, labelOf } from '@/shared/spotCategory';
import { diffSeconds } from '@/shared/time';
import type { DistanceTable } from './distance';
import { WALK_DETOUR_FACTOR, WALK_SPEED_MPS } from './distance';
import { START_ID } from './types';

/**
 * 순서 · 이유 제안 — T38(#53).
 *
 * LLM은 지리를 계산하지 못하므로 **직선거리표를 함께 준다.** 이름만 주면
 * 동선이 지그재그가 된다. `table`을 필수 인자로 두어 거리표 없이 호출되는
 * 경로가 타입 수준에서 없다.
 */

export interface ProposeInput {
  readonly start: SpotCoordinates;
  readonly window: TimeWindow;
  readonly candidates: readonly RouteCandidate[];
  readonly table: DistanceTable;
  readonly requiredSpotIds: readonly string[];
  readonly preferredCategories: readonly SpotCategory[];
  /** T42 재질의 때만. 직전 제안이 얼마나 넘었는지. */
  readonly feedback?: {
    readonly overByMinutes: number;
    readonly previousOrder: readonly string[];
  };
  readonly generate?: GenerateJson;
}

export type ProposeResult =
  | {
      readonly kind: 'llm';
      readonly order: readonly RouteCandidate[];
      readonly reasons: ReadonlyMap<string, string>;
    }
  | {
      readonly kind: 'failed';
      readonly error:
        | Extract<GenerateJsonResult, { ok: false }>['error']
        | { kind: 'invalid_schema' };
    };

export const PROPOSAL_SCHEMA: Readonly<Record<string, unknown>> = {
  type: 'object',
  properties: {
    order: {
      type: 'array',
      items: { type: 'string' },
      description: '방문할 스팟 id를 순서대로',
    },
    reasons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reason: {
            type: 'string',
            description: '왜 이 자리에 오는지 한 문장',
          },
        },
        required: ['id', 'reason'],
      },
    },
  },
  required: ['order', 'reasons'],
};

const WALK_METERS_PER_MINUTE = Math.round(
  (WALK_SPEED_MPS * 60) / WALK_DETOUR_FACTOR,
);

export function buildProposalSystemPrompt(): string {
  return [
    '너는 도보 산책 동선을 짜는 플래너다. 주어진 후보 스팟 중 시간 예산 안에서 갈 곳과 순서를 정한다.',
    '규칙:',
    '- 거리표의 직선거리만 믿는다. 스팟 이름으로 위치를 짐작하지 않는다.',
    `- 도보 시간은 직선거리 ÷ ${String(WALK_METERS_PER_MINUTE)}m/분 으로 어림한다. 각 스팟의 체류 시간을 더한 합이 예산 안에 들어야 한다.`,
    '- 전부 방문하지 않아도 된다. 예산에 맞게 고르되, "꼭 갈 곳"은 반드시 넣는다.',
    '- 선호 카테고리는 우선하되 그것만 고르지는 않는다.',
    '- 출발점(start)에서 가까운 곳부터 크게 돌아 지그재그가 없게 한다.',
    '- reasons에는 order의 모든 id에 대해 왜 그 자리인지 한 문장씩 적는다. 거리·시간대·선호 중 근거를 댄다.',
    '- reason 문장은 사용자에게 그대로 보인다. id나 start 같은 내부 식별자 대신 장소 이름과 출발점이라는 말을 쓴다. 거리표는 직선거리이므로 실제 보행 거리를 확인했다고 말하지 않는다.',
    '- 실제 도보 경로는 제안 후 별도 API로 계산한다. reasons에는 거리·이동 시간의 숫자를 확정해서 쓰지 말고 가까움·선호 같은 선택 이유만 적는다.',
    '- order에는 주어진 후보 id만 쓴다.',
  ].join('\n');
}

export function buildProposalUserPrompt(input: ProposeInput): string {
  const budgetMinutes = Math.round(
    diffSeconds(input.window.start, input.window.end) / 60,
  );
  const label = (id: string): string => {
    if (id === START_ID) return 'start';
    const c = input.candidates.find(x => x.id === id);
    return c === undefined ? id : `${c.id}`;
  };
  const candidates = input.candidates
    .map(
      c =>
        `- ${c.id}: ${c.name} (${labelOf(c.category)}, 체류 ${String(dwellMinutesOf(c.category))}분)${
          input.requiredSpotIds.includes(c.id) ? ' [꼭 갈 곳]' : ''
        }`,
    )
    .join('\n');
  const lines = [
    `시간 예산: ${String(budgetMinutes)}분 (${input.window.start} ~ ${input.window.end})`,
    `선호 카테고리: ${input.preferredCategories.length > 0 ? input.preferredCategories.join(', ') : '(없음)'}`,
    '',
    '후보:',
    candidates,
    '',
    '직선거리표 (start = 출발점):',
    input.table.toText(label),
  ];
  if (input.feedback !== undefined) {
    lines.push(
      '',
      `직전 제안 [${input.feedback.previousOrder.join(' → ')}]은 종료 시각을 ${String(input.feedback.overByMinutes)}분 넘었다. 스팟을 줄이거나 순서를 바꿔 예산 안에 넣어라. 꼭 갈 곳은 빼지 마라.`,
    );
  }
  return lines.join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 응답 검증. 모르는 id는 **버리고** 나머지는 살린다(한 줄 깨짐이 전체를 버리지
 * 않게). 필수 스팟이 빠졌으면 **끝에 붙인다** — 빼는 결정은 사용자만 한다.
 * 검증 뒤 순서가 비면 `null`이고, 그때 호출자가 규칙 기반으로 간다.
 */
export function parseProposal(
  raw: unknown,
  candidates: readonly RouteCandidate[],
  requiredSpotIds: readonly string[],
): {
  order: readonly RouteCandidate[];
  reasons: ReadonlyMap<string, string>;
} | null {
  if (!isRecord(raw) || !Array.isArray(raw['order'])) return null;
  const byId = new Map(candidates.map(c => [c.id, c] as const));

  const seen = new Set<string>();
  const order: RouteCandidate[] = [];
  for (const id of raw['order'] as unknown[]) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    const c = byId.get(id);
    if (c === undefined) continue;
    seen.add(id);
    order.push(c);
  }
  for (const id of requiredSpotIds) {
    const c = byId.get(id);
    if (c !== undefined && !seen.has(id)) {
      seen.add(id);
      order.push(c);
    }
  }
  if (order.length === 0) return null;

  const reasons = new Map<string, string>();
  if (Array.isArray(raw['reasons'])) {
    for (const item of raw['reasons'] as unknown[]) {
      if (!isRecord(item)) continue;
      const id = item['id'];
      const reason = item['reason'];
      if (typeof id !== 'string' || typeof reason !== 'string') continue;
      if (seen.has(id) && reason.trim().length > 0)
        reasons.set(id, reason.trim());
    }
  }
  return { order, reasons };
}

export async function proposeOrder(
  input: ProposeInput,
): Promise<ProposeResult> {
  const generate = input.generate ?? defaultGenerateJson;
  const result = await generate({
    system: buildProposalSystemPrompt(),
    user: buildProposalUserPrompt(input),
    schema: PROPOSAL_SCHEMA,
  });
  if (!result.ok) return { kind: 'failed', error: result.error };

  const parsed = parseProposal(
    result.data,
    input.candidates,
    input.requiredSpotIds,
  );
  if (parsed === null)
    return { kind: 'failed', error: { kind: 'invalid_schema' } };
  return { kind: 'llm', order: parsed.order, reasons: parsed.reasons };
}
