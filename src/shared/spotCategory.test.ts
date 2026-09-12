import { describe, expect, it } from 'vitest';
import { SPOT_CATEGORIES } from './spot';
import { SPOT_CATEGORY_TABLE, dwellMinutesOf, fitsWindow, overlapMinutes } from './spotCategory';

const window = (sh: number, sm: number, eh: number, em = 0) => ({
  startMinute: sh * 60 + sm,
  endMinute: eh * 60 + em,
});

describe('SPOT_CATEGORY_TABLE', () => {
  it('spot.ts의 카테고리 목록 전부에 행이 있고 체류 시간이 양수다', () => {
    for (const c of SPOT_CATEGORIES) {
      expect(SPOT_CATEGORY_TABLE[c].dwellMinutes).toBeGreaterThan(0);
      expect(SPOT_CATEGORY_TABLE[c].label.length).toBeGreaterThan(0);
    }
  });

  it('체류 수치: 카페 40 · 식사 60 · 영화 150', () => {
    expect(dwellMinutesOf('cafe')).toBe(40);
    expect(dwellMinutesOf('meal')).toBe(60);
    expect(dwellMinutesOf('movie')).toBe(150);
  });
});

describe('overlapMinutes', () => {
  it('두 시간대(식사 점심 · 저녁)를 합산한다', () => {
    // 13:00~18:00 vs 11:30~14:00 + 17:30~21:00 → 60 + 30
    expect(overlapMinutes(window(13, 0, 18), SPOT_CATEGORY_TABLE.meal)).toBe(90);
  });

  it("'always'는 요청 길이 전체", () => {
    expect(overlapMinutes(window(3, 0, 5), SPOT_CATEGORY_TABLE.other)).toBe(120);
  });

  it('자정을 넘는 요청은 다음 날 표와도 겹친다 — 22:00~01:00 영화는 120분', () => {
    expect(overlapMinutes({ startMinute: 22 * 60, endMinute: 25 * 60 }, SPOT_CATEGORY_TABLE.movie)).toBe(120);
  });

  it('길이 0 이하면 0', () => {
    expect(overlapMinutes(window(14, 0, 14), SPOT_CATEGORY_TABLE.cafe)).toBe(0);
  });
});

describe('fitsWindow (겹침 ≥ 기본 체류)', () => {
  it('14~16시면 식사는 빠지고 카페 · 오락 · 스포츠는 남는다', () => {
    const w = window(14, 0, 16);
    expect(fitsWindow('meal', w)).toBe(false);
    expect(fitsWindow('cafe', w)).toBe(true);
    expect(fitsWindow('amusement', w)).toBe(true);
    expect(fitsWindow('sports', w)).toBe(true);
    // 두 시간으로는 영화 한 편(150분)을 못 본다 — 문 연 시간과 무관하게 빠진다.
    expect(fitsWindow('movie', w)).toBe(false);
  });

  it('겹치기만 하고 체류할 시간이 없으면 후보가 아니다', () => {
    // 13:00~14:30 vs 식사 점심 11:30~14:00 → 겹침 60 ≥ 60 → 후보
    expect(fitsWindow('meal', window(13, 0, 14, 30))).toBe(true);
    // 13:30~14:30 → 겹침 30 < 60 → 제외
    expect(fitsWindow('meal', window(13, 30, 14, 30))).toBe(false);
  });
});
