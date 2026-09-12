import { describe, expect, it } from 'vitest';
import { distanceTable } from './distance';
import { BOOK_C, CAFE_B, REQUEST_14_16, SHOP_A, START, failingGenerate, stubGenerate } from './fixtures.test-helper';
import { buildProposalUserPrompt, parseProposal, proposeOrder } from './propose';
import { START_ID } from './types';

const candidates = [CAFE_B, SHOP_A, BOOK_C];
const table = distanceTable([{ id: START_ID, coord: START }, ...candidates]);
const base = {
  start: START,
  window: REQUEST_14_16.window,
  candidates,
  table,
  requiredSpotIds: [] as string[],
  preferredCategories: ['cafe' as const],
};

describe('parseProposal', () => {
  it('순서와 이유를 그대로', () => {
    const parsed = parseProposal(
      { order: ['a', 'b', 'c'], reasons: [{ id: 'a', reason: '가깝다' }, { id: 'c', reason: '마지막' }] },
      candidates,
      [],
    );
    expect(parsed?.order.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(parsed?.reasons.get('a')).toBe('가깝다');
    expect(parsed?.reasons.get('b')).toBeUndefined();
  });

  it('모르는 id와 중복은 버리고 나머지는 살린다', () => {
    const parsed = parseProposal({ order: ['b', 'zzz', 'a', 'b'], reasons: [] }, candidates, []);
    expect(parsed?.order.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('필수 스팟이 빠졌으면 끝에 붙인다', () => {
    const parsed = parseProposal({ order: ['a'], reasons: [] }, candidates, ['c']);
    expect(parsed?.order.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('검증 뒤 순서가 비면 null', () => {
    expect(parseProposal({ order: ['zzz'], reasons: [] }, candidates, [])).toBeNull();
    expect(parseProposal('문자열', candidates, [])).toBeNull();
  });
});

describe('proposeOrder', () => {
  it('거리표와 후보를 프롬프트에 싣고 LLM 순서를 돌려준다', async () => {
    const calls: string[] = [];
    const result = await proposeOrder({
      ...base,
      generate: stubGenerate([{ order: ['a', 'b', 'c'], reasons: [{ id: 'a', reason: 'r' }] }], calls),
    });
    expect(result.kind).toBe('llm');
    if (result.kind === 'llm') expect(result.order.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(calls[0]).toContain('start ↔ a:');
    expect(calls[0]).toContain('카페 B');
    expect(calls[0]).toContain('시간 예산: 120분');
  });

  it('LLM 실패는 failed', async () => {
    const result = await proposeOrder({ ...base, generate: failingGenerate });
    expect(result.kind).toBe('failed');
  });

  it('재질의 피드백이 프롬프트에 들어간다', () => {
    const prompt = buildProposalUserPrompt({
      ...base,
      feedback: { overByMinutes: 19, previousOrder: ['a', 'b', 'c'] },
    });
    expect(prompt).toContain('19분 넘었다');
    expect(prompt).toContain('a → b → c');
  });
});
