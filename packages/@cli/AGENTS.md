# AGENTS.md — `@jilatax/cli`

CLI package for Android build and device orchestration. Depends on `jilatax`.

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

- `runCli`, `helpText` — CLI entry and help text (`src/cli.ts`).
- `runAndroid`, `createAab`, `parseAdbDevices`, `selectAndroidDevice` — Android orchestration (`src/android.ts`).
- `CliError` — typed CLI error with `code` and `hint` fields (`src/errors.ts`).
- `defaultCliServices`, `CliServices` — process execution abstraction for testability (`src/process.ts`).
- `developmentBundleUrl`, `DEFAULT_DEV_SERVER_PORT`, `DEFAULT_LYNX_BUNDLE` — Rspeedy helpers (`src/rspeedy.ts`).
- `LiveReloadHandle` — live-reload interface (`src/live-reload.ts`).

## Key files

- `src/bin.ts` — `#!/usr/bin/env node` entry; calls `runCli()`. Must be executable (`chmod +x`).
- `src/cli.ts` — parses `run:android` and `create:aab` commands and their options.
- `src/android.ts` — ADB device selection, APK install, Gradle invocation, dev-server/live-reload wiring.
- `src/process.ts` — `CliServices` interface: `execute`, `fetch`, `log`, `warn`, `start`, `sleep`.
- `test/smoke.mjs` — fakes ADB/Rspeedy/Gradle to test the full CLI flow without real devices.

## CLI commands

| Command | Description |
|---------|-------------|
| `jilatax run:android` | Build, install, ADB reverse, and live-reload on device |
| `jilatax create:aab` | Build release Android App Bundle |

Options for `run:android`: `--device <serial>`, `--port <number>`, `--packaged`, `--project-root <path>`.

## Testing notes

- Smoke tests use fake services (no real Android device or SDK required).
- The `bin.js` shebang and `0o755` permissions are verified in the smoke test.
- The published `bin` field is `./dist/bin.js`; do not change this path.

## CI

- Tag `cli-v*` triggers publish via `.github/workflows/cli.yml`.
- CI builds `jilatax` first, then the CLI from `packages/@cli`.
