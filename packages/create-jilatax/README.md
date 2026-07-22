# create-jilatax

Create an Android-first Lynx application backed by the Jilatax runtime and CLI.

Requires Node.js 22.18 or newer and Bun.

## Create an application

```sh
bun create jilatax@latest
```
---

```bash
bunx create-jilatax@latest my-app
cd my-app
bun run run:android
```

The creator derives the application name from the project directory, then asks
for the Android package ID and whether to install dependencies. Installation is
disabled by default. In non-interactive environments, pass the directory and
options explicitly:

```bash
bunx create-jilatax@latest my-app \
  --name "My App" \
  --package-id com.example.my_app \
  --skip-install
```

Generated projects include:

- a Lynx and Rspeedy application;
- `app.json` as the Jilatax application configuration;
- an Android Gradle project linked to `jilatax/android`;
- a persistent Light, Dark, and System theme selector synchronized with Android
  status and navigation bars;
- `bun run run:android` for development on a connected device; the generated
  APK is located at `android/app/build/outputs/apk/debug/app-debug.apk`;
- `bun run create:aab` for a Play Store Android App Bundle.

The creator only writes the project and can run `bun install`. Device, Gradle,
bundle, APK, and AAB orchestration belongs to `@jilatax/cli`. Imported SVG icons
are compiled by `@jilatax/svg`; the default bottom bar includes working examples
with incremental Rspeedy rebuilds.

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

## Development

```bash
bun install
bun run check
```

## License

MIT © [JilataX](https://jilatax.dev) — see [`LICENSE`](./LICENSE).
