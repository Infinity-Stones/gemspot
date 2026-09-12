/**
 * 로그인 대신 브라우저를 구분하는 프로토타입용 쿠키 계약.
 *
 * 이 값은 인증 증명이 아니다. 쿠키를 복사하면 같은 사용자의 데이터로 접근할 수
 * 있으므로 민감한 정보에는 쓸 수 없다. Gemspot에서는 스팟 행을 브라우저별로
 * 가르는 불투명한 키로만 쓴다.
 */
export const BROWSER_OWNER_COOKIE = 'gemspot_owner_id';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BrowserOwnerCookieOptions {
  readonly httpOnly: true;
  readonly maxAge: number;
  readonly path: '/';
  readonly sameSite: 'lax';
  readonly secure: boolean;
}

export interface BrowserOwnerResolution {
  readonly ownerId: string;
  readonly shouldSetCookie: boolean;
}

export function isBrowserOwnerId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}

/** 기존 값이 없거나 변조됐으면 새 UUID로 교체한다. */
export function resolveBrowserOwnerId(
  currentValue: unknown,
  createId: () => string = () => crypto.randomUUID(),
): BrowserOwnerResolution {
  if (isBrowserOwnerId(currentValue)) {
    return { ownerId: currentValue, shouldSetCookie: false };
  }

  const ownerId = createId();
  if (!isBrowserOwnerId(ownerId)) {
    throw new Error(
      '브라우저 소유자 생성기가 UUID v4가 아닌 값을 반환했습니다.',
    );
  }
  return { ownerId, shouldSetCookie: true };
}

export function browserOwnerCookieOptions(
  secure: boolean,
): BrowserOwnerCookieOptions {
  return {
    httpOnly: true,
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure,
  };
}

/** 첫 요청에서도 서버 컴포넌트가 새 쿠키를 읽도록 전달용 Cookie 헤더를 만든다. */
export function replaceBrowserOwnerCookieHeader(
  rawHeader: string | null,
  ownerId: string,
): string {
  if (!isBrowserOwnerId(ownerId)) {
    throw new Error('브라우저 소유자 ID는 UUID v4여야 합니다.');
  }

  const kept = (rawHeader ?? '')
    .split(';')
    .map(part => part.trim())
    .filter(
      part => part.length > 0 && !part.startsWith(`${BROWSER_OWNER_COOKIE}=`),
    );
  kept.push(`${BROWSER_OWNER_COOKIE}=${ownerId}`);
  return kept.join('; ');
}
