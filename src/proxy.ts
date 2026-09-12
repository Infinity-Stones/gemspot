import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BROWSER_OWNER_COOKIE,
  browserOwnerCookieOptions,
  replaceBrowserOwnerCookieHeader,
  resolveBrowserOwnerId,
} from '@/shared/browserOwner';

/**
 * 모든 앱 요청에 브라우저별 소유자 ID를 보장한다(#122).
 *
 * 응답 쿠키뿐 아니라 전달되는 요청 헤더에도 같은 값을 넣는다. 그래야 쿠키가
 * 없던 첫 요청의 서버 컴포넌트·서버 액션도 즉시 같은 ownerId를 읽는다.
 */
export function proxy(request: NextRequest): NextResponse {
  const resolution = resolveBrowserOwnerId(
    request.cookies.get(BROWSER_OWNER_COOKIE)?.value,
  );
  if (!resolution.shouldSetCookie) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    'cookie',
    replaceBrowserOwnerCookieHeader(
      request.headers.get('cookie'),
      resolution.ownerId,
    ),
  );
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(
    BROWSER_OWNER_COOKIE,
    resolution.ownerId,
    browserOwnerCookieOptions(process.env.NODE_ENV === 'production'),
  );
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
