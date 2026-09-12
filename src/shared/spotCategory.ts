import type { SpotCategory } from './spot';
import { SPOT_CATEGORIES } from './spot';

/**
 * 카테고리별 적합 시간대 표와 기본 체류 시간 — D11(#43)의 결정을 코드로.
 *
 * 카테고리 목록 자체는 `spot.ts`의 `SPOT_CATEGORIES`가 단일 소스다. 이 표는
 * 그 목록의 **모든 행**을 가져야 한다 — `Record<SpotCategory, …>`가 그것을
 * 타입으로 강제하므로, 목록에 값이 늘면 여기서 컴파일이 깨진다.
 *
 * 동선 가이드는 "14~16시면 밥집은 빠지고 카페 · 상점 · 구경거리만 후보"처럼
 * 이 표로 후보를 거른다. 값은 D11의 제안값이고 리뷰로 바뀔 수 있다 — 바꾸는
 * 곳은 이 파일 하나다.
 */

/** 하루 안의 분 범위. `[startMinute, endMinute)`. 0 ≤ start < end ≤ 1440. */
export interface MinuteRange {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface SpotCategoryRule {
  readonly label: string;
  /** 적합 시간대. `'always'`면 시간대로 거르지 않는다. */
  readonly openRanges: readonly MinuteRange[] | 'always';
  /** 기본 체류 시간(분). 시간 배치와 후보 판정 문턱에 함께 쓴다. */
  readonly dwellMinutes: number;
}

function range(startHour: number, startMinute: number, endHour: number, endMinute = 0): MinuteRange {
  return {
    startMinute: startHour * 60 + startMinute,
    endMinute: endHour * 60 + endMinute,
  };
}

export const SPOT_CATEGORY_TABLE: Readonly<Record<SpotCategory, SpotCategoryRule>> = {
  cafe: { label: '카페 · 디저트', openRanges: [range(9, 0, 21)], dwellMinutes: 40 },
  restaurant: {
    label: '밥집',
    // 점심 · 저녁 두 시간대. 14~16시 요청에는 어느 쪽과도 겹치지 않는다.
    openRanges: [range(11, 30, 14), range(17, 30, 21)],
    dwellMinutes: 60,
  },
  bar: { label: '술집', openRanges: [range(17, 0, 24)], dwellMinutes: 60 },
  // 편집숍 · 서점. 명세 예시는 편집숍 20분 · 서점 30분으로 갈랐지만 계약이
  // 한 카테고리로 묶었으므로 짧은 쪽을 기본값으로 둔다 — 길게 잡으면 후보가
  // 시간대 문턱에서 더 많이 빠진다.
  shop: { label: '상점 · 서점', openRanges: [range(11, 0, 20)], dwellMinutes: 20 },
  sight: { label: '구경거리 · 공원', openRanges: [range(10, 0, 18)], dwellMinutes: 45 },
  other: { label: '기타', openRanges: 'always', dwellMinutes: 30 },
};

/** 표의 모든 행이 목록과 같은 순서로. 화면의 칩 · 프롬프트의 코드 목록에 쓴다. */
export const SPOT_CATEGORY_CODES: readonly SpotCategory[] = SPOT_CATEGORIES;

export function dwellMinutesOf(category: SpotCategory): number {
  return SPOT_CATEGORY_TABLE[category].dwellMinutes;
}

export function labelOf(category: SpotCategory): string {
  return SPOT_CATEGORY_TABLE[category].label;
}

const MINUTES_PER_DAY = 1_440;

/**
 * 요청 시간대(그 날 0시 기준 분, 자정을 넘으면 `endMinute > 1440`)와 카테고리
 * 적합 시간대의 겹침(분). `'always'`면 요청 길이 전체.
 *
 * 자정을 넘는 요청은 다음 날 같은 표가 이어진다고 보고, 표를 하루 뒤로 밀어
 * 한 번 더 겹친다. 그래서 22:00~01:00 요청에 술집(17~24시)은 120분이 겹친다.
 */
export function overlapMinutes(window: MinuteRange, rule: SpotCategoryRule): number {
  const length = window.endMinute - window.startMinute;
  if (length <= 0) return 0;
  if (rule.openRanges === 'always') return length;

  let total = 0;
  for (const open of rule.openRanges) {
    for (const shift of [0, MINUTES_PER_DAY]) {
      const start = Math.max(window.startMinute, open.startMinute + shift);
      const end = Math.min(window.endMinute, open.endMinute + shift);
      if (end > start) total += end - start;
    }
  }
  return total;
}

/**
 * D11의 후보 규칙: 겹침이 기본 체류 시간 이상이어야 그 시간대의 후보다.
 *
 * "겹치면 후보"로 두면 13:59 종료 요청에 밥집이 1분 겹쳐 후보가 된다. 체류
 * 시간을 문턱으로 쓰면 "가서 머물 수 있는가"를 묻는 셈이 된다.
 */
export function fitsWindow(category: SpotCategory, window: MinuteRange): boolean {
  const rule = SPOT_CATEGORY_TABLE[category];
  return overlapMinutes(window, rule) >= rule.dwellMinutes;
}
