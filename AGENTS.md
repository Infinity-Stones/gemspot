# Repository Guidelines

## Project Structure & Module Organization

Gemspot uses Next.js, React, and TypeScript for extracting places, saving spots,
and planning routes. Read `README.md` and `CLAUDE.md` first.

- `src/app/`: App Router pages, layouts, server actions, and API routes.
- `src/components/`, `src/hooks/`: UI components and React hooks.
- `src/domain/{extraction,spot,route}/`: independent business domains.
- `src/lib/platform/`: external API, storage, and environment adapters.
- `src/shared/`: dependency-free contracts, constants, and pure utilities.
- `public/brand/`: images; `src/styles/`: global CSS; `docs/`: flows and screenshots;
  `supabase/migrations/`: database migrations. Tests sit beside their source files.

UI imports domains through their `index.ts` barrels, never platform adapters
directly. Domains may use platform and shared modules but cannot import each
other; coordinate them in the app layer.

## Build, Test, and Development Commands

Use Node.js 24.20.0 and pnpm 12.3.1, pinned in `.tool-versions`.

- `pnpm install`: install dependencies and generate Panda's `styled-system/`.
- `pnpm dev`: start development at `http://localhost:3000`.
- `pnpm build`: generate Panda output and build production; `pnpm start` serves it.
- `pnpm lint`: enforce ESLint rules with zero warnings allowed.
- `pnpm check-types`: generate Next.js types and check production/test TypeScript.
- `pnpm test`: run Vitest once; `pnpm test:watch` watches changes.
- `pnpm test:coverage`: generate coverage reports.
- `pnpm format` / `pnpm format:check`: apply/check Prettier formatting.

Run lint, type checks, tests, and build before commits.

## Coding Style & Naming Conventions

Use strict TypeScript. Prettier uses two spaces, single quotes, semicolons, trailing commas, and an
80-character print width. Use PascalCase component files (`BackLink.tsx`),
camelCase utilities, `use`-prefixed hooks, `@/` imports, and `import type`.

Follow `DESIGN.md` using registered Panda tokens; `ui.*` tokens handle both themes. Never edit or commit generated
`styled-system/`. Inline `eslint-disable` is forbidden; justified exceptions belong
in `eslint.config.mts`. Consult bundled `node_modules/next/dist/docs/` for Next.js APIs.

## Testing Guidelines

Name colocated tests `*.test.ts` or `*.test.tsx` (`*.spec.*` also works).
Vitest uses Node for shared/platform/domain tests and jsdom with React Testing
Library for UI tests. No coverage threshold is configured. Test failure paths
and regressions. Keep test globs aligned across `vitest.config.mts`,
`tsconfig.test.json`, and `eslint.config.mts`.

## Commit & Pull Request Guidelines

Follow history's `type(scope): summary` pattern, commonly with Korean summaries:
`feat(spot): ...`, `fix(route): ...`, `design(404): ...`. Keep one problem per
commit; explain decisions in the body. Omit AI attribution trailers.

PRs should describe changes, link issues, report validation, and include UI
screenshots, checking both themes.

## Security & Configuration

Keep secrets in `.env.local`; never commit them or expose them through
`NEXT_PUBLIC_`. Read environment variables only through `src/lib/platform/env.ts`.
