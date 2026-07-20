# AGENTS.md

## Project

- Android-first Lynx application generated with Jilatax.
- Stack: TypeScript, Lynx, React, Rspeedy, and the Jilatax CLI.
- This project is self-contained. Its `package.json`, `bun.lock`, `app.json`, source tree, and Android project belong to this app only.
- If the parent directory contains other generated apps, treat them as independent projects. Do not edit or run commands in sibling apps unless explicitly requested.

## Requirements

- Node.js `>=22.18.0`.
- Bun `1.3.4`, as pinned in `package.json`.
- Android SDK, Java, and ADB are required only for Android commands.

## Package manager

- Use Bun exclusively.
- Run commands from this project root, where `package.json` and `app.json` live.
- Run `bun install` after cloning or whenever dependencies are missing.
- Keep `bun.lock` committed and never commit `node_modules/`.

## Commands

| Action | Command | Notes |
| --- | --- | --- |
| Install dependencies | `bun install` | Run from this project root |
| Development server | `bun run dev` | Starts Rspeedy and prints the Lynx QR code |
| Production bundle | `bun run build` | Builds the Lynx bundle into `dist/` |
| Typecheck | `bun run typecheck` | Runs `tsc -b` |
| Run on Android | `bun run run:android` | Builds, installs, configures ADB reverse, and launches the debug app |
| Production AAB | `bun run create:aab` | Requires Android signing configuration |

- No lint, test, or format scripts are configured. Do not invent substitute commands and report these checks as passed.

## Architecture

- `src/index.tsx` is the runtime entry point and renders `src/app/App.tsx`.
- `src/app/App.tsx` owns the active-tab state and screen composition.
- `src/app/navigation.ts` defines the valid app tabs.
- `src/screens/` contains screen-level components: Home, About, and Setting.
- `src/components/` contains reusable UI and navigation components.
- `src/components/navigation/BottomBar.css` is colocated with the bottom navigation; shared app styles live in `src/styles/global.css`.
- `src/assets/` contains assets imported by application source, such as the interactive logo image.
- `public/assets/` contains launcher and splash artwork referenced by `app.json`.
- `public/fonts/` contains fonts loaded by CSS.
- `lynx.config.ts` configures Rspeedy, React Lynx, QR development, bundle naming, and the required `asset:///` prefix.
- `app.json` is the source of truth for Jilatax application and Android metadata.
- `android/` contains the committed native project and Gradle wrapper. Jilatax synchronizes configuration and resources before Android builds.
- `android/app/src/main/java/dev/jilatax/app/` bridges the Android device theme into Lynx init data and restarts the task when the device theme changes.

## Implementation conventions

- Prefer the existing `app`, `screens`, and `components` boundaries before introducing new abstractions.
- Keep screen orchestration in `App.tsx`, tab types in `navigation.ts`, and reusable presentation in `components/`.
- Follow the existing `.js` suffix convention for relative TypeScript imports.
- Use Lynx elements and events such as `<view>`, `<text>`, `<image>`, and `bindtap`; do not assume browser DOM APIs or React DOM event names.
- Keep component-specific styles colocated when they are not shared. Put only cross-app styles and theme variables in `src/styles/global.css`.
- Import source assets from `src/assets/`. Keep launcher and splash paths stable unless `app.json` is updated at the same time.
- Preserve `output.assetPrefix: 'asset:///'` in `lynx.config.ts`; Android bundle loading depends on it.

## Generated and sensitive files

- Treat `dist/`, `.jilatax/`, `android/**/build/`, `android/.gradle/`, and `*.tsbuildinfo` as generated output, not source of truth.
- Do not hand-edit generated resources under `.jilatax/`; change `app.json` or the referenced public assets and let Jilatax regenerate them.
- Never commit `android/keystore.properties`, `*.jks`, `*.keystore`, `android/local.properties`, environment files, or credentials.
- Use `android/keystore.properties.example` as the signing configuration reference.

## Validation

- Run `bun run typecheck` after TypeScript or configuration changes.
- Run `bun run build` after source, style, asset, or Rspeedy configuration changes.
- Run Android commands only when the task affects native behavior or explicitly requires device/build verification.
- Report unavailable checks clearly; do not claim lint or tests passed because neither is configured.

## Comment style

- Never place comments on the first two lines of a source file; start with imports or declarations.
- Prefer concise section headings such as `// ── Constants ──` or a three-line banner for major sections.
- Use JSDoc only when an API, intent, edge case, or constraint needs explanation; do not restate the code.
