/**
 * 서울 시각 계산의 단일 소스.
 *
 * 동선 가이드는 "14:00 출발 → 14:08 도착"처럼 시각을 더하고 뺀다. 그 계산이
 * 서버(UTC 머신)와 브라우저(사용자 로컬)에서 다르게 나오면 같은 여정이 사람마다
 * 다른 시각으로 보인다. 그래서 타임존을 **Asia/Seoul 하나로 고정**하고, `Intl`
 * 없이 오프셋 상수만으로 계산한다 — 오프셋이 없는 문자열은 받지 않는다.
 *
 * 값은 전부 ISO 8601 문자열로 다닌다. `Date` 객체는 서버 액션의 직렬화 경계를
 * 넘을 때 문자열이 되므로, 애초에 문자열로 두면 경계 양쪽 코드가 같다.
 */

export const SEOUL_OFFSET_MINUTES = 540;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1_440;

/** 오프셋(Z 또는 ±hh:mm)이 붙은 ISO 8601만 통과시킨다. */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * ISO 문자열을 epoch ms로. 오프셋이 없거나 파싱이 안 되면 `null`.
 *
 * 오프셋 없는 `2026-09-12T14:00`은 `Date.parse`가 머신 로컬로 해석해 서버와
 * 브라우저에서 다른 순간이 된다. 그 문자열은 계약 위반으로 본다.
 */
export function parseIso(iso: string): number | null {
  if (!ISO_WITH_OFFSET.test(iso)) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function pad2(n: number): string {
  return n < 10 ? `0${String(n)}` : String(n);
}

/** epoch ms를 서울 오프셋이 붙은 ISO(초 단위)로. */
export function formatSeoulIso(epochMs: number): string {
  const local = new Date(epochMs + SEOUL_OFFSET_MINUTES * MS_PER_MINUTE);
  const y = local.getUTCFullYear();
  const mo = pad2(local.getUTCMonth() + 1);
  const d = pad2(local.getUTCDate());
  const h = pad2(local.getUTCHours());
  const mi = pad2(local.getUTCMinutes());
  const s = pad2(local.getUTCSeconds());
  return `${String(y)}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
}

/**
 * ISO 시각에 초를 더한 ISO. 입력이 계약 밖이면 던진다 — 여기까지 온 문자열은
 * 이미 `parseIso`로 검증된 값이어야 하고, 아니라면 조립 실수다.
 */
export function addSeconds(iso: string, seconds: number): string {
  const ms = parseIso(iso);
  if (ms === null) {
    throw new Error(`오프셋이 있는 ISO 8601이 아닙니다: ${JSON.stringify(iso)}`);
  }
  return formatSeoulIso(ms + seconds * 1_000);
}

/** 두 ISO 시각의 차(초). `b - a`. */
export function diffSeconds(a: string, b: string): number {
  const ma = parseIso(a);
  const mb = parseIso(b);
  if (ma === null || mb === null) {
    throw new Error('오프셋이 있는 ISO 8601이 아닙니다');
  }
  return Math.round((mb - ma) / 1_000);
}

/**
 * 서울 기준 그 날 0시부터 지난 분(0~1439). 카테고리 적합 시간대(하루 안의
 * 분 범위)와 비교하는 데 쓴다.
 */
export function minutesOfSeoulDay(iso: string): number {
  const ms = parseIso(iso);
  if (ms === null) {
    throw new Error(`오프셋이 있는 ISO 8601이 아닙니다: ${JSON.stringify(iso)}`);
  }
  const localMinutes = Math.floor(ms / MS_PER_MINUTE) + SEOUL_OFFSET_MINUTES;
  return ((localMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** 서울 기준 `HH:mm`. 화면 표시용. */
export function formatSeoulHourMinute(iso: string): string {
  const m = minutesOfSeoulDay(iso);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
