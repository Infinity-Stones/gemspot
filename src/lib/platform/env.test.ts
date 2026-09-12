import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl, naverApiKey } from './env';

/**
 * 환경 변수 리더는 "반쯤 설정된 값"을 한 곳에서 null로 접는 것이 존재 이유다.
 * 그 접힘이 새 리더에도 똑같이 적용되는지를 고정한다 — 리더를 하나 더 추가할
 * 때 `readOptional`을 거치지 않고 `process.env.X ?? null`로 쓰면 빈 문자열이
 * 그대로 통과하는데, 그 실수는 배포 뒤 키가 있는데 안 되는 형태로 나타난다.
 */
describe('env 리더', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['GEMSPOT_NAVER_API_KEY', naverApiKey],
    ['GEMSPOT_API_BASE_URL', apiBaseUrl],
  ])('%s: 미설정·빈 문자열·공백은 전부 null', (name, read) => {
    vi.stubEnv(name, undefined);
    expect(read()).toBeNull();

    vi.stubEnv(name, '');
    expect(read()).toBeNull();

    vi.stubEnv(name, '   ');
    expect(read()).toBeNull();
  });

  it.each([
    ['GEMSPOT_NAVER_API_KEY', naverApiKey],
    ['GEMSPOT_API_BASE_URL', apiBaseUrl],
  ])('%s: 값이 있으면 앞뒤 공백을 떼고 돌려준다', (name, read) => {
    vi.stubEnv(name, '  secret-value  ');
    expect(read()).toBe('secret-value');
  });
});
