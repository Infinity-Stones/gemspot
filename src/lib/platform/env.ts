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
 *
 * 전부 "없으면 `null`"이다. 던지지 않는 이유: 키 하나가 없어도 앱은 시드
 * 모드로 떠야 하고, 그 키가 없을 때 무엇이 맞는지(추정으로 대체 · 기능 숨김 ·
 * 오류 표시)는 그 키를 쓰는 도메인이 안다.
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
 * 값은 Vercel 환경 변수(또는 로컬 `.env.local`)에서 온다. 배포 프로젝트
 * `juhee200s-projects/gemspot`에 **이 이름으로** 등록되어 있다 — 코드가 다른
 * 이름을 보면 키가 있는데도 Geocoding이 전부 "키 없음"으로 떨어진다.
 * 짝이 되는 클라이언트 ID는 감출 수 없는 값이라 `src/shared/naverMap.ts`에
 * 상수로 있다.
 */
export function naverApiKey(): string | null {
  return readOptional('GEMSPOT_NAVER_API_KEY');
}

/**
 * TMAP 보행자 경로 앱 키 (M7 구간 실측 · T40).
 *
 * 없으면 구간 도보 시간을 직선거리로 추정한다(T41). 그래도 여기 이름을 올려
 * 두는 이유는 필요한 키의 목록이 한 화면에 있어야 한다는 것이다.
 */
export function tmapAppKey(): string | null {
  return readOptional('TMAP_APP_KEY');
}

/**
 * Gemini API 키 (D12 결정 · M7 요청 해석 · 순서 제안 · T35 · T38).
 * 없으면 동선 가이드가 문장을 해석할 수 없다(기능 비활성). 구조화된 요청을
 * 직접 주는 경로는 키 없이도 돈다.
 */
export function geminiApiKey(): string | null {
  return readOptional('GEMINI_API_KEY');
}

/**
 * Gemini 모델 이름. 코드에 박지 않는 이유는 모델이 주기적으로 은퇴하기
 * 때문이다 — 배포 설정만 바꿔 갈아탈 수 있어야 한다.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

export function geminiModel(): string {
  return readOptional('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
}

/**
 * Supabase 프로젝트 URL과 **시크릿** 키 — D06(#26)의 스팟 저장소.
 *
 * 시크릿 키는 RLS를 우회하므로 서버에서만 읽는다. `NEXT_PUBLIC_` 접두사가 붙은
 * publishable 키 경로는 두지 않는다 — 기본 1인 사용에 인증이 없어 브라우저가
 * 직접 붙을 이유가 없고, 붙는 순간 RLS 정책이 없는 테이블이 그대로 열린다.
 *
 * 키 이름을 둘 읽는 이유: 대시보드에서 발급하는 새 형식 키는 `sb_secret_…`이고
 * 관례상 SUPABASE_SECRET_KEY로 두지만, Vercel 마켓플레이스 연동은 변수 이름을
 * 고를 수 없이 SUPABASE_SERVICE_ROLE_KEY로 넣는다. 둘은 같은 권한의 키다.
 */
export function supabaseUrl(): string | null {
  return readOptional('SUPABASE_URL');
}

export function supabaseSecretKey(): string | null {
  return readOptional('SUPABASE_SECRET_KEY') ?? readOptional('SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * 네이버 **검색** Local API 키 — 가게 이름으로 업체를 찾는다(T52).
 *
 * Maps(Geocoding)와 **다른 서비스, 다른 콘솔, 다른 키**다. Maps는 네이버 클라우드
 * 플랫폼(NCP)에서, 이 둘은 developers.naver.com에서 발급한다. 한쪽 키를 다른 쪽에
 * 넣으면 401이 난다 — 이름을 `NAVER_SEARCH_*`로 못박아 둔 이유다.
 *
 * 둘 다 없으면 이름 검색이 비활성이고, 주소 검색 경로는 그대로 동작한다.
 */
export function naverSearchClientId(): string | null {
  return readOptional('NAVER_SEARCH_CLIENT_ID');
}

export function naverSearchClientSecret(): string | null {
  return readOptional('NAVER_SEARCH_CLIENT_SECRET');
}

/**
 * Vercel AI Gateway 키.
 *
 * 게이트웨이를 지나면 제공자 교체가 모델 이름 문자열 하나로 끝난다. 아직 쓰는
 * 코드는 없다 — LLM 어댑터(`llm.ts`)는 D12 결정대로 Gemini를 직접 부른다.
 * 게이트웨이로 옮기기로 하면 그 파일 하나만 바뀐다.
 */
export function aiGatewayApiKey(): string | null {
  return readOptional('AI_GATEWAY_API_KEY');
}
