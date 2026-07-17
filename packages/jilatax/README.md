# jilatax

Android-first application infrastructure for Lynx and Rspeedy.

Jilatax currently provides the configuration contract and the first native Android host boundary.
The command workflow and project creator are implemented separately in `@jilatax/cli` and
`create-jilatax`.

Requires Node.js 22.18 or newer. Android is the only supported native platform in this phase.

## Install

```bash
npm i jilatax
```

## Usage

```ts
import { loadAppConfig } from "jilatax";

const { config } = await loadAppConfig();
console.log(config.jilatax.android.package);
```

## Application configuration

The default configuration file is `app.json` in the generated project root:

```json
{
  "$schema": "./node_modules/jilatax/schema/app.schema.json",
  "jilatax": {
    "name": "My Lynx App",
    "slug": "my-lynx-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "mylynxapp",
    "userInterfaceStyle": "automatic",
    "splash": {
      "backgroundColor": "#208AEF",
      "image": "./assets/splash.png",
      "imageWidth": 76
    },
    "android": {
      "package": "com.example.mylynxapp",
      "versionCode": 1,
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    }
  }
}
```

`parseAppConfig` and `loadAppConfig` validate and normalize this file. `defineConfig` is also
exported for typed programmatic configuration, although `app.json` is the default public format.

## Android host

The npm package ships a Gradle library under `android/`. It provides the first Jilatax-owned native
host while using Sparkling as a pinned upstream runtime dependency during this phase.

Its bundle-source rules are deliberately strict:

- release builds always use the packaged `main.lynx.bundle` asset;
- debug builds use that packaged asset unless the CLI explicitly supplies a development URL;
- the development URL is never persisted on the device;
- Sparkling's debug tool and blue floating inspector are not included.

The Android host is consumed by the CLI and generated application template; application projects
do not need to locate it manually.

## Development

```bash
bun install
bun run check
```

## 📄 License

MIT © [JilataX](https://jilatax.dev) — see [`LICENSE`](./LICENSE).

<br>

---

<div align="center">
  <p>
    Built with <strong>Bun</strong>, <strong>TypeScript</strong>, <strong>Android</strong>, and <strong>Lynx</strong>.
  </p>
  <p>
    <a href="https://www.jilatax.dev/jilatax">Website</a> ·
    <a href="https://github.com/jilatax/jilatax">GitHub</a> ·
    <a href="https://www.npmjs.com/package/jilatax">npm</a>
  </p>
</div>
