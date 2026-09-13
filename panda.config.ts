import { defineConfig } from '@pandacss/dev';

/**
 * Panda CSS 구성.
 *
 * DESIGN.md의 Ant Design 기반 체계 — 프라이머리 보라, 중립 회색 축,
 * 6·8px 모서리, 얕은 3단 그림자, 14px 본문 — 를 공식 프리셋 위에 이름 있는
 * 토큰으로 등록한다. 화면은 ui.* 시맨틱 토큰을 쓰고, 테마별 지면과 글자색은
 * 여기서 짝을 이룬다.
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
          // Ant Design v5의 색 생성 규칙을 프라이머리(#7a40ed)에 적용한 10단계.
          // 6이 기준색, 5가 hover, 7이 active다.
          primary: {
            1: { value: '#f6f0ff' },
            2: { value: '#ead9ff' },
            3: { value: '#d5bbfc' },
            4: { value: '#bd98f8' },
            5: { value: '#a172f3' },
            6: { value: '#7a40ed' },
            7: { value: '#5f2bcc' },
            8: { value: '#461aa6' },
            9: { value: '#2f0d80' },
            10: { value: '#1c0659' },
          },
          // Ant의 중립 계열. 지면·표면·보더·글자가 전부 이 축에서 나온다.
          gray: {
            1: { value: '#ffffff' },
            2: { value: '#fafafa' },
            3: { value: '#f5f5f5' },
            4: { value: '#f0f0f0' },
            5: { value: '#d9d9d9' },
            6: { value: '#bfbfbf' },
            7: { value: '#8c8c8c' },
            8: { value: '#595959' },
            9: { value: '#1f1f1f' },
            10: { value: '#141414' },
            11: { value: '#000000' },
          },
          // 다크에서 쓰는 중립. Ant 다크 테마의 지면·보더 값이다.
          grayDark: {
            container: { value: '#141414' },
            elevated: { value: '#1f1f1f' },
            border: { value: '#424242' },
            split: { value: '#303030' },
            text: { value: '#e6e6e6' },
            textSecondary: { value: '#a6a6a6' },
          },
          status: {
            error: { value: '#ff4d4f' },
            errorBg: { value: '#fff2f0' },
            errorBorder: { value: '#ffccc7' },
            errorDark: { value: '#dc4446' },
            errorBgDark: { value: '#2c1618' },
            success: { value: '#52c41a' },
            info: { value: '#1677ff' },
            infoBg: { value: '#e6f4ff' },
          },
        },
        // 선 굵기는 둘뿐이다. Ant의 1px이 기본이고, 강조가 필요한 자리만 2px.
        borderWidths: {
          hairline: { value: '1px' },
          thick: { value: '2px' },
        },
        // Ant의 모서리: 기본 6, 큰 면 8, 작은 태그 4. 캡슐은 쓰지 않는다.
        radii: {
          control: { value: '6px' },
          panel: { value: '8px' },
          hero: { value: '8px' },
          input: { value: '6px' },
          nav: { value: '8px' },
          badge: { value: '4px' },
        },
        fonts: {
          sans: {
            value:
              'var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          },
          display: {
            value:
              'var(--font-inter), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          },
        },
        // Ant의 3단 그림자. 카드는 거의 눕고, 떠 있는 것만 확실히 뜬다.
        shadows: {
          card: {
            value:
              '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
          },
          floating: {
            value:
              '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)',
          },
          preview: {
            value:
              '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)',
          },
        },
        sizes: {
          page: { value: '1200px' },
          // Ant의 컨트롤 높이(32/40)는 터치 타깃 44px에 못 미친다. 모바일
          // 화면이라 기본을 44로 올리고, 큰 컨트롤만 48로 둔다.
          control: { value: '44px' },
          controlLg: { value: '48px' },
        },
      },
      semanticTokens: {
        colors: {
          ui: {
            canvas: {
              value: { base: '{colors.gray.3}', _dark: '{colors.gray.11}' },
            },
            surface: {
              value: {
                base: '{colors.gray.1}',
                _dark: '{colors.grayDark.container}',
              },
            },
            muted: {
              value: {
                base: '{colors.gray.2}',
                _dark: '{colors.grayDark.elevated}',
              },
            },
            ink: {
              value: {
                base: '{colors.gray.9}',
                _dark: '{colors.grayDark.text}',
              },
            },
            subtle: {
              value: {
                base: '{colors.gray.8}',
                _dark: '{colors.grayDark.textSecondary}',
              },
            },
            border: {
              value: {
                base: '{colors.gray.5}',
                _dark: '{colors.grayDark.border}',
              },
            },
            line: {
              value: {
                base: '{colors.gray.4}',
                _dark: '{colors.grayDark.split}',
              },
            },
            accent: { value: '{colors.primary.6}' },
            accentHover: { value: '{colors.primary.5}' },
            accentActive: { value: '{colors.primary.7}' },
            accentBorder: {
              value: {
                base: '{colors.primary.3}',
                _dark: '{colors.primary.8}',
              },
            },
            onAccent: { value: '{colors.gray.1}' },
            accentText: {
              value: {
                base: '{colors.primary.6}',
                _dark: '{colors.primary.4}',
              },
            },
            // 주 동작은 프라이머리다. 검정 채움 버튼을 따로 두면 화면마다
            // 무엇이 주 동작인지가 달라진다.
            action: { value: '{colors.primary.6}' },
            onAction: { value: '{colors.gray.1}' },
            actionHover: { value: '{colors.primary.5}' },
            floatingAction: { value: '{colors.primary.6}' },
            onFloatingAction: { value: '{colors.gray.1}' },
            floatingActionHover: { value: '{colors.primary.5}' },
            tag: {
              value: {
                base: '{colors.primary.1}',
                _dark: '{colors.primary.9}',
              },
            },
            onTag: {
              value: {
                base: '{colors.primary.7}',
                _dark: '{colors.primary.3}',
              },
            },
            blueWash: {
              value: {
                base: '{colors.status.infoBg}',
                _dark: '{colors.grayDark.elevated}',
              },
            },
            input: {
              value: {
                base: '{colors.gray.1}',
                _dark: '{colors.grayDark.container}',
              },
            },
            // 지면(#f5f5f5) 위에 놓이는 안내의 바탕. primary.1은 지면과 명도가
            // 거의 같아 상자가 있는지조차 보이지 않는다.
            accentMuted: {
              value: {
                base: '{colors.primary.2}',
                _dark: '{colors.primary.9}',
              },
            },
            // Ant의 끈 상태: 지면보다 한 단 눌린 회색 바탕에 흐린 글자,
            // 테두리는 살아 있는 것과 같은 굵기로 남긴다.
            disabled: {
              value: {
                base: '{colors.gray.3}',
                _dark: '{colors.grayDark.elevated}',
              },
            },
            onDisabled: {
              value: { base: '{colors.gray.6}', _dark: '{colors.gray.7}' },
            },
            danger: {
              value: {
                base: '{colors.status.error}',
                _dark: '{colors.status.errorDark}',
              },
            },
            dangerBorder: {
              value: {
                base: '{colors.status.errorBorder}',
                _dark: '{colors.status.errorDark}',
              },
            },
            dangerWash: {
              value: {
                base: '{colors.status.errorBg}',
                _dark: '{colors.status.errorBgDark}',
              },
            },
            success: { value: '{colors.status.success}' },
          },
        },
      },
      // Ant의 타입 스케일. 본문 14px이 기준이고, 제목은 20/24/30/38로 오른다.
      textStyles: {
        caption: {
          value: {
            fontFamily: 'sans',
            fontSize: '12px',
            lineHeight: '1.67',
            fontWeight: '400',
          },
        },
        // Ant의 작은 글자는 12px이지만 한글은 그 크기에서 획이 뭉친다.
        // 화면에서 가장 많이 쓰는 단계라 13px로 한 칸만 올린다.
        bodySm: {
          value: {
            fontFamily: 'sans',
            fontSize: '13px',
            lineHeight: '1.6',
            fontWeight: '400',
          },
        },
        body: {
          value: {
            fontFamily: 'sans',
            fontSize: '14px',
            lineHeight: '1.5714',
            fontWeight: '400',
          },
        },
        // Ant의 fontSizeLG. 제목 바로 아래 한 문장처럼 본문보다 한 단 앞세울
        // 자리에 쓴다.
        bodyLg: {
          value: {
            fontFamily: 'sans',
            fontSize: '16px',
            lineHeight: '1.5',
            fontWeight: '400',
          },
        },
        button: {
          value: {
            fontFamily: 'sans',
            fontSize: '14px',
            lineHeight: '1.5714',
            fontWeight: '500',
          },
        },
        subheading: {
          value: {
            fontFamily: 'sans',
            fontSize: '16px',
            lineHeight: '1.5',
            fontWeight: '600',
          },
        },
        headingSm: {
          value: {
            fontFamily: 'sans',
            fontSize: '20px',
            lineHeight: '1.4',
            fontWeight: '600',
          },
        },
        heading: {
          value: {
            fontFamily: 'sans',
            fontSize: '24px',
            lineHeight: '1.35',
            fontWeight: '600',
          },
        },
        headingLg: {
          value: {
            fontFamily: 'sans',
            fontSize: '30px',
            lineHeight: '1.27',
            fontWeight: '600',
          },
        },
        display: {
          value: {
            fontFamily: 'sans',
            fontSize: '38px',
            lineHeight: '1.21',
            fontWeight: '600',
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
