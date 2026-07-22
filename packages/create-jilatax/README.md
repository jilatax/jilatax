<div align="center">

  <a href="https://www.npmjs.com/package/create-jilatax">
    <img alt="create-jilatax logo" src="https://raw.githubusercontent.com/jilatax/jilatax/refs/heads/main/public/github/logo.png" height="128">
  </a>

<br>

<h1>create-jilatax</h1>

**Create Android-first Lynx applications powered by JilataX**

<br>

<a href="https://www.npmjs.com/package/create-jilatax"><img alt="NPM version" src="https://img.shields.io/npm/v/create-jilatax.svg?style=for-the-badge&logo=npm&color=16a34a&labelColor=18181b"></a>
<a href="https://www.npmjs.com/package/create-jilatax"><img alt="NPM Downloads" src="https://img.shields.io/npm/dm/create-jilatax.svg?style=for-the-badge&logo=npm&color=16a34a&labelColor=18181b"></a>
<a href="https://github.com/jilatax/jilatax/blob/main/packages/create-jilatax/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/create-jilatax.svg?style=for-the-badge&color=16a34a&labelColor=18181b"></a>
<a href="https://github.com/jilatax/jilatax/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/jilatax/jilatax.svg?style=for-the-badge&logo=github&color=16a34a&labelColor=18181b"></a>

</div>

---

## Quick Start

```bash
bun create jilatax@latest
```

```bash
cd my-app
bun run:android
```

The scaffolder derives the project name from the directory, then prompts for the Android package ID and dependency installation. In non-interactive environments:

```bash
bunx create-jilatax@latest my-app \
  --name "My App" \
  --package-id com.example.my_app \
  --skip-install
```

## What's Included

- Lynx and Rspeedy application setup
- `app.json` Jilatax configuration
- Android Gradle project linked to `jilatax/android`
- Light, Dark, and System theme selector synced with Android status/nav bars
- `bun run run:android` — development on a connected device
- `bun run create:aab` — Play Store Android App Bundle
- Compiled SVG icons via `@jilatax/svg` with incremental Rspeedy rebuilds

## Programmatic API

```ts
import { createProject } from 'create-jilatax';

await createProject({
  targetDirectory: './my-app',
  displayName: 'My App',
  packageId: 'com.example.my_app',
  install: false,
});
```

## Requirements

- Node.js >= 22.18.0
- [Bun](https://bun.sh)

## Development

```bash
bun install
bun run check
```

## License

MIT © [JilataX](https://jilatax.dev)
