import { cookies } from 'next/headers';
import { BROWSER_OWNER_COOKIE, isBrowserOwnerId } from '@/shared/browserOwner';

/**
 * Proxy가 현재 요청에 심은 소유자 ID를 읽는다. 누락은 새 사용자가 아니라 구성
 * 오류다 — 여기서 UUID만 만들면 응답 쿠키에 기록되지 않아 요청마다 사용자가
 * 달라진다.
 */
export async function readBrowserOwnerId(): Promise<string> {
  const value = (await cookies()).get(BROWSER_OWNER_COOKIE)?.value;
  if (!isBrowserOwnerId(value)) {
    throw new Error(
      '브라우저 소유자 쿠키가 요청에 없습니다. proxy 구성을 확인해 주세요.',
    );
  }
  return value;
}
