import { defineConfig } from '@pandacss/dev';

/**
 * Panda CSS 구성.
 *
 * DESIGN.md의 Jitter 팔레트·캡슐 모서리·타이포·확산 그림자를
 * 공식 프리셋 위에 이름 있는 토큰으로 등록한다.
 * 화면은 ui.* 시맨틱 토큰을 쓰고, 테마별 지면과 글자색은 여기서 짝을 이룬다.
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

  // 디자인 토큰 강제: 임의 색·값 대신 등록된 토큰만 허용한다. 임의값이 꼭
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

  theme: {
    extend: {
      tokens: {
        colors: {
          design: {
            studio: { value: '#f2f1f3' },
            violet: { value: '#7a40ed' },
            ink: { value: '#19171c' },
            paper: { value: '#ffffff' },
            hairline: { value: '#e5e4e7' },
            mist: { value: '#97979b' },
            slate: { value: '#6e6e73' },
            black: { value: '#000000' },
            plum: { value: '#17082c' },
            lilac: { value: '#a981ff' },
            lavender: { value: '#cab3f8' },
            blue: { value: '#00b2ff' },
            sky: { value: '#e6f4ff' },
            ice: { value: '#a9dbff' },
            volt: { value: '#f5ff63' },
            darkSurface: { value: '#2d2933' },
          },
        },
        radii: {
          control: { value: '50px' },
          panel: { value: '40px' },
          hero: { value: '40px' },
          input: { value: '26px' },
          nav: { value: '20px' },
          badge: { value: '40px' },
        },
        fonts: {
          sans: {
            value:
              'var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          },
          display: {
            value:
              'var(--font-inter-tight), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          },
        },
        shadows: {
          preview: {
            value:
              '0 152px 61px rgba(25,23,28,0.01), 0 85px 51px rgba(25,23,28,0.05), 0 38px 38px rgba(25,23,28,0.09), 0 9px 21px rgba(25,23,28,0.10)',
          },
          card: {
            value:
              '0 119px 48px rgba(0,0,0,0.01), 0 67px 40px rgba(0,0,0,0.05), 0 30px 30px rgba(0,0,0,0.09), 0 7px 16px rgba(0,0,0,0.10)',
          },
          floating: {
            value:
              '0 63px 25px rgba(0,0,0,0.01), 0 35px 21px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.09), 0 4px 9px rgba(0,0,0,0.10)',
          },
        },
        sizes: { page: { value: '1200px' } },
      },
      semanticTokens: {
        colors: {
          ui: {
            canvas: {
              value: {
                base: '{colors.design.studio}',
                _dark: '{colors.design.ink}',
              },
            },
            surface: {
              value: {
                base: '{colors.design.paper}',
                _dark: '{colors.design.darkSurface}',
              },
            },
            muted: {
              value: {
                base: '{colors.design.studio}',
                _dark: '{colors.design.ink}',
              },
            },
            ink: {
              value: {
                base: '{colors.design.ink}',
                _dark: '{colors.design.paper}',
              },
            },
            subtle: {
              value: {
                base: '{colors.design.slate}',
                _dark: '{colors.design.mist}',
              },
            },
            border: {
              value: {
                base: '{colors.design.hairline}',
                _dark: '{colors.neutral.600}',
              },
            },
            line: {
              value: {
                base: '{colors.design.hairline}',
                _dark: '{colors.neutral.700}',
              },
            },
            accent: { value: '{colors.design.violet}' },
            onAccent: { value: '{colors.design.paper}' },
            accentText: {
              value: {
                base: '{colors.design.violet}',
                _dark: '{colors.design.lavender}',
              },
            },
            action: {
              value: {
                base: '{colors.design.ink}',
                _dark: '{colors.design.paper}',
              },
            },
            onAction: {
              value: {
                base: '{colors.design.paper}',
                _dark: '{colors.design.ink}',
              },
            },
            actionHover: {
              value: {
                base: '{colors.design.darkSurface}',
                _dark: '{colors.design.hairline}',
              },
            },
            floatingAction: { value: '{colors.design.lavender}' },
            onFloatingAction: { value: '{colors.design.plum}' },
            floatingActionHover: { value: '{colors.design.lilac}' },
            tag: {
              value: {
                base: '{colors.design.lavender}',
                _dark: '{colors.design.plum}',
              },
            },
            onTag: {
              value: {
                base: '{colors.design.plum}',
                _dark: '{colors.design.lavender}',
              },
            },
            blueWash: {
              value: {
                base: '{colors.design.sky}',
                _dark: '{colors.design.darkSurface}',
              },
            },
            input: {
              value: {
                base: '{colors.design.studio}',
                _dark: '{colors.design.darkSurface}',
              },
            },
          },
        },
      },
      textStyles: {
        caption: {
          value: {
            fontFamily: 'sans',
            fontSize: '12px',
            lineHeight: '1.5',
            fontWeight: '400',
          },
        },
        bodySm: {
          value: {
            fontFamily: 'sans',
            fontSize: '14px',
            lineHeight: '1.5',
            fontWeight: '400',
          },
        },
        body: {
          value: {
            fontFamily: 'sans',
            fontSize: '16px',
            lineHeight: '1.5',
            letterSpacing: '-0.02em',
            fontWeight: '400',
          },
        },
        button: {
          value: {
            fontFamily: 'sans',
            fontSize: '16px',
            lineHeight: '1.5',
            letterSpacing: '-0.02em',
            fontWeight: '600',
          },
        },
        subheading: {
          value: {
            fontFamily: 'sans',
            fontSize: '21px',
            lineHeight: '1.38',
            letterSpacing: '-0.02em',
            fontWeight: '600',
          },
        },
        headingSm: {
          value: {
            fontFamily: 'sans',
            fontSize: '26px',
            lineHeight: '1.25',
            fontWeight: '600',
          },
        },
        heading: {
          value: {
            fontFamily: 'display',
            fontSize: '40px',
            lineHeight: '1.2',
            letterSpacing: '-0.03em',
            fontWeight: '750',
          },
        },
        headingLg: {
          value: {
            fontFamily: 'display',
            fontSize: '48px',
            lineHeight: '1.15',
            letterSpacing: '-0.03em',
            fontWeight: '750',
          },
        },
        display: {
          value: {
            fontFamily: 'display',
            fontSize: '80px',
            lineHeight: '0.95',
            letterSpacing: '-0.032em',
            fontWeight: '800',
          },
        },
      },
      // 프리셋에는 이미지 높이에 맞춰 왕복하는 스캔 동작이 없다.
      keyframes: {
        'upload-scan': {
          '0%, 100%': { transform: 'translateY(-100%)' },
          '50%': { transform: 'translateY(0)' },
        },
      },
    },
  },

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
        bg: 'ui.canvas',
        color: 'ui.ink',
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
          colorScheme: 'dark',
        },
      },
      body: {
        fontFamily: 'sans',
        textStyle: 'body',
        margin: '0',
        minHeight: '100dvh',
      },
      // 드래그 선택 배경. 글자색은 건드리지 않는다 — 강제하면 링크·구문 강조가
      // 선택 중에만 제 색을 잃는다.
      '::selection': {
        bg: 'ui.accent',
        color: 'ui.onAccent',
      },
      // 포커스 링은 전역에서 한 번만 정의한다. 컴포넌트마다 다시 그리면
      // 키보드 사용자가 화면마다 다른 규칙을 학습해야 한다.
      ':focus-visible': {
        outline: '2px solid token(colors.ui.accentText)',
        outlineOffset: '2px',
        borderRadius: 'control',
      },
    },
  },
});
