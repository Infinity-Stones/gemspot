import { describe, expect, it } from 'vitest';
import { SPOT_CATEGORIES, isSpotCategory } from './spot';

describe('SPOT_CATEGORIES', () => {
  // 이 목록은 D11의 적합 시간대 표·기본 체류 시간의 행 집합과 같다. 값이
  // 늘거나 줄면 저쪽에 행이 없는 카테고리가 생기고, 그 스팟은 후보 선별에서
  // 조용히 사라진다. 그 순간을 이 테스트가 깨져서 알린다.
  it('시간대 표와 짝인 여섯 값을 고정한다', () => {
    expect(SPOT_CATEGORIES).toEqual([
      'meal',
      'cafe',
      'movie',
      'amusement',
      'sports',
      'other',
    ]);
  });

  it('분류가 못 맞힌 곳을 담을 자리가 있다', () => {
    expect(SPOT_CATEGORIES).toContain('other');
  });
});

describe('isSpotCategory', () => {
  it('목록에 있는 값을 통과시킨다', () => {
    for (const category of SPOT_CATEGORIES) {
      expect(isSpotCategory(category)).toBe(true);
    }
  });

  it('목록에 없는 값을 거른다 — AI와 저장소가 주는 값은 그냥 문자열이다', () => {
    expect(isSpotCategory('카페')).toBe(false);
    expect(isSpotCategory('Cafe')).toBe(false);
    expect(isSpotCategory('brunch')).toBe(false);
    expect(isSpotCategory('')).toBe(false);
  });

  it('Object.prototype의 이름을 카테고리로 보지 않는다', () => {
    // 배열 includes라 지금은 통과하지만, 구현을 객체 조회로 바꾸면
    // 'toString'이 카테고리가 된다. 그 회귀를 여기서 잡는다.
    expect(isSpotCategory('toString')).toBe(false);
    expect(isSpotCategory('constructor')).toBe(false);
  });
});
