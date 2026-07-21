# AGENTS.md — `jilatax`

Core library package. Build this first; `@jilatax/cli` and `create-jilatax` depend on it.

## Commands

```
bun run build       # tsdown → dist/
bun run typecheck   # tsc --noEmit
bun run test        # build + node test/smoke.mjs
bun run check       # typecheck + test
```

## What this package exports

- `parseAppConfig`, `loadAppConfig`, `defineConfig`, `JilataxConfigError` — config loading and validation (`src/config.ts`).
- `resolveAndroidProjectPath`, `resolveAppSchemaPath`, `resolveAndroidBundleSource` — path and bundle resolution (`src/android.ts`).
- `syncAndroidProjectConfig`, `serializeAndroidProjectConfig` — Android resource/properties sync (`src/android-project.ts`).
- `DEFAULT_ANDROID_BUNDLE`, `ANDROID_BUNDLE_SOURCE_EXTRA` — constants (`src/android.ts`).

## Key files

- `src/index.ts` — barrel; all public exports.
- `src/config.ts` — `parseAppConfig` normalizes and validates raw `app.json` input.
- `src/android.ts` — Android project path resolution, bundle source logic.
- `src/android-project.ts` — generates `.properties` and syncs drawable/mipmap resources.
- `schema/app.schema.json` — JSON Schema for `app.json`; shipped in the npm package.
- `android/` — bundled Android host project (Kotlin). Gradle wrapper included; do not commit `android/build/`.
- `test/smoke.mjs` — comprehensive smoke test: config parsing, asset sync, schema validation, CJS interop.

## Build notes

- `tsdown` outputs ESM (`dist/index.js`), CJS (`dist/index.cjs`), and DTS.
- `publint: { strict: true }` and `attw: { level: 'error' }` run during build; fix any errors before merging.
- The `android/` directory is included in the published npm package (`files` field in `package.json`).

## CI

- Tag `v*` triggers publish via `.github/workflows/publish.yml`.
