import type { SpotCategory } from './spot';
import { SPOT_CATEGORIES } from './spot';

/**
 * 카테고리별 적합 시간대 표와 기본 체류 시간 — D11(#43)의 결정을 코드로.
 *
 * 카테고리 목록 자체는 `spot.ts`의 `SPOT_CATEGORIES`가 단일 소스다. 이 표는
 * 그 목록의 **모든 행**을 가져야 한다 — `Record<SpotCategory, …>`가 그것을
 * 타입으로 강제하므로, 목록에 값이 늘면 여기서 컴파일이 깨진다.
 *
 * 동선 가이드는 "14~16시면 식사는 빠지고 카페 · 오락만 후보"처럼
 * 이 표로 후보를 거른다. 행 집합은 D07(#27)이 고정했고 값은 D11(#43)에서
 * 왔다 — 바꾸는 곳은 이 파일 하나다.
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
  meal: {
    label: '식사',
    // 점심 · 저녁 두 시간대. 14~16시 요청에는 어느 쪽과도 겹치지 않는다.
    openRanges: [range(11, 30, 14), range(17, 30, 21)],
    dwellMinutes: 60,
  },
  cafe: { label: '카페', openRanges: [range(9, 0, 21)], dwellMinutes: 40 },
  // 상영 약 2시간에 입퇴장을 더한 값이다. 체류가 문턱이므로(아래 fitsWindow)
  // 두 시간짜리 요청에는 영화가 후보로 서지 않는다 — 넣어 봐야 끝까지 못 본다.
  movie: { label: '영화', openRanges: [range(10, 0, 24)], dwellMinutes: 150 },
  // 노래방 · 게임장 · 방탈출. 문 여는 시각이 제각각이라 좁게 잡으면 저녁
  // 요청에서 통째로 빠진다.
  amusement: { label: '오락', openRanges: [range(10, 0, 24)], dwellMinutes: 90 },
  // 새벽 운동과 야간 경기를 모두 담아야 해서 양끝이 넓다.
  sports: { label: '스포츠', openRanges: [range(6, 0, 23)], dwellMinutes: 90 },
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
 * 한 번 더 겹친다. 그래서 22:00~01:00 요청에 영화(10~24시)는 120분이 겹친다.
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
 * "겹치면 후보"로 두면 13:59 종료 요청에 식사가 1분 겹쳐 후보가 된다. 체류
 * 시간을 문턱으로 쓰면 "가서 머물 수 있는가"를 묻는 셈이 된다.
 */
export function fitsWindow(category: SpotCategory, window: MinuteRange): boolean {
  const rule = SPOT_CATEGORY_TABLE[category];
  return overlapMinutes(window, rule) >= rule.dwellMinutes;
}
