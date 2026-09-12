import { describe, expect, it } from 'vitest';
import { selectCandidates } from './candidates';
import { ALL_SPOTS, BOOK_C, CAFE_B, DESSERT_E, FOOD_D, PARK_F, REQUEST_14_16, SHOP_A } from './fixtures.test-helper';

describe('selectCandidates', () => {
  it('명세 예시: 14~16시 성수동 → 밥집은 시간대 밖, 공원 F는 반경 밖', () => {
    const { candidates, dropped } = selectCandidates(ALL_SPOTS, REQUEST_14_16);

    expect(candidates.map((c) => c.id)).toEqual(
      expect.arrayContaining([SHOP_A.id, CAFE_B.id, BOOK_C.id, DESSERT_E.id]),
    );
    expect(candidates).toHaveLength(4);
    expect(dropped).toEqual([
      { candidate: FOOD_D, reason: 'outside_window' },
      { candidate: PARK_F, reason: 'outside_area' },
    ]);
  });

  it('선호는 거르지 않고 앞으로만 보낸다', () => {
    const { candidates } = selectCandidates(ALL_SPOTS, REQUEST_14_16);
    expect(candidates[0]).toEqual(CAFE_B);
    // 나머지는 입력 순서 유지(안정 정렬)
    expect(candidates.slice(1).map((c) => c.id)).toEqual([SHOP_A.id, BOOK_C.id, DESSERT_E.id]);
  });

  it('필수 스팟은 시간대 · 반경 규칙을 건너뛴다', () => {
    const { candidates, dropped } = selectCandidates(ALL_SPOTS, {
      ...REQUEST_14_16,
      requiredSpotIds: [FOOD_D.id, PARK_F.id],
    });
    expect(candidates.map((c) => c.id)).toEqual(expect.arrayContaining([FOOD_D.id, PARK_F.id]));
    expect(dropped).toHaveLength(0);
  });

  it('점심 시간대에는 밥집이 들어오고, 겹침이 체류 시간에 못 미치면 빠진다', () => {
    const lunch = {
      ...REQUEST_14_16,
      window: { start: '2026-09-12T12:00:00+09:00', end: '2026-09-12T14:00:00+09:00' },
    };
    expect(selectCandidates(ALL_SPOTS, lunch).candidates.map((c) => c.id)).toContain(FOOD_D.id);

    const lateLunch = {
      ...REQUEST_14_16,
      window: { start: '2026-09-12T13:30:00+09:00', end: '2026-09-12T14:30:00+09:00' },
    };
    expect(selectCandidates(ALL_SPOTS, lateLunch).candidates.map((c) => c.id)).not.toContain(FOOD_D.id);
  });

  it('후보가 0이면 빈 배열과 전부의 이유를 돌려준다(T47 입력)', () => {
    const dawn = {
      ...REQUEST_14_16,
      window: { start: '2026-09-12T03:00:00+09:00', end: '2026-09-12T05:00:00+09:00' },
    };
    const { candidates, dropped } = selectCandidates(ALL_SPOTS, dawn);
    expect(candidates).toHaveLength(0);
    expect(dropped).toHaveLength(ALL_SPOTS.length);
  });
});
