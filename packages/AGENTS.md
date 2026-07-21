# AGENTS.md

## Project

- Node.js monorepo (`jilatax-monorepo`).
- Android-first application framework for Lynx/Rspeedy.
- Bun workspaces; lockfile is `bun.lock` at root.

## Package manager

- Use `bun` for this workspace. The lockfile is `bun.lock`.
- Run package scripts with `bun <script>`.

## Architecture

- Three publishable packages under `packages/`:
  - `jilatax` — public API, config, Android host. Build first: `bun run build` in `packages/jilatax`.
  - `@jilatax/cli` — CLI commands; depends on `jilatax`. Build after `jilatax`.
  - `create-jilatax` — project scaffolder; depends on `jilatax`. Build after `jilatax`.
- `apps/website` — Astro marketing site; separate lockfile, not part of packages workspace.
- Build tool: `tsdown` (ESM + CJS + DTS output via `tsdown.config.ts` per package).

## Commands

### Per-package (run inside `packages/<name>`)

```
bun run build        # tsdown → dist/
bun run typecheck    # tsc --noEmit
bun run test         # build + smoke test (node test/smoke.mjs)
bun run check        # typecheck + test
```

### Build order when verifying everything

```
cd packages/jilatax && bun run build && cd ../cli && bun run build && cd ../create-jilatax && bun run build
```

Or one-liner:

```
bun run --filter jilatax build && bun run --filter @jilatax/cli build && bun run --filter create-jilatax build
```

## Runtime assets and packaging

- TypeScript: module `NodeNext`, target `ES2022`, strict mode.
- Node.js requirement: `>=22.18.0` (engines field).
- Dual ESM/CJS exports; `tsdown` config enables `publint` (strict) and `@arethetypeswrong/core` (error).

## CI / Publishing

- Tag-based publishes in `.github/workflows/`:
  - `v*` → publishes `jilatax`
  - `cli-v*` → builds `jilatax` first, then publishes `@jilatax/cli`
  - `create-jilatax-v*` → builds `jilatax` first, then publishes `create-jilatax`
- All workflows run `bun install` then `bun run build` in `packages/jilatax` before building downstream packages.

## Comment style

- Never place comments on the first two lines of a source file; start with imports or declarations.
- Prefer concise section headings such as `// ── Constants ──` or a three-line banner for major sections so files remain easy to scan.
- Use JSDoc blocks only when an API, intent, edge case, or constraint needs explanation; do not restate the code.

## Caveats

- No linter detected — no `lint` script, no ESLint config.
- No formatter detected — no Prettier config or format script (`.prettierignore` exists but no Prettier config found).
- Tests are smoke tests only (`test/smoke.mjs`); no unit test runner or test framework.

## Boundaries

- Prefer existing local patterns and helper APIs before adding new abstractions.
- Keep generated, packaged, and runtime asset boundaries intact; do not move files across host/webview ownership without updating build and packaging config.
- `apps/` and `packages/` are separate workspace groups; apps are deployable, packages are publishable to npm.

## Comment style

- Never place comments on the first two lines of a source file; start with imports or declarations.
- Prefer concise section headings such as `// ── Constants ──` or a three-line banner for major sections so files remain easy to scan.
- Use JSDoc blocks only when an API, intent, edge case, or constraint needs explanation; do not restate the code.
