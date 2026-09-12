import { describe, expect, it } from 'vitest';
import { isValidSlug, UPLOAD_PATH, UPLOAD_RESULTS_PATH } from './routes';

describe('upload routes', () => {
  it('추출 결과를 긴 검토 작업에 맞는 독립 페이지로 둔다', () => {
    expect(UPLOAD_PATH).toBe('/upload');
    expect(UPLOAD_RESULTS_PATH).toBe('/upload/results');
  });
});

describe('isValidSlug', () => {
  it('소문자·숫자·단일 하이픈 조합을 통과시킨다', () => {
    expect(isValidSlug('gemspot')).toBe(true);
    expect(isValidSlug('layer-boundaries-101')).toBe(true);
  });

  it('경로를 벗어날 수 있는 형태를 거른다', () => {
    // 이 셋이 이 함수의 존재 이유다 — 그대로 붙이면 다른 경로로 튄다.
    expect(isValidSlug('..')).toBe(false);
    expect(isValidSlug('a/b')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });

  it('앞뒤·연속 하이픈을 거른다', () => {
    expect(isValidSlug('-lead')).toBe(false);
    expect(isValidSlug('trail-')).toBe(false);
    expect(isValidSlug('double--dash')).toBe(false);
  });

  it('대문자를 거른다 — 경로는 대소문자를 구분하므로 한 형태만 정본으로 둔다', () => {
    expect(isValidSlug('GemSpot')).toBe(false);
  });
});
