import { describe, expect, it } from 'vitest';
import { failingGenerate, stubGenerate } from './fixtures.test-helper';
import {
  QUESTION_AREA,
  QUESTION_PAST_WINDOW,
  buildUserPrompt,
  interpret,
  parseDraft,
} from './interpret';

const NOW = '2026-09-12T13:07:00+09:00';
const base = { sentence: '', now: NOW, spotNames: ['카페 B', '서점 C'] };

describe('interpret (LLM 응답 고정)', () => {
  it('"오늘 2시부터 4시까지 성수동에서 카페 들르면서" → 14:00~16:00 · 성수동 · cafe', async () => {
    const result = await interpret({
      ...base,
      sentence: '오늘 2시부터 4시까지 성수동에서 카페 들르면서 걷고 싶어',
      generate: stubGenerate([
        {
          window: {
            start: '2026-09-12T14:00:00+09:00',
            end: '2026-09-12T16:00:00+09:00',
          },
          areaName: '성수동',
          preferredCategories: ['cafe'],
          requiredSpotNames: [],
        },
      ]),
    });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.draft.window).toEqual({
        start: '2026-09-12T14:00:00+09:00',
        end: '2026-09-12T16:00:00+09:00',
      });
      expect(result.draft.areaName).toBe('성수동');
      expect(result.draft.preferredCategories).toEqual(['cafe']);
    }
  });

  it('"성수동 걷고 싶어" → 시간을 만들거나 되묻지 않고 바로 추천한다', async () => {
    const result = await interpret({
      ...base,
      sentence: '성수동 걷고 싶어',
      generate: stubGenerate([
        {
          window: null,
          areaName: '성수동',
          preferredCategories: [],
          requiredSpotNames: [],
        },
      ]),
    });
    expect(result).toMatchObject({
      kind: 'complete',
      draft: { window: null, areaName: '성수동' },
    });
  });

  it('시간 유무에 관계없이 동네가 없을 때 동네만 묻는다', async () => {
    const window = {
      start: '2026-09-12T14:00:00+09:00',
      end: '2026-09-12T16:00:00+09:00',
    };
    const r1 = await interpret({
      ...base,
      generate: stubGenerate([
        {
          window,
          areaName: null,
          preferredCategories: [],
          requiredSpotNames: [],
        },
      ]),
    });
    const r2 = await interpret({
      ...base,
      generate: stubGenerate([
        {
          window: null,
          areaName: null,
          preferredCategories: [],
          requiredSpotNames: [],
        },
      ]),
    });
    expect(r1).toMatchObject({
      kind: 'incomplete',
      missing: ['area'],
      question: QUESTION_AREA,
    });
    expect(r2).toMatchObject({
      kind: 'incomplete',
      missing: ['area'],
      question: QUESTION_AREA,
    });
  });

  it('오프셋 없는 시각을 돌려줘도 받아들인다 — 모델이 붙였다 말았다 한다(#144)', async () => {
    const result = await interpret({
      ...base,
      sentence: '오늘 저녁 7시부터 9시까지 성수동에서 걷고 싶어',
      generate: stubGenerate([
        {
          // 오프셋이 없다. 실제 SDK 응답에서 관측된 모양.
          window: { start: '2026-09-12T19:00:00', end: '2026-09-12T21:00:00' },
          areaName: '성수동',
          preferredCategories: [],
          requiredSpotNames: [],
        },
      ]),
    });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.draft.window).toEqual({
        start: '2026-09-12T19:00:00+09:00',
        end: '2026-09-12T21:00:00+09:00',
      });
    }
  });

  it('이미 지난 시간대는 없는 것과 다른 문구로 되묻는다 — 같은 답을 반복하게 두지 않는다', async () => {
    const result = await interpret({
      ...base,
      // NOW는 13:07이다. 오전 9~11시는 이미 지났다.
      sentence: '오늘 9시부터 11시까지 성수동에서 걷고 싶어',
      generate: stubGenerate([
        {
          window: {
            start: '2026-09-12T09:00:00+09:00',
            end: '2026-09-12T11:00:00+09:00',
          },
          areaName: '성수동',
          preferredCategories: [],
          requiredSpotNames: [],
        },
      ]),
    });
    expect(result).toMatchObject({
      kind: 'incomplete',
      missing: ['window'],
      question: QUESTION_PAST_WINDOW,
    });
  });

  it('LLM 실패는 failed로, 기본값으로 채우지 않는다', async () => {
    const result = await interpret({ ...base, generate: failingGenerate });
    expect(result.kind).toBe('failed');
  });

  it('스키마 밖 응답은 invalid_schema', async () => {
    const result = await interpret({
      ...base,
      generate: stubGenerate(['그냥 문자열']),
    });
    expect(result).toMatchObject({
      kind: 'failed',
      error: { kind: 'invalid_schema' },
    });
  });
});

describe('parseDraft', () => {
  it('이미 지난 시간대는 "없다"로 본다 — 어제 동선을 주지 않는다', () => {
    const parsed = parseDraft(
      {
        window: {
          start: '2026-09-12T09:00:00+09:00',
          end: '2026-09-12T11:00:00+09:00',
        },
        areaName: '성수동',
        preferredCategories: [],
        requiredSpotNames: [],
      },
      NOW,
    );
    expect(parsed?.draft.window).toBeNull();
    // "없음"이 아니라 "지났음"으로 갈린다 — 되묻는 문구가 달라야 한다(#144)
    expect(parsed?.windowIssue).toBe('past');
  });

  it('"지금부터 두 시간" — 요청 시각 기준의 절대 시각이 통과한다', () => {
    const parsed = parseDraft(
      {
        window: { start: NOW, end: '2026-09-12T15:07:00+09:00' },
        areaName: '성수동',
        preferredCategories: [],
        requiredSpotNames: [],
      },
      NOW,
    );
    expect(parsed?.draft.window).toEqual({
      start: NOW,
      end: '2026-09-12T15:07:00+09:00',
    });
  });

  it('표에 없는 카테고리 코드는 버리고, 중복은 접는다', () => {
    const parsed = parseDraft(
      {
        window: null,
        areaName: null,
        preferredCategories: ['cafe', 'pub', 'cafe'],
        requiredSpotNames: ['카페 B', '카페 B'],
      },
      NOW,
    );
    expect(parsed?.draft.preferredCategories).toEqual(['cafe']);
    expect(parsed?.draft.requiredSpotNames).toEqual(['카페 B']);
  });

  it('빈 문자열 동네는 없는 것', () => {
    expect(
      parseDraft(
        {
          window: null,
          areaName: '  ',
          preferredCategories: [],
          requiredSpotNames: [],
        },
        NOW,
      )?.draft.areaName,
    ).toBeNull();
  });
});

describe('buildUserPrompt', () => {
  it('최신 답변과 이미 읽은 조건을 함께 넘기되 원문 길이를 늘리지 않는다', () => {
    const draft = {
      window: null,
      areaName: '성수동',
      preferredCategories: ['cafe'] as const,
      requiredSpotNames: ['카페 B'],
    };
    const prompt = buildUserPrompt({
      sentence: '내일 오후 2시부터 4시',
      now: NOW,
      spotNames: ['카페 B'],
      previousDraft: draft,
    });
    expect(prompt).toContain('내일 오후 2시부터 4시');
    expect(prompt).toContain(JSON.stringify(draft));
  });
  it('요청 시각과 스팟 이름을 함께 넘긴다', () => {
    const prompt = buildUserPrompt({
      sentence: '성수동',
      now: NOW,
      spotNames: ['카페 B'],
    });
    expect(prompt).toContain(NOW);
    expect(prompt).toContain('카페 B');
  });
});
