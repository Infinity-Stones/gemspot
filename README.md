# gemspot

레이어 경계와 디자인 토큰을 **컨벤션이 아니라 lint로** 강제하는 Next.js 스캐폴드.

경계를 어기면 `pnpm lint`에서 막히고, 토큰 밖의 색을 쓰면 Panda 빌드에서 막힌다.
문서에만 적힌 규칙은 6개월 뒤에 지켜지지 않는다는 전제로 만들어져 있다.

## 요구 사항

`.tool-versions`가 버전을 고정한다 (asdf/mise 사용 시 자동).

- Node.js 24.20.0+
- pnpm 12.3.1

## 시작

```bash
pnpm install   # prepare 훅이 panda codegen까지 돌린다
pnpm dev       # http://localhost:3000
```

`styled-system/`(Panda 생성 트리)은 커밋하지 않는다. clone 직후엔 없고
`pnpm install`이 만든다 — 없으면 타입 검사가 `styled-system/css`를 못 찾는다.

## 모델 호출 설정

이미지에서 가게를 읽는 기능과 자연어 동선 가이드는 OpenAI 호환 Chat Completions
API를 사용한다. `.env` 또는 `.env.local`에 다음 서버 환경 변수를 설정한다.

```dotenv
OPENAI_BASE_URL=https://provider.example/v1
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=your-vision-model
```

`OPENAI_BASE_URL`은 `/chat/completions` 앞까지의 주소다. 필요한 버전 경로(예: `/v1`)도
포함한다. 호출 주소는 `<OPENAI_BASE_URL>/chat/completions`이며, 키는 Bearer 인증으로
전달한다. 이미지는 base64 data URL로 기존 프롬프트와 함께 전송한다.
모델은 이미지 입력과 `response_format: json_schema`를 지원해야 한다.
이 형식은 [공식 이미지 입력 문서](https://developers.openai.com/api/docs/guides/images-vision)와
[구조화 응답 문서](https://developers.openai.com/api/docs/guides/structured-outputs)를 따른다.
이미지 추출 결과의 카테고리는 프로젝트 고정 코드인 `meal`, `cafe`, `movie`,
`amusement`, `sports`, `other` 중 하나로 제안되며, 사용자가 저장 전에 수정할 수 있다.

기존 `GEMINI_API_KEY`와 `GEMINI_MODEL`은 더 이상 사용하지 않는다.
세 값을 모두 설정한 뒤 서버를 재시작한다. 키가 없으면 기존 키 누락 오류로,
주소·모델이 없거나 주소 형식이 잘못되면 설정 오류로 처리하며 외부 요청은 보내지 않는다.
비밀 키를 저장소에 커밋하거나 `NEXT_PUBLIC_` 접두사로 공개하지 않는다.

## 스크립트

| 명령                 | 하는 일                                                         |
| -------------------- | --------------------------------------------------------------- |
| `pnpm dev`           | 개발 서버                                                       |
| `pnpm build`         | 프로덕션 빌드                                                   |
| `pnpm lint`          | ESLint (`--max-warnings=0` — 경고도 실패다)                     |
| `pnpm check-types`   | `next typegen` + 프로덕션·테스트 두 tsconfig 프로그램 타입 검사 |
| `pnpm test`          | vitest (node·jsdom 두 프로젝트)                                 |
| `pnpm test:coverage` | 커버리지                                                        |
| `pnpm format`        | prettier                                                        |

## 아키텍처

`src/` 안의 형제 폴더가 곧 레이어다. 각 레이어는 **자기보다 아래만** import한다.

```
src/app · components · hooks    화면. domain 배럴과 shared만 연다
        ↓
src/domain/<x>                  도메인 규칙. index.ts 배럴로만 공개
        ↓
src/lib/platform                바깥 세계 어댑터(HTTP·환경 변수)
        ↓
src/shared                      순수 계약. 아무것도 import하지 않는다
```

등록된 도메인은 셋이다.

| 도메인              | 가진 것                                          |
| ------------------- | ------------------------------------------------ |
| `domain/extraction` | 이미지에서 가게명·주소 후보를 뽑는다 (STEP 2)    |
| `domain/spot`       | 주소를 좌표로 바꿔 저장하고 조회한다 (STEP 4·M6) |
| `domain/route`      | 저장된 스팟으로 동선을 짠다 (M7)                 |

셋은 서로를 모른다. 도메인 둘이 함께 필요한 일(동선을 짜려면 스팟을 읽어야
한다)은 조립을 **위 레이어로 올려서** 푼다 — 유스케이스가 spot 배럴에서 읽어
route에 넘긴다. 도메인끼리 여는 것이 정답이었던 적은 아직 없다.

### 이 배치의 핵심

**app이 platform을 직접 열 수 없다.** 데이터 접근이 전부 도메인을 지나므로,
화면이 인프라 모양(HTTP 응답 형태, 환경 변수 이름)에 물들지 않는다. API가
필드 이름을 바꿔도 고칠 곳은 `repository.ts` 한 파일이다.

**도메인끼리도 서로를 모른다.** `eslint.config.mts`의 `boundaries/elements`에
도메인을 하나씩 나열하는 이유가 그것이다 — `src/domain/*` 한 패턴으로 뭉치면
같은 element type이 되어 도메인 간 import가 자유로워진다.

### 강제 장치

| 규칙                                    | 도구                                        |
| --------------------------------------- | ------------------------------------------- |
| import 방향 (레이어 순서)               | `eslint-plugin-boundaries`                  |
| repository 직접 접근 금지 (배럴 강제)   | `no-restricted-imports`                     |
| shared의 재수출·부수효과·`.tsx` 금지    | `no-restricted-syntax`                      |
| 도메인 배럴의 모듈 최상위 부수효과 금지 | `no-restricted-syntax`                      |
| 토큰 밖의 값                            | Panda `strictTokens`                        |
| 토큰 밖의 **색** (`[#hex]` 이스케이프)  | `no-restricted-syntax` (NO_ESCAPED_HEX)     |
| 인라인 `eslint-disable`                 | `noInlineConfig` + `eslint-comments/no-use` |

마지막 줄이 중요하다. **룰을 끄는 결정은 `eslint.config.mts`에서만 한다.**
소스에 흩어진 한 줄짜리 인가는 리뷰에서 diff 한 줄로 지나가고, 한 번 붙으면
근거가 유효한지 아무도 다시 묻지 않는다.

### 새 도메인을 추가하려면

1. `src/domain/<이름>/` 을 만들고 `index.ts` 배럴을 둔다.
2. `eslint.config.mts`의 `boundaries/elements`에 한 줄
   (`{ type: '<이름>', pattern: 'src/domain/<이름>' }`) — **`layer-root`보다 앞에**.
3. 같은 파일 `policies`에 한 줄
   (`{ from: { element: { type: '<이름>' } }, allow: DOMAIN_OPENS }`).
   허용이 셋과 달라야 할 때만 `DOMAIN_OPENS` 대신 인라인으로 적고, 근거를
   주석에 남긴다.
4. app 레이어의 `allow`에 그 type을 추가한다.

## 스타일

Panda CSS. 시각 기준은 `DESIGN.md`의 Jitter 레퍼런스다. 오프화이트 지면과
흰 카드, 굵고 촘촘한 제목, 캡슐형 버튼, 넓고 부드러운 그림자를 따른다.

`panda.config.ts`는 공식 프리셋을 바탕으로 문서에 지정된 `design.*` 색상,
20/26/40/50px 모서리, 1200px 지면 폭, 타이포 스케일과 그림자를 더한다. 컴포넌트에서는
`ui.canvas`, `ui.surface`, `ui.ink`, `ui.subtle`, `ui.accent` 같은 시맨틱 토큰을 쓴다.
라이트/다크 짝은 `semanticTokens`에서 관리한다. 색상을 소스에 직접 쓰거나
이스케이프로 우회하지 않는다.

```ts
const card = css({
  bg: 'ui.surface',
  color: 'ui.ink',
  rounded: 'panel',
  boxShadow: 'card',
});
```

주요 버튼은 `ui.action`과 `ui.onAction`으로 대비를 확보한다. 플로팅 메뉴의
열기·업로드 버튼은 `ui.floatingAction`의 연보라색과 `ui.onFloatingAction`의
짙은 글자를 사용한다. 나머지 세부 버튼은 `ui.surface/80`의 반투명 배경을 쓴다.
제목은 Inter Tight, 본문은 Inter를 사용한다.
라이선스와 Latin 가변 폰트를 `src/app/fonts/`에 보관하고 `next/font/local`로
제공한다. 한글은 Apple SD Gothic Neo·Malgun Gothic 등 시스템 글꼴로 표시한다.
지도와 업로드 이미지가 앱의 주요 시각 자료이므로 레퍼런스의 마케팅용 3D 장식,
푸터, 영문 예시 문구는 가져오지 않는다. `WorkflowPage`는 입력 화면의 설명과
폼을 데스크톱에서 나란히, 모바일에서 세로로 배치한다. 업로드 화면은
`layout="stacked"`로 모든 화면 크기에서 설명 아래에 업로드 영역을 배치한다.

상단바 대신 각 화면의 소개 영역에 `BrandLink`를 둔다. `FloatingNavigation`은
공통 레이아웃에서 한 번 렌더링하고, 스크롤과 관계없이 화면 하단에서 24px과
안전 영역만큼 띄워 표시한다. 버튼을 누르면 동선 만들기·
업로드·핀 찍기·테마 전환이 펼쳐지고, 다시 누르거나 바깥 클릭·Escape로 접힌다.
모바일 검색·저장 바의 오른쪽은 메뉴 공간으로 비워 서로 겹치지 않게 한다.

테마는 `<html data-theme>`으로 전환한다. 첫 페인트 **전에** 도는 인라인 스크립트
(`src/app/theme-script.ts`)가 localStorage → 시스템 설정 순으로 값을 정하므로
FOUC가 없다. `useTheme`는 그 DOM 속성을 `useSyncExternalStore`로 구독한다 —
DOM이 단일 진실이고 React state는 사본이다.

## 테스트

vitest 하나로 돌리되 **환경**만 둘로 나눈다.

- `node` — `src/{shared,lib,domain}`의 순수 로직. jsdom을 띄우지 않는다.
- `jsdom` — 나머지 `src`(app 레이어)의 컴포넌트·훅. RTL이 여기에만 붙는다.

`vitest.config.mts`의 include, `tsconfig.test.json`의 include, `eslint.config.mts`의
테스트 블록 셋이 대칭이다 — **한쪽을 고치면 셋을 함께 고쳐야 한다.**

## 환경 변수

`.env.example`을 `.env.local`로 복사해 값을 채운다. `src/lib/platform/env.ts`가
`process.env`를 읽는 **유일한 곳**이다 — 소스 전체에 흩뿌려진 `process.env.X`는
배포 직전에야 "이 변수도 있었네"로 발견된다.

| 키                                     | 쓰는 곳                                    | 지금 값이 있나 |
| -------------------------------------- | ------------------------------------------ | -------------- |
| `GEMSPOT_NAVER_API_KEY`                | 네이버 Geocoding (M4 · M7 출발점)          | 있다           |
| `SUPABASE_URL` · `SUPABASE_SECRET_KEY` | 브라우저별 스팟 저장소 (M4 · M6 · M7 후보) | 아직 없다      |
| `KAKAO_REST_API_KEY`                   | 카카오 상호명·주소 검색 (M4 · T52)         | 환경별 설정    |
| `TMAP_APP_KEY`                         | 보행자 경로 실측 (M7)                      | 아직 없다      |
| `AI_GATEWAY_API_KEY`                   | 요청 해석 · 순서 제안 (M7)                 | 아직 없다      |

**키가 없으면 던지지 않고 `null`을 돌려준다.** 실패로 볼지는 부르는 쪽이 정한다 —
기동을 막으면 키 없이 화면을 띄워 보는 개발이 막히고, 그 비용을 지금 치를 이유가
없다. 대신 키를 쓰는 어댑터가 "키 없음"을 조용히 넘기지 않고 드러내야 한다.

브라우저로 나가는 값은 환경 변수로 두지 않는다. 네이버 지도 클라이언트 ID처럼
어차피 요청 URL에 실려 감출 수 없는 값은 `src/shared/`의 상수로 둔다 — 감춰지지도
않는 값에 팀원마다 `.env.local`을 만드는 비용을 치를 이유가 없다.

### 상호명으로 핀 찍기

`/spots/new`에서 상호명(예: `성수 블루보틀`)을 검색하고 결과 중 한 곳을 고른다.
선택한 가게의 이름과 주소가 자동으로 채워지고, 주소를 Geocoding으로 확인한 핀을
미리 보여 준다. **이 위치로 저장**을 누르면 서버에서 좌표를 다시 확인해 저장하고
홈 지도에서 해당 핀을 연다. 주소를 수정하면 위치를 다시 확인해야 저장할 수 있다.

검색은 [카카오 Local 키워드 검색](https://developers.kakao.com/docs/ko/local/dev-guide#search-by-keyword)의
`GET /v2/local/search/keyword.json`을 사용한다. 상호명·지역·지점명으로 검색하며
첫 페이지의 최대 15곳을 표시한다. 찾는 곳이 없으면 지역·지점명을 더해 검색하거나
주소를 직접 입력한다. 도로명이 있으면 도로명, 없으면 지번을 사용한다.

설정 방법:

1. [Kakao Developers](https://developers.kakao.com/)에서 앱을 만들고
   **카카오맵 → 사용 설정 → 상태 ON**으로 활성화한다.
2. 앱의 **REST API 키**를 `.env.local`에 `KAKAO_REST_API_KEY=...`로 설정한다.
   JavaScript 키가 아니며, REST API 키는 브라우저에 공개하지 않는다.
3. 개발 서버를 재시작한다. 배포 환경에도 같은 변수를 설정한다.

키 미설정과 검색 결과 0건은 서로 다르게 안내한다. 401·403 응답은 REST API 키와
[카카오맵 활성화 설정](https://developers.kakao.com/docs/ko/kakaomap/common)을 확인한다.
기존 `NAVER_SEARCH_CLIENT_ID` · `NAVER_SEARCH_CLIENT_SECRET`은 더 이상 사용하지 않는다.

지도 표시와 선택한 주소의 좌표 확인은 기존 네이버 Maps·Geocoding을 사용한다.
`GEMSPOT_NAVER_API_KEY`는 계속 필요하다. 화면은 spot 도메인의 공개 API만 호출하며,
외부 API 인증·응답 파싱은 platform 어댑터에서 처리한다.

## 에이전트

저장소 규약(검증 명령·커밋 규칙·경계를 다룰 때의 판단 기준)은 `CLAUDE.md`에 있다.
`.claude/skills/`에는 세 스킬이 있고, 전부 **사람이 명시적으로 부를 때만** 동작한다.

| 스킬         | 하는 일                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| `/add-issue` | 확인된 버그·결정이 끝난 작업을 GitHub 이슈로 기록한다 (구현은 하지 않는다) |
| `/write-prd` | 기능 아이디어를 결정 원장으로 훑어 빈칸 없는 PRD 이슈로 만든다             |
| `/repair-pr` | 머지 충돌 → 봇 리뷰 스레드 → CI 실패 순으로 PR을 한 번에 복구한다          |
