import { describe, expect, it } from 'vitest';
import {
  BROWSER_OWNER_COOKIE,
  browserOwnerCookieOptions,
  isBrowserOwnerId,
  replaceBrowserOwnerCookieHeader,
  resolveBrowserOwnerId,
} from './browserOwner';

const OWNER_ID = '5f6d1c2e-0000-4000-8000-000000000001';
const NEXT_OWNER_ID = '5f6d1c2e-0000-4000-8000-000000000002';

describe('브라우저 소유자 ID', () => {
  it('유효한 기존 UUID v4는 그대로 재사용한다', () => {
    expect(resolveBrowserOwnerId(OWNER_ID, () => NEXT_OWNER_ID)).toEqual({
      ownerId: OWNER_ID,
      shouldSetCookie: false,
    });
  });

  it.each([
    undefined,
    null,
    '',
    'not-a-uuid',
    '5f6d1c2e-0000-1000-8000-000000000001',
  ])('누락되거나 변조된 값(%s)은 새 UUID로 교체한다', value => {
    expect(resolveBrowserOwnerId(value, () => NEXT_OWNER_ID)).toEqual({
      ownerId: NEXT_OWNER_ID,
      shouldSetCookie: true,
    });
  });

  it('생성기까지 잘못된 값을 주면 요청마다 다른 사용자가 되지 않도록 실패한다', () => {
    expect(() => resolveBrowserOwnerId(undefined, () => 'broken')).toThrow(
      'UUID v4',
    );
  });

  it('UUID v4만 소유자 ID로 인정한다', () => {
    expect(isBrowserOwnerId(OWNER_ID)).toBe(true);
    expect(isBrowserOwnerId('5f6d1c2e-0000-4000-7000-000000000001')).toBe(
      false,
    );
  });
});

describe('브라우저 소유자 쿠키', () => {
  it('개발 환경에서도 HttpOnly · SameSite · Path · 수명을 고정한다', () => {
    expect(browserOwnerCookieOptions(false)).toEqual({
      httpOnly: true,
      maxAge: 31_536_000,
      path: '/',
      sameSite: 'lax',
      secure: false,
    });
  });

  it('운영 환경에서는 Secure를 켠다', () => {
    expect(browserOwnerCookieOptions(true).secure).toBe(true);
  });

  it('전달용 헤더에서 변조된 기존 값만 교체하고 다른 쿠키는 보존한다', () => {
    expect(
      replaceBrowserOwnerCookieHeader(
        `theme=dark; ${BROWSER_OWNER_COOKIE}=broken`,
        OWNER_ID,
      ),
    ).toBe(`theme=dark; ${BROWSER_OWNER_COOKIE}=${OWNER_ID}`);
  });
});
