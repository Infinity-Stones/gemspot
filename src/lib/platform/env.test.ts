import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEMINI_MODEL, geminiApiKey, geminiModel, naverApiKey, tmapAppKey } from './env';

/**
 * 환경 변수 리더는 "반쯤 설정된 값"을 한 곳에서 null로 접는 것이 존재 이유다.
 * 그 접힘이 모든 리더에 똑같이 적용되는지를 고정한다 — 리더를 하나 더 추가할
 * 때 `readOptional`을 거치지 않고 `process.env.X ?? null`로 쓰면 빈 문자열이
 * 그대로 통과하는데, 그 실수는 배포 뒤 키가 있는데 안 되는 형태로 나타난다.
 */
describe('env 리더', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['TMAP_APP_KEY', tmapAppKey],
    ['GEMINI_API_KEY', geminiApiKey],
  ])('%s: 미설정·빈 문자열·공백은 전부 null', (name, read) => {
    vi.stubEnv(name, undefined);
    expect(read()).toBeNull();
    vi.stubEnv(name, '');
    expect(read()).toBeNull();
    vi.stubEnv(name, '   ');
    expect(read()).toBeNull();
  });

  it('값이 있으면 앞뒤 공백을 떼고 돌려준다', () => {
    vi.stubEnv('TMAP_APP_KEY', '  key  ');
    expect(tmapAppKey()).toBe('key');
  });

  describe('naverApiKey — 배포 프로젝트마다 다른 이름을 둘 다 읽는다', () => {
    it('GEMSPOT_NAVER_API_KEY가 우선', () => {
      vi.stubEnv('GEMSPOT_NAVER_API_KEY', 'a');
      vi.stubEnv('SECRET_KEY', 'b');
      expect(naverApiKey()).toBe('a');
    });

    it('그 이름이 비어 있으면 SECRET_KEY로 떨어진다', () => {
      vi.stubEnv('GEMSPOT_NAVER_API_KEY', '');
      vi.stubEnv('SECRET_KEY', 'b');
      expect(naverApiKey()).toBe('b');
    });

    it('둘 다 없으면 null', () => {
      vi.stubEnv('GEMSPOT_NAVER_API_KEY', undefined);
      vi.stubEnv('SECRET_KEY', undefined);
      expect(naverApiKey()).toBeNull();
    });
  });

  it('geminiModel은 비어 있으면 기본값, 있으면 그 값', () => {
    vi.stubEnv('GEMINI_MODEL', '');
    expect(geminiModel()).toBe(DEFAULT_GEMINI_MODEL);
    vi.stubEnv('GEMINI_MODEL', 'gemini-x');
    expect(geminiModel()).toBe('gemini-x');
  });
});
