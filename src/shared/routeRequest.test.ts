import { describe, expect, it } from 'vitest';
import { isValidTimeWindow, timeWindowProblem } from './routeRequest';

describe('timeWindowProblem', () => {
  it('정상 시간대는 null', () => {
    expect(
      timeWindowProblem({ start: '2026-09-12T14:00:00+09:00', end: '2026-09-12T16:00:00+09:00' }),
    ).toBeNull();
  });

  it('오프셋이 없으면 unparseable', () => {
    expect(timeWindowProblem({ start: '2026-09-12T14:00', end: '2026-09-12T16:00:00+09:00' })).toBe(
      'unparseable',
    );
  });

  it('같은 시각 · 역순은 not_after_start', () => {
    expect(
      timeWindowProblem({ start: '2026-09-12T14:00:00+09:00', end: '2026-09-12T14:00:00+09:00' }),
    ).toBe('not_after_start');
    expect(
      timeWindowProblem({ start: '2026-09-12T16:00:00+09:00', end: '2026-09-12T14:00:00+09:00' }),
    ).toBe('not_after_start');
  });

  it('12시간을 넘으면 too_long, 정확히 12시간은 허용', () => {
    expect(
      timeWindowProblem({ start: '2026-09-12T08:00:00+09:00', end: '2026-09-12T20:00:00+09:00' }),
    ).toBeNull();
    expect(
      timeWindowProblem({ start: '2026-09-12T08:00:00+09:00', end: '2026-09-12T20:00:01+09:00' }),
    ).toBe('too_long');
  });

  it('자정을 넘는 시간대도 유효하다', () => {
    expect(
      isValidTimeWindow({ start: '2026-09-12T22:00:00+09:00', end: '2026-09-13T01:00:00+09:00' }),
    ).toBe(true);
  });
});
