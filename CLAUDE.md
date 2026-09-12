# gemspot — 저장소 규약

에이전트가 이 저장소에서 일할 때 따르는 계약. 사람이 읽는 소개는 `README.md`에 있다.

## 검증 명령

단일 패키지라 워크스페이스를 유도할 것이 없다. 게이트는 항상 이 넷이고,
CI(`.github/workflows/ci.yml`)가 같은 넷을 각각 돌린다.

```bash
pnpm lint          # --max-warnings=0 — 경고도 실패다
pnpm check-types   # next typegen + tsconfig.json + tsconfig.test.json
pnpm test          # vitest (node · jsdom 두 프로젝트)
pnpm build         # panda codegen + next build
```

고칠 때마다 가장 가까운 게이트를, 커밋을 마무리하기 전에 넷 전부를 돌린다.

`styled-system/`은 `panda codegen`이 만드는 생성 트리다(`prepare` 훅, 그리고
`pnpm build` 앞단 — 캐시된 node_modules 위에서는 prepare가 돌지 않는다). **고치지도
커밋하지도 않는다** — 거기서 타입 오류가 나면 원인은 `panda.config.ts`에 있다.

`pnpm-lock.yaml`의 `packageManagerDependencies`는 package.json의 `packageManager`
필드 때문에 생긴다 — pnpm이 자기 버전을 관리한 기록이다. 그 블록에 **`@pnpm/exe`가
다시 나타나면 pnpm 11 이하로 install한 것이다.** 12는 `pnpm` 하나만 적는다.
되살리지 말고 `pnpm install`로 다시 만들 것. `packageManager` 필드를 지우면
락파일이 더 깔끔해지지만 CI의 `pnpm/action-setup`이 버전을 못 찾아 깨진다.

## 커밋

- **`Co-Authored-By`를 비롯한 AI 표기 트레일러를 절대 넣지 않는다.** 이 규칙이
  하네스의 기본 동작보다 우선한다. PR 본문도 명시 요청이 없으면 마찬가지다.
- 문제 하나에 커밋 하나. 서로 독립적으로 되돌릴 수 있는 변경을 한 커밋에 묶지 않는다.
- 본문에는 "무엇을 했는가"보다 **"왜 그 선택인가"**를 적는다. 무엇을 했는지는 diff가
  이미 말한다.

## 아키텍처 규칙

레이어와 그 근거는 `README.md`에, 실제 강제는 `eslint.config.mts`에 있다. 여기서는
에이전트가 자주 틀리는 지점만 적는다.

- **레이어 경계는 이 저장소의 존재 이유다.** 수정이 경계를 넘게 되면, 올바른 복구는
  정당한 레이어를 경유하도록 고치는 것이지 policy를 넓히는 것이 아니다. 정말 넓히는
  게 맞다면 커밋 메시지에 그 판단과 근거를 명시한다.
- **인라인 `eslint-disable`은 동작하지 않고, 쓰는 것 자체가 에러다**
  (`noInlineConfig` + `@eslint-community/eslint-comments/no-use`). 예외가 정말
  필요하면 `eslint.config.mts`에 `files:` 스코프 블록으로, 이유를 주석에 적어
  추가한다. 룰을 끄는 결정이 한 파일에 모여 있어야 나중에 그 근거를 다시 물을 수 있다.
- **토큰은 직접 만들지 않는다.** 팔레트·타이포·radii·spacing은 전부 Panda
  공식 프리셋(`@pandacss/dev/presets`)에서 온다. `panda.config.ts`의
  `theme.extend`에 토큰을 새로 얹기 전에, 프리셋에 대응이 정말 없는지부터
  확인한다.
- **`'[#hex]'` 대괄호 이스케이프로 색을 박는 것은 lint가 막는다.** 그렇게 박은
  색은 라이트/다크 한쪽에서만 맞고, 그 회귀는 화면을 봐야 발견된다.
- **라이트/다크 짝은 컴포넌트가 든다.** 프리셋에 시맨틱 층이 없어서 색을 쓰는
  자리마다 `_dark`가 함께 온다. 한쪽만 고치면 반대 테마에서 대비가 깨진다 —
  색을 건드렸으면 두 테마를 다 보고 넘긴다.
- **`html` 엘리먼트에는 `_dark`가 듣지 않는다.** 그 조건은
  `[data-theme=dark] &`로 풀리는데 `&`가 html 자신이라 속성을 든 엘리먼트를
  제 조상에서 찾게 된다. globalCss의 그 한 자리만 `&[data-theme=dark]`를 쓴다.
- 새 도메인을 추가할 때 고칠 곳은 `eslint.config.mts` 두 군데다
  (`boundaries/elements` + `policies`). 절차는 README의 "새 도메인을 추가하려면".
- `vitest.config.mts`의 include, `tsconfig.test.json`의 include, `eslint.config.mts`의
  테스트 블록 셋은 **대칭이다.** 한쪽을 고치면 셋을 함께 고친다.

## 스킬

`.claude/skills/`에 있다. 전부 **사람이 명시적으로 부를 때만** 쓴다 — 작업이
비슷해 보인다고 자동으로 고르지 않는다.

| 스킬         | 하는 일                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/add-issue` | 확인된 버그와 결정이 끝난 작업을 GitHub 이슈로 남긴다. 근본 원인을 증명하고 기본 브랜치와 대조한 뒤 기록만 한다 — **구현은 하지 않는다.** |
| `/write-prd` | 기능 아이디어를 결정 원장(decision ledger)으로 훑어 빈칸 없는 PRD 이슈로 만든다. 열린 행이 하나라도 남으면 이슈를 만들지 않는다.          |
| `/repair-pr` | PR 한 번 복구. 머지 충돌 → 봇 리뷰 스레드 → CI 실패 순으로, 문제마다 커밋을 나누고 마지막에 한 번만 push한다.                             |

### `/repair-pr`와 `/pr-fix`

겹치지 않는다. `/repair-pr`은 **한 번의 기계적 복구 패스**(빨간 PR을 초록으로),
`/pr-fix`는 **넓이**(코멘트 전량 페이지네이션 후 여러 라운드로 수렴). 코멘트가 많이
쌓인 PR에는 `/pr-fix`, 충돌·CI로 막힌 PR에는 `/repair-pr`.

### 리뷰 봇 전제

`/repair-pr`의 리뷰 피드백 단계는 봇이 남긴 인라인 스레드를 읽는다. **이 저장소에는
아직 리뷰 워크플로가 없어서 그 단계는 0건으로 지나간다** — 머지 충돌과 CI 복구는
지금도 동작한다. `.github/workflows/claude-code-review.yml`(과 그 API 시크릿)을
붙이면 나머지 단계도 켜진다. 다른 봇을 쓴다면 헬퍼를 고치지 말고
`REPAIR_PR_REVIEW_AUTHOR` 환경변수를 설정한다.
