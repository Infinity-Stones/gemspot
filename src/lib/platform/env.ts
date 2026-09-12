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
 * 네이버 Geocoding 시크릿 키. 설정하지 않으면 `null`이고, 호출하는 쪽이
 * "키가 없다"를 실패로 다룬다 — 여기서 던지면 키 없이 띄워 보는 개발이 막힌다.
 *
 * 값은 Vercel 환경 변수(또는 로컬 `.env.local`)에서 온다. 짝이 되는 클라이언트
 * ID는 감출 수 없는 값이라 `src/shared/naverMap.ts`에 상수로 있다.
 *
 * 읽는 이름이 `SECRET_KEY`인 것은 **버셀에 그 이름으로 등록되어 있기 때문이다.**
 * 코드가 `GEMSPOT_NAVER_API_KEY`를 보는 동안 배포 환경에서는 이 함수가 늘
 * `null`이었다 — 키가 있는데도 Geocoding이 전부 "키 없음"으로 떨어진다.
 */
export function naverApiKey(): string | null {
  return readOptional('SECRET_KEY');
}

/**
 * TMAP 보행자 경로 앱 키 (M7 구간 실측 · T40).
 *
 * 아직 발급되지 않아 지금은 늘 `null`이다. 그래도 여기 이름을 올려 두는 이유는
 * 필요한 키의 목록이 한 화면에 있어야 한다는 것이다 — 쓰는 코드가 생길 때
 * `process.env`를 새로 찾아 뒤지면 그때 또 흩어진다.
 */
export function tmapAppKey(): string | null {
  return readOptional('TMAP_APP_KEY');
}

/**
 * Vercel AI Gateway 키 (M7 요청 해석 · 순서 제안 · T35 · T38).
 *
 * 게이트웨이를 지나면 제공자 교체가 모델 이름 문자열 하나로 끝난다. 명세가
 * "어댑터 한 파일에서만 바뀐다"고 못 박은 조건에 그 경로가 가장 가깝다.
 * 아직 발급되지 않아 지금은 늘 `null`이다.
 */
export function aiGatewayApiKey(): string | null {
  return readOptional('AI_GATEWAY_API_KEY');
}
