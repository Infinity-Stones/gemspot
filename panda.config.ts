import { defineConfig } from '@pandacss/dev';

/**
 * Panda CSS 구성.
 *
 * 토큰은 **직접 만들지 않는다** — 공식 프리셋(`@pandacss/dev/presets`,
 * 즉 `@pandacss/preset-panda`) 하나가 팔레트·타이포·radii·spacing을 전부
 * 들고 있고, 이 파일은 파이프라인만 다룬다(무엇을 스캔하고, 어디로 생성하고,
 * 어떤 값을 금지하는가).
 *
 * 그 프리셋에는 시맨틱 층이 없다. 그래서 라이트/다크 짝은 컴포넌트가
 * `_dark` 조건으로 직접 든다 — 역할 이름(`bg.canvas`) 대신 팔레트 이름
 * (`slate.50` / `slate.950`)이 화면 코드에 그대로 나온다.
 *
 * `outdir`(styled-system/)은 커밋하지 않는다. `pnpm install`의 prepare 훅이
 * `panda codegen`을 돌려 만들고, tsconfig의 `styled-system/*` path와
 * .gitignore가 그 전제를 함께 잡고 있다.
 *
 * `pnpm build`도 codegen을 앞에 한 번 더 돈다. Vercel처럼 node_modules를
 * 캐시에서 복원하는 환경에서는 pnpm이 "Already up to date"로 설치를 통째로
 * 건너뛰고, 그러면 prepare 훅도 돌지 않아 이 트리가 없는 채로 빌드가 시작된다.
 */
export default defineConfig({
  presets: ['@pandacss/dev/presets'],

  // reset CSS를 함께 내보낸다. 브라우저 기본 스타일은 요소마다 제각각이라,
  // 이걸 끄면 토큰으로 맞춘 간격이 요소별로 어긋난다.
  preflight: true,

  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  exclude: [],

  // 디자인 토큰 강제: 임의 색·값 대신 프리셋 토큰만 허용한다. 임의값이 꼭
  // 필요하면 대괄호 이스케이프(`'[6px]'`)로 **명시적으로** 표기해야 한다 —
  // "여긴 의도적으로 토큰을 벗어난다"가 diff에 남는다.
  //
  // 색에는 그 탈출구조차 막아 뒀다(eslint의 NO_ESCAPED_HEX). 이스케이프로 박은
  // 색은 라이트/다크 한쪽에서만 맞는 값이 되고, 그건 lint가 아니라 화면을
  // 보고서야 발견된다.
  strictTokens: true,
  // 열거형 속성(display, position 등)도 CSS 표준 값만 받는다. 오타
  // (`postion: 'realtive'`)가 조용히 무시되는 대신 빌드에서 걸린다.
  strictPropertyValues: true,

  jsxFramework: 'react',
  minify: true,

  outdir: 'styled-system',

  // preset-base의 기본 `dark` 조건은 `.dark &`다. 이 앱은 html[data-theme]으로
  // 테마를 바꾸므로(src/app/theme-script.ts) 선택자를 갈아끼운다. 토큰이 아니라
  // **조건**이라 프리셋이 대신 정해 줄 수 없는 자리다 — 여기를 지우면 `_dark`가
  // 아무 데도 걸리지 않고 다크 테마가 통째로 조용히 사라진다.
  //
  // `prefers-color-scheme` 미디어쿼리를 조건으로 쓰지 않는 이유: 시스템 설정과
  // 사용자의 명시 선택을 한 축에서 표현할 수 없다. 시스템 설정 반영은
  // src/app/theme-script.ts가 첫 페인트 전에 data-theme으로 환산해 넣는다.
  conditions: {
    extend: {
      dark: '[data-theme=dark] &',
    },
  },

  globalCss: {
    extend: {
      html: {
        bg: 'slate.50',
        color: 'slate.900',
        // 한글 본문은 어절 단위로 끊어야 읽힌다. keep-all이 없으면 한 어절이
        // 줄 끝에서 반 토막 난다.
        wordBreak: 'keep-all',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        // 네이티브 컨트롤(스크롤바·폼 위젯)을 테마에 맞춘다.
        colorScheme: 'light',
        // `_dark`가 아니라 셀렉터를 직접 쓴다. `_dark` 조건은
        // `[data-theme=dark] &`로 풀리는데, 여기서 `&`는 html 자신이라
        // `[data-theme=dark] html` — 속성을 들고 있는 그 엘리먼트를 조상으로
        // 찾게 되어 영원히 안 맞는다. 이 한 자리만 예외다.
        '&[data-theme=dark]': {
          bg: 'slate.950',
          color: 'slate.100',
          colorScheme: 'dark',
        },
      },
      body: {
        fontFamily: 'sans',
        textStyle: 'md',
        margin: '0',
        minHeight: '100dvh',
      },
      // 드래그 선택 배경. 글자색은 건드리지 않는다 — 강제하면 링크·구문 강조가
      // 선택 중에만 제 색을 잃는다.
      '::selection': {
        bg: 'violet.200',
      },
      '[data-theme=dark] ::selection': {
        bg: 'violet.800',
      },
      // 포커스 링은 전역에서 한 번만 정의한다. 컴포넌트마다 다시 그리면
      // 키보드 사용자가 화면마다 다른 규칙을 학습해야 한다.
      ':focus-visible': {
        outline: '2px solid token(colors.violet.500)',
        outlineOffset: '2px',
        borderRadius: 'sm',
      },
      // 어두운 지면 위에서 violet.500은 대비가 모자란다 — 한 칸 밝은 쪽으로.
      '[data-theme=dark] :focus-visible': {
        outline: '2px solid token(colors.violet.400)',
      },
    },
  },
});
