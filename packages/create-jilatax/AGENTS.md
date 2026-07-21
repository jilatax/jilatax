# AGENTS.md — `create-jilatax`

Project scaffolder. Depends on `jilatax`.

## Build prerequisite

`jilatax` must be built first (`bun run build` in `packages/jilatax`).

## Commands

```
bun run build       # tsdown → dist/
bun run typecheck   # tsc --noEmit
bun run test        # build + node test/smoke.mjs
bun run check       # typecheck + test
```

## What this package exports

- `runCreateCli`, `createHelpText` — interactive CLI entry (`src/cli.ts`).
- `createProject` — generates a new project from the template (`src/generator.ts`).
- `normalizeProjectName`, `normalizeDisplayName`, `defaultPackageId`, `validatePackageId` — naming helpers (`src/generator.ts`).

## Key files

- `src/bin.ts` — `#!/usr/bin/env node` entry; calls `runCreateCli()`.
- `src/cli.ts` — interactive prompts via `@clack/prompts`; accepts project name, display name, package ID.
- `src/generator.ts` — copies `template/`, renders `*.tmpl` files, generates `package.json` and `app.json`, runs `syncAndroidProjectConfig`.
- `template/` — source template for generated projects. Files ending in `.tmpl` are rendered with `{{projectName}}` / `{{displayNameJson}}` tokens.

## Template conventions

- `template/gitignore` → copied as `.gitignore` (npm does not publish `.gitignore`).
- `template/README.md.tmpl` and `template/android/settings.gradle.kts.tmpl` are text-templated.
- `template/AGENTS.md` is copied into every generated project.
- `template/CLAUDE.md` contains `@AGENTS.md` (directive to load the AGENTS.md).
- The `template/android/` directory includes a base64-encoded `gradle-wrapper.jar.base64` that gets decoded at generation time.

## Testing notes

- Smoke tests verify: project generation, naming validation, template rendering, and CJS interop.
- No real Android SDK or device needed for tests.

## CI

- Tag `create-jilatax-v*` triggers publish via `.github/workflows/create-jilatax.yml`.
- CI builds `jilatax` first, then `create-jilatax`.
