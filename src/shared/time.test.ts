import { describe, expect, it } from 'vitest';
import {
  addSeconds,
  diffSeconds,
  formatSeoulHourMinute,
  formatSeoulIso,
  minutesOfSeoulDay,
  parseIso,
} from './time';

describe('parseIso', () => {
  it('오프셋이 붙은 ISO만 받는다', () => {
    expect(parseIso('2026-09-12T14:00:00+09:00')).toBe(Date.UTC(2026, 8, 12, 5, 0, 0));
    expect(parseIso('2026-09-12T05:00:00Z')).toBe(Date.UTC(2026, 8, 12, 5, 0, 0));
    expect(parseIso('2026-09-12T14:00')).toBeNull();
    expect(parseIso('2026-09-12T14:00:00')).toBeNull();
    expect(parseIso('내일 2시')).toBeNull();
  });
});

describe('formatSeoulIso · addSeconds · diffSeconds', () => {
  it('UTC 순간을 서울 오프셋으로 쓴다', () => {
    expect(formatSeoulIso(Date.UTC(2026, 8, 12, 5, 0, 0))).toBe('2026-09-12T14:00:00+09:00');
  });

  it('명세 예시: 14:00에 8분 이동 → 14:08, 거기서 20분 체류 → 14:28', () => {
    const depart = '2026-09-12T14:00:00+09:00';
    const arrive = addSeconds(depart, 8 * 60);
    expect(arrive).toBe('2026-09-12T14:08:00+09:00');
    expect(addSeconds(arrive, 20 * 60)).toBe('2026-09-12T14:28:00+09:00');
    expect(diffSeconds(depart, arrive)).toBe(480);
  });

  it('자정을 넘겨도 날짜가 따라간다', () => {
    expect(addSeconds('2026-09-12T23:50:00+09:00', 20 * 60)).toBe('2026-09-13T00:10:00+09:00');
  });

  it('입력이 계약 밖이면 던진다 — 조립 실수를 조용히 넘기지 않는다', () => {
    expect(() => addSeconds('2026-09-12T14:00', 1)).toThrow();
  });
});

describe('minutesOfSeoulDay · formatSeoulHourMinute', () => {
  it('서울 기준 0시부터의 분', () => {
    expect(minutesOfSeoulDay('2026-09-12T14:30:00+09:00')).toBe(14 * 60 + 30);
    // UTC 자정은 서울 09:00
    expect(minutesOfSeoulDay('2026-09-12T00:00:00Z')).toBe(9 * 60);
    expect(formatSeoulHourMinute('2026-09-12T05:08:00Z')).toBe('14:08');
  });
});
