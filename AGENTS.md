# AGENTS.md

## Project

- Node.js package.
- Language: TypeScript.

## Package manager

- Use `bun` for this workspace. The lockfile is `bun.lock`.
- Run package scripts with `bun <script>`.

## Architecture

- Project: jilatax-monorepo.

## Runtime assets and packaging

- TypeScript uses module `NodeNext`, target `ES2022`, strict mode.

## Comment style

- Never place comments on the first two lines of a source file; start with imports or declarations.
- Prefer concise section headings such as `// ── Constants ──` or a three-line banner for major sections so files remain easy to scan.
- Use JSDoc blocks only when an API, intent, edge case, or constraint needs explanation; do not restate the code.

## Caveats

- No linter detected — no `lint` script, no ESLint config.
- No test runner configured — no `test` script or test config found.
- No formatter detected — no Prettier config or format script.

## Boundaries

- Prefer existing local patterns and helper APIs before adding new abstractions.
- Keep generated, packaged, and runtime asset boundaries intact; do not move files across host/webview ownership without updating build and packaging config.
