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
    "icon": "./public/assets/icon.png",
    "scheme": "mylynxapp",
    "userInterfaceStyle": "automatic",
    "splash": {
      "backgroundColor": "#208AEF",
      "image": "./public/assets/splash-icon.png",
      "imageWidth": 76
    },
    "android": {
      "package": "com.example.mylynxapp",
      "versionCode": 1,
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./public/assets/icon.png"
      },
      "predictiveBackGestureEnabled": false
    }
  }
}
```

`parseAppConfig` and `loadAppConfig` validate and normalize this file. `defineConfig` is also
exported for typed programmatic configuration, although `app.json` is the default public format.
Before Gradle runs, `syncAndroidProjectConfig` writes the normalized Android metadata to
`android/jilatax.properties` and prepares launcher and splash resources under
`.jilatax/android-res`; generated native projects consume those outputs instead of parsing
application configuration independently. PNG, JPEG, and WebP project-relative image paths are
supported. Generated resources are disposable and should remain ignored by version control.

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

The host also provides the native side of Jilatax themes. It persists the user's Light, Dark, or
System preference, exposes both the preference and resolved theme to Lynx init data, reacts to
device-theme changes while System is selected, and keeps the Android status and navigation bars in
sync. The configured `userInterfaceStyle` is used only as the initial default before a user
preference exists. The visible Lynx host opts out of Android Force Dark so explicit app themes are
not recolored by the operating system.

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
