import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Panda 대괄호 이스케이프로 색을 직접 박는 것을 막는다.
 *
 * `strictTokens: true`는 토큰 밖 값을 막지만 `'[#7c3aed]'` 이스케이프는
 * 통과시킨다 — "여긴 의도적으로 토큰을 벗어난다"를 남기라는 장치이고, 색에는
 * 그 의도가 성립하지 않는다. 이스케이프로 박은 색은 라이트/다크 중 한쪽에서만
 * 맞는 값이 되고, 그 회귀는 lint가 아니라 화면을 봐야 발견된다.
 *
 * `no-restricted-syntax`는 **블록마다 통째로 덮어써지므로**(뒤 블록이 이김)
 * 이 항목을 이 룰을 쓰는 모든 블록에 함께 펼친다. 새 블록에서 이 룰을 켜면
 * 여기도 반드시 넣을 것 — 안 그러면 그 파일들에서 색 가드가 조용히 사라진다.
 */
const NO_ESCAPED_HEX = {
  selector: 'Literal[value=/^\\[#/]',
  message:
    '색은 Panda 공식 프리셋의 팔레트 토큰에서 옵니다. `[#hex]` 대괄호 이스케이프로 색을 직접 박지 마세요 — 라이트/다크 한쪽에서만 맞는 값이 됩니다.',
} as const;

/**
 * 도메인이 열 수 있는 것 — shared와 platform뿐이다.
 *
 * 세 도메인이 같은 허용을 공유하는 것은 우연이 아니라 **한 결정**이다("도메인은
 * 순수 규칙 + 어댑터 조립이다"). 그래서 세 벌 복사하지 않고 여기 한 번 적는다 —
 * 복사해 두면 한쪽만 넓어져도 아무도 눈치채지 못한다. 어느 도메인이 다른 허용을
 * 갖게 되면 그 도메인의 policy만 떼어내 인라인으로 적고, 그때 근거를 함께 적는다.
 *
 * 외부 패키지는 없다. 도메인이 특정 SDK 모양에 묶이면 그게 곧 platform 레이어를
 * 우회한 것이다 — SDK는 platform의 어댑터 안에서만 산다.
 *
 * `from`을 도메인별로 나눠 적는 것과 달리, 여기 `to` 목록에 도메인이 없으므로
 * 도메인끼리는 서로를 열지 못한다. 도메인 간 의존이 필요해 보이면 조립을 위
 * 레이어(유스케이스)로 올리는 것이 정답이고, 여기 이름을 더하는 것이 아니다.
 */
const DOMAIN_OPENS = [
  { to: { element: { types: { anyOf: ['shared', 'platform'] } } } },
];

/**
 * ESLint 10 구성 — `eslint-config-next` 프리셋을 쓰지 않고 플러그인을 직접 조립한다.
 *
 * 프리셋이 끌고 오는 eslint-plugin-react@7.x가 ESLint 10에서 제거된
 * `context.getFilename()`을 가드 없이 호출해(util/version.js의 version:'detect'
 * 경로) 린트가 통째로 죽는다. 여기서 조립하는 플러그인은 전부 ESLint 10 동작을
 * 실측한 조합이다. react 계열 정적 검사는 react-hooks의 recommended-latest가
 * 담당한다(React Compiler 진단 룰 포함).
 *
 * 타입 정보가 필요한 룰셋은 recommendedTypeCheckedOnly + projectService로 켠다.
 * 프로덕션 파일은 projectService가 tsconfig.json을 자동 발견하고, 테스트 파일은
 * 전용 블록이 tsconfig.test.json 프로그램을 쓴다(각 블록 주석 참조).
 */
export default defineConfig([
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'public/**',
      // Panda 생성 트리(panda.config.ts의 outdir). 손으로 고칠 파일이 아니고,
      // codegen 때마다 통째로 다시 쓰인다.
      'styled-system/**',
      // vitest --coverage의 HTML 리포터가 뱉는 번들된 벤더 JS. 소스가 아니다.
      'coverage/**',
      'next-env.d.ts',
    ],
  },

  {
    // `eslint .`가 순회할 확장자 등록 + 전역 식별자. 이 앱은 빌드 스크립트(node)와
    // 클라이언트 컴포넌트(browser)가 한 트리에 있어 둘 다 연다.
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // ── 기본 룰셋: 코어 recommended → typescript-eslint strict + stylistic ──
  // 순서가 중요하다 — tseslint 프리셋 안의 eslint-recommended 오버라이드가
  // TS 파일에서 코어 no-undef·no-unused-vars 등(컴파일러가 이미 잡는 것)을
  // 꺼 주므로 코어를 먼저 두고 ts를 뒤에 둔다. strict는 recommended의 상위집합.
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // ── 타입 정보 기반 룰셋 ────────────────────────────────────────────────────
  // recommendedTypeCheckedOnly = recommended 중 타입 정보가 필요한 룰만.
  // (strict/stylistic의 비-타입 룰은 위에서 이미 적용했으므로 *Only로 중복을 피한다)
  ...tseslint.configs.recommendedTypeCheckedOnly,
  {
    // projectService는 파일별로 가장 가까운 tsconfig.json을 자동 발견한다.
    // 프로덕션 소스는 전부 tsconfig.json 소속이므로 이걸로 충분하다.
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // 테스트 파일은 tsconfig.json이 exclude하고 tsconfig.test.json이 include한다
    // (프로덕션 전용 엄격 플래그 3개를 끄기 위한 분할). projectService의 자동
    // 발견은 파일명이 tsconfig.json인 것만 찾으므로 테스트 파일이 "어느
    // 프로젝트에도 없음"으로 떨어진다. allowDefaultProject로 우회하지 않는
    // 이유: `**` 글롭을 금지해 테스트 위치마다 패턴을 나열해야 하고, 그렇게
    // 열어도 tsconfig.test.json이 아니라 defaultProject 단일 파일 추론으로
    // 검사돼 check-types가 보는 프로그램과 어긋난다. 대신 여기서
    // tsconfig.test.json 프로그램을 명시해 check-types와 정확히 같은 타입
    // 환경으로 린트한다. 파일 목록은 tsconfig.test.json의 include와 대칭 —
    // 저쪽을 고치면 여기도 함께 고칠 것.
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      'vitest.config.mts',
      'vitest.setup.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // 설정 파일 등 JS는 어떤 tsconfig 프로그램에도 속하지 않는다 — 타입 룰 해제.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  nextPlugin.configs['core-web-vitals'],
  {
    // lint 실행 cwd가 앱 루트라는 보장이 없으므로 명시한다. 없으면
    // @next/next/no-html-link-for-pages가 cwd에서 pages/·app/을 찾는다.
    settings: { next: { rootDir: import.meta.dirname } },
  },

  {
    // blob URL 미리보기에는 next/image를 쓸 수 없다 — 예외를 여기 적는다.
    //
    // `no-img-element`가 권하는 next/image는 (1) 서버가 받아올 수 있는 주소와
    // (2) 미리 아는 width·height를 전제한다. 브라우저가 방금 만든
    // `blob:` URL은 둘 다 아니다. 서버는 그 주소를 열 수 없고, 파일을 디코딩하기
    // 전에는 크기를 모른다. 룰이 말하는 LCP·대역폭 걱정도 성립하지 않는다 —
    // 이 이미지는 이미 사용자 기기에 있는 파일이고 네트워크를 타지 않는다.
    //
    // 스코프를 파일 하나로 좁힌 이유: 다른 자리에서 img를 쓰고 싶어지면 그때
    // 다시 판단해야 한다. 패턴으로 넓혀 두면 그 판단이 생략된다.
    files: ['src/components/UploadForm.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },

  reactHooks.configs.flat['recommended-latest'],

  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      // 스크롤 표 래퍼(role="region" + aria-label + tabIndex=0)는 axe
      // scrollable-region-focusable이 요구하는 패턴이다 — 마우스 없이 스크롤할
      // 방법이 있어야 한다. 룰 기본 허용 목록(tabpanel)에 region을 더한다.
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { roles: ['tabpanel', 'region'] },
      ],
    },
  },

  {
    // 별칭(@/)·확장자 없는 import의 경로 해석기. 이게 없으면 별칭 import가
    // 전부 미해석으로 떨어져 아래 boundaries가 조용히 무력해진다.
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
    },
  },

  // ── disable 주석 정책: 인라인 인가 전면 금지 ───────────────────────────────
  // 룰을 끄는 결정은 **이 파일에서만** 한다. 소스에 흩어진 한 줄짜리 인가는
  // 리뷰에서 diff 한 줄로 지나가고, 한 번 붙으면 근거가 유효한지 아무도 다시
  // 묻지 않는다. 여기서 끄면 최소한 "무엇을 왜 껐나"가 한곳에 모인다.
  {
    plugins: { '@eslint-community/eslint-comments': eslintComments },
    linterOptions: {
      // 인라인 설정 주석을 **읽지 않는다.** eslint-disable·eslint-enable·
      // eslint(룰 설정)·globals 전부 무효가 된다.
      noInlineConfig: true,
      reportUnusedInlineConfigs: 'error',
    },
    rules: {
      // noInlineConfig는 주석을 조용히 무시할 뿐이라, 그것만 켜면 "끈 줄
      // 알았는데 안 꺼진" 죽은 주석이 소스에 남는다. 주석 자체를 에러로 만들어
      // 그 상태를 없앤다 — 인가가 필요하면 이 파일에 files 스코프로 적어야 한다.
      '@eslint-community/eslint-comments/no-use': 'error',
    },
  },

  {
    rules: {
      // `_` prefix 식별자는 의도적 미사용으로 간주(destructuring rest 패턴 등).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // 타입은 항상 `import type`으로 — isolatedModules 정확성 + 번들 누수 예방.
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports' },
      ],
    },
  },

  // ── 아키텍처 경계: boundaries가 못 보는 결 ─────────────────────────────────
  // import **방향**은 아래 boundaries 블록이 전담한다(해석된 경로 기반이라
  // alias·상대경로 어느 쪽으로도 우회할 수 없다). 여기 블록들은 방향이 아니라
  // 배럴 강제와 모듈의 **모양**을 잠근다.
  {
    // app 레이어(src에서 레이어 폴더 제외)는 domain/<x>의 공개 API(배럴)만 쓰고
    // repository(인프라)를 직접 찌르지 않는다.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/{shared,domain,lib}/**', '**/*.test.{ts,tsx}'],
    rules: {
      // `**/` 접두로 alias(@/domain/...)와 상대경로(../../domain/...) 양쪽을 차단.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // adminRepository처럼 접두사가 붙은 것도 함께 막는다.
              group: [
                '**/domain/*/*[rR]epository',
                '**/domain/*/*[rR]epository.*',
              ],
              message:
                'repository는 인프라 레이어입니다. domain/<x>의 공개 배럴(index.ts)을 통해 접근하세요.',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', NO_ESCAPED_HEX],
    },
  },
  {
    // 도메인 공개 배럴은 모듈 최상위에 부수효과를 두지 않는다. 번들러가
    // 부수효과로 보는 순간, 거기 매달린 모듈 전부를 청크에서 떨궈내지 못한다 —
    // 배럴 한 줄의 `new Service()`가 계산 모듈 전체를 모든 페이지에 싣는다.
    // 새 도메인이 생기면 그 배럴을 이 목록에 추가할 것.
    files: ['src/domain/*/index.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        NO_ESCAPED_HEX,
        {
          selector: 'Program > ExpressionStatement > NewExpression',
          message:
            '공개 배럴의 모듈 최상위 부수효과는 청크 누수를 만듭니다. 싱글톤 생성은 소비자 쪽으로 옮기세요.',
        },
        {
          selector: 'Program > ExpressionStatement > CallExpression',
          message:
            '공개 배럴의 모듈 최상위 부수효과는 청크 누수를 만듭니다. 호출이 필요하면 소비자 쪽으로 옮기세요.',
        },
        {
          selector:
            ':matches(Program, Program > ExportNamedDeclaration) > VariableDeclaration > VariableDeclarator > NewExpression.init',
          message:
            '공개 배럴의 모듈 최상위 new는 번들러에 부수효과입니다. 싱글톤 생성은 소비자 쪽으로 옮기세요.',
        },
        {
          selector:
            ':matches(Program, Program > ExportNamedDeclaration) > VariableDeclaration > VariableDeclarator > CallExpression.init',
          message:
            '공개 배럴의 모듈 최상위 호출은 번들러에 부수효과입니다. 값이 필요하면 소비자 쪽에서 만드세요.',
        },
        // default export 경로도 막는다 — `export default new X()`는 위 두 계열
        // (표현식문·변수 초기화) 어느 쪽에도 매치되지 않는다.
        {
          selector: 'Program > ExportDefaultDeclaration > NewExpression',
          message:
            '공개 배럴의 모듈 최상위 new는 번들러에 부수효과입니다. 싱글톤 생성은 소비자 쪽으로 옮기세요.',
        },
        {
          selector: 'Program > ExportDefaultDeclaration > CallExpression',
          message:
            '공개 배럴의 모듈 최상위 호출은 번들러에 부수효과입니다. 값이 필요하면 소비자 쪽에서 만드세요.',
        },
      ],
    },
  },
  {
    // shared(최하단)의 import 방향은 아래 boundaries가 강제한다. 이 블록은
    // 모듈의 **모양**을 잠근다 — shared는 모든 레이어가 여는 유일한 폴더라,
    // 여기 뚫린 구멍은 앱 전체가 공유한다:
    //
    // (1) 재수출 금지 — `export … from` / `export * from`은 shared를 다른
    //     모듈의 2차 문으로 만드는 세탁 통로다. shared를 거치면 경계 검사가
    //     shared까지만 보고 끝나서, 그 너머의 의존이 보이지 않는다.
    //     shared는 자기 선언만 내보낸다.
    // (2) 모듈 최상위 문(statement) 금지 — 어디서나 import되는 모듈이라
    //     부수효과가 생기면 모든 청크에 함께 실린다. 'use client' 지시문도
    //     여기 걸린다 — shared는 클라이언트 경계가 아니다. 파생 상수의 순수
    //     함수 호출(`export const X = f(Y)`)은 문이 아니라 초기화라 걸리지 않는다.
    files: ['src/shared/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        NO_ESCAPED_HEX,
        {
          selector: 'ExportAllDeclaration',
          message:
            'shared에서 재수출(export * from)은 금지입니다 — shared가 다른 모듈의 2차 문이 되어 경계·배럴 최적화를 우회합니다. 자기 선언만 내보내세요.',
        },
        {
          selector: 'ExportNamedDeclaration[source]',
          message:
            'shared에서 재수출(export … from)은 금지입니다 — 필요한 쪽이 원본 모듈을 직접 여세요.',
        },
        {
          selector: 'Program > ExpressionStatement',
          message:
            'shared 모듈 최상위에는 문(statement)을 두지 않습니다 — 모든 레이어에 실려 가는 모듈이라 부수효과·지시문(use client)이 앱 전체에 퍼집니다.',
        },
      ],
    },
  },
  {
    // shared에는 컴포넌트가 없다 — .tsx 자체를 막는다. JSX 자동 런타임은 react
    // import 없이 컴파일되므로 boundaries의 외부 의존 차단만으로는 못 잡는다.
    // 컴포넌트는 src/app, 여러 화면이 공유하는 것도 src/components다.
    files: ['src/shared/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        NO_ESCAPED_HEX,
        {
          selector: 'Program',
          message:
            'shared에는 .tsx(컴포넌트)를 두지 않습니다 — 순수 계약(.ts)만. 공유 컴포넌트는 src/components/로.',
        },
      ],
    },
  },

  // ── 레이어 경계 (eslint-plugin-boundaries) ─────────────────────────────────
  // element는 전부 **폴더 단위**다. `boundaries/files` 카테고리로 파일을 골라
  // element를 우회 배정하는 뒷문을 열지 않는다 — 폴더에 새 파일이 떨어지면
  // 자동으로 그 element를 상속한다.
  //
  // 레이어 순서(아래→위): shared → platform → domain/<x> → app.
  //
  //   shared    src/shared         순수 계약(라우트·상수·파서). 아무것도 import하지 않는다.
  //   platform  src/lib/platform   바깥 세계 어댑터(HTTP·스토리지). shared만 안다.
  //   domain    src/domain/<x>     도메인 규칙. shared·platform을 쓰고, 배럴로만 공개한다.
  //   app       src/(나머지)        라우트·컴포넌트·훅. domain 배럴과 shared만 연다.
  //
  // app이 platform을 직접 열지 못하는 게 이 배치의 핵심이다 — 데이터 접근은
  // 전부 도메인을 지나므로, 화면이 인프라 모양(HTTP 응답 형태 등)에 물들지 않는다.
  //
  // **새 도메인을 추가하면 아래 elements와 policies 양쪽에 한 줄씩 넣어야 한다.**
  // 도메인을 `src/domain/*` 한 패턴으로 뭉뚱그리지 않는 이유: 그러면 도메인끼리
  // 서로를 자유롭게 import할 수 있게 되어(같은 element type) 도메인 격리가 사라진다.
  //
  // 이 블록 전체는 **src/에만** 건다. 전역으로 걸면 루트의 설정 파일들이 전부
  // unknown이 되고, 오탐 시 탈출구가 없다.
  {
    files: ['src/**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': import.meta.dirname,
      // 첫 매치 하나만 배정 — 구체 패턴이 폴백보다 **반드시 앞에** 와야 한다.
      // 순서가 뒤집히면 레이어 파일이 전부 app으로 배정돼 경계가 조용히 죽는다.
      'boundaries/elements-single-match': true,
      'boundaries/elements': [
        // Panda 생성 트리. 스타일 유틸(css·styled)은 화면을 그리는 레이어만 연다.
        { type: 'design-system', pattern: 'styled-system' },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'platform', pattern: 'src/lib/platform' },
        // 도메인은 하나씩 나열한다. `src/domain/*` 한 패턴으로 뭉치면 셋이 같은
        // element type이 되어 도메인끼리 자유롭게 import된다 — 격리가 사라진다.
        { type: 'extraction', pattern: 'src/domain/extraction' },
        { type: 'spot', pattern: 'src/domain/spot' },
        { type: 'route', pattern: 'src/domain/route' },
        // 레이어 부모 폴더 직속(src/lib·src/domain 바로 아래)에 떨어진 파일의
        // 격리 element. 어떤 policy에도 없으므로, 이 자리에 파일이 생기면
        // 그것이 무언가를 import하거나 import되는 순간 에러가 난다 —
        // "어느 레이어인지 정하지 않은 파일"이 조용히 사는 것을 막는다.
        { type: 'layer-root', pattern: ['src/lib', 'src/domain'] },
        // src 폴백 — 위 어디에도 안 걸린 src 파일은 전부 app 레이어다.
        { type: 'app', pattern: 'src' },
      ],
      // 테스트는 element 배정을 그대로 두고 파일 카테고리 축으로만 표시한다.
      // 아래 policies 마지막 두 줄이 "테스트는 전부 import 가능 / 프로덕션은
      // 테스트를 import 불가"를 만든다.
      'boundaries/files': [
        { category: 'test', pattern: ['**/*.test.*', '**/*.spec.*'] },
      ],
      // 'export'를 포함해 배럴의 `export * from`도 의존성으로 센다 — 안 세면
      // 배럴 한 줄로 모든 경계를 우회할 수 있다.
      'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
    },
    rules: {
      // no-unknown-files는 쓰지 않는다 — app이 src 전체의 폴백 element라
      // unknown 파일이 존재할 수 없어 죽은 게이트가 된다. 스트레이 파일 방어는
      // 위 layer-root 격리 element가 잇는다.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          // 로컬 element 간 의존뿐 아니라 외부 패키지·node 코어까지 전부 검사
          // 대상으로 — 레이어별 외부 화이트리스트가 아래 policies다.
          checkAllOrigins: true,
          // 같은 element 안의 import도 검사한다. 테스트가 프로덕션 파일과 같은
          // 폴더(=같은 element)에 살기 때문에, 이걸 꺼 두면 "프로덕션이 테스트를
          // import 금지"가 가장 흔한 사고(옆자리 *.test.ts import)를 못 잡는다.
          checkInternals: true,
          // 평가 규칙: **마지막으로 매치된 policy가 이긴다**(last-write-wins).
          policies: [
            // 같은 element 안에서는 자유 — 단, 아래 "테스트 import 금지"가
            // 뒤에 오므로 같은 폴더라도 프로덕션→테스트는 막힌다.
            {
              dependency: { relationship: { from: 'internal' } },
              allow: { to: { module: { origin: '*' } } },
            },
            {
              // shared는 앱 안팎 어디에도 기대지 않는다. 외부 패키지도 열지
              // 않는다 — 여기 의존이 하나 생기면 그 패키지가 앱 전체의 모든
              // 청크에 실린다. 순수 계약만 둘 것.
              from: { element: { type: 'shared' } },
              allow: [],
            },
            {
              // platform은 바깥 세계와 이야기하는 유일한 레이어라 외부 패키지와
              // node 코어를 연다. 대신 도메인 규칙을 알아서는 안 된다 —
              // 위 레이어를 import할 수 없다.
              from: { element: { type: 'platform' } },
              allow: [
                { to: { element: { types: { anyOf: ['shared'] } } } },
                { to: { module: { origin: 'core' } } },
                { to: { module: { origin: 'external' } } },
              ],
            },
            // 도메인 셋. 허용은 DOMAIN_OPENS 한 곳에 있다(위 주석 참조).
            { from: { element: { type: 'extraction' } }, allow: DOMAIN_OPENS },
            { from: { element: { type: 'spot' } }, allow: DOMAIN_OPENS },
            { from: { element: { type: 'route' } }, allow: DOMAIN_OPENS },
            {
              // app은 platform을 직접 만지지 않는다 — 데이터 접근은 전부 도메인
              // 배럴 경유다. node 코어도 열지 않는다(클라이언트 번들 누수 예방).
              from: { element: { type: 'app' } },
              allow: [
                {
                  to: {
                    element: {
                      types: {
                        anyOf: [
                          'shared',
                          'extraction',
                          'spot',
                          'route',
                          'design-system',
                        ],
                      },
                    },
                  },
                },
                { to: { module: { origin: 'external' } } },
              ],
            },
            // 프로덕션 코드는 테스트 파일을 import할 수 없다.
            { disallow: { to: { file: { categories: 'test' } } } },
            // 테스트는 무엇이든 import할 수 있다(마지막 매치가 이기므로 바로 위
            // 정책보다 뒤에 둬야 테스트→테스트도 허용된다).
            {
              from: { file: { categories: 'test' } },
              allow: { to: { module: { origin: '*' } } },
            },
          ],
        },
      ],
    },
  },
]);
