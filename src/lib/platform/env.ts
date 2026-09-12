/**
 * 환경 변수 어댑터 — `process.env`를 읽는 유일한 곳.
 *
 * 여기 모아 두는 이유는 두 가지다. (1) 어떤 변수가 필요한지가 한 화면에
 * 보인다. 소스 전체에 흩뿌려진 `process.env.X`는 배포 직전에야 "이 변수도
 * 있었네"로 발견된다. (2) 빈 문자열·공백 같은 반쯤 설정된 값을 여기서 한 번만
 * `null`로 접는다 — 안 그러면 소비자마다 다르게 판단한다.
 *
 * **서버 전용이다.** 여기 있는 변수는 `NEXT_PUBLIC_` 접두사가 없으므로 클라이언트
 * 번들에서는 값이 비어 있다. 브라우저에 내보내야 하는 값이 생기면 접두사를
 * 붙이되, `process.env.NEXT_PUBLIC_X`를 **점 접근으로 직접** 써야 한다 —
 * Next의 빌드 타임 치환(DefinePlugin)은 대괄호 접근을 매치하지 못해서, 이
 * 모듈을 거치면 값이 사라진다.
 */

function readOptional(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 예시 API의 베이스 URL. 설정하지 않으면 `null`이고, 도메인 repository는 그때
 * 번들된 시드로 떨어진다 — 백엔드가 아직 없어도 앱이 뜨게 하기 위한 것이다.
 */
export function apiBaseUrl(): string | null {
  return readOptional('GEMSPOT_API_BASE_URL');
}

/**
 * 네이버 Geocoding 시크릿 키. 설정하지 않으면 `null`이고, 호출하는 쪽이
 * "키가 없다"를 실패로 다룬다 — 여기서 던지면 키 없이 띄워 보는 개발이 막힌다.
 *
 * 값은 Vercel 환경 변수(또는 로컬 `.env.local`)에서 온다. 짝이 되는 클라이언트
 * ID는 감출 수 없는 값이라 `src/shared/naverMap.ts`에 상수로 있다.
 */
export function naverApiKey(): string | null {
  return readOptional('GEMSPOT_NAVER_API_KEY');
}
