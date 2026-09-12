import { describe, expect, it } from 'vitest';
import {
  SPOT_CATEGORIES,
  SPOT_CATEGORY_TABLE,
  dwellMinutesOf,
  fitsWindow,
  isSpotCategory,
  overlapMinutes,
} from './spotCategory';

const window = (sh: number, sm: number, eh: number, em = 0) => ({
  startMinute: sh * 60 + sm,
  endMinute: eh * 60 + em,
});

describe('SPOT_CATEGORY_TABLE (D11 제안값)', () => {
  it('모든 카테고리에 행이 있고 체류 시간이 양수다', () => {
    for (const c of SPOT_CATEGORIES) {
      expect(SPOT_CATEGORY_TABLE[c].dwellMinutes).toBeGreaterThan(0);
    }
  });

  it('명세 예시 수치: 카페 40 · 밥집 60 · 편집숍 20 · 서점 30', () => {
    expect(dwellMinutesOf('cafe')).toBe(40);
    expect(dwellMinutesOf('restaurant')).toBe(60);
    expect(dwellMinutesOf('shop')).toBe(20);
    expect(dwellMinutesOf('bookstore')).toBe(30);
  });

  it('isSpotCategory는 표에 있는 코드만 통과시킨다', () => {
    expect(isSpotCategory('cafe')).toBe(true);
    expect(isSpotCategory('pub')).toBe(false);
    expect(isSpotCategory(3)).toBe(false);
  });
});

describe('overlapMinutes', () => {
  it('두 시간대(밥집 점심 · 저녁)를 합산한다', () => {
    // 13:00~18:00 vs 11:30~14:00 + 17:30~21:00 → 60 + 30
    expect(overlapMinutes(window(13, 0, 18), SPOT_CATEGORY_TABLE.restaurant)).toBe(90);
  });

  it("'always'는 요청 길이 전체", () => {
    expect(overlapMinutes(window(3, 0, 5), SPOT_CATEGORY_TABLE.other)).toBe(120);
  });

  it('자정을 넘는 요청은 다음 날 표와도 겹친다 — 22:00~01:00 술집은 120분', () => {
    expect(overlapMinutes({ startMinute: 22 * 60, endMinute: 25 * 60 }, SPOT_CATEGORY_TABLE.bar)).toBe(120);
  });

  it('길이 0 이하면 0', () => {
    expect(overlapMinutes(window(14, 0, 14), SPOT_CATEGORY_TABLE.cafe)).toBe(0);
  });
});

describe('fitsWindow (겹침 ≥ 기본 체류)', () => {
  it('명세 예시: 14~16시면 밥집은 빠지고 카페 · 상점 · 서점은 남는다', () => {
    const w = window(14, 0, 16);
    expect(fitsWindow('restaurant', w)).toBe(false);
    expect(fitsWindow('cafe', w)).toBe(true);
    expect(fitsWindow('shop', w)).toBe(true);
    expect(fitsWindow('bookstore', w)).toBe(true);
    expect(fitsWindow('exhibit', w)).toBe(true);
  });

  it('겹치기만 하고 체류할 시간이 없으면 후보가 아니다', () => {
    // 13:00~14:30 vs 밥집 점심 11:30~14:00 → 겹침 60 ≥ 60 → 후보
    expect(fitsWindow('restaurant', window(13, 0, 14, 30))).toBe(true);
    // 13:30~14:30 → 겹침 30 < 60 → 제외
    expect(fitsWindow('restaurant', window(13, 30, 14, 30))).toBe(false);
  });
});
