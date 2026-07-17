# @jilatax/cli

Android build and device orchestration for Jilatax applications.

The CLI requires Node.js 22.18 or newer. Generated projects expose it through
package scripts, so Bun users run:

```bash
bun run run:android
bun run create:aab
```

## Commands

### `jilatax run:android`

The development command:

1. validates `app.json` and selects one authorized Android device;
2. starts or reuses the Rspeedy server on `127.0.0.1:5969`;
3. builds and synchronizes `main.lynx.bundle` into `.jilatax/android-assets`;
4. assembles and installs the debug APK without launching it;
5. creates and verifies `adb reverse` after installation; and
6. launches the Jilatax activity exactly once with an explicit bundle source.

Use `--device <serial>` when multiple devices are connected, `--port <number>`
to select another development port, or `--packaged` to skip the server and open
the bundled Lynx application.

### `jilatax create:aab`

This builds the production Lynx bundle, copies the output into Android assets,
and runs Gradle's `:app:bundleRelease` task. The resulting file is reported from
`android/app/build/outputs/bundle/release/app-release.aab`.

Signing secrets remain in ignored Android Gradle properties; they are never
accepted as CLI arguments or stored by this package.

## Programmatic API

```ts
import { createAab, runAndroid } from '@jilatax/cli';

await runAndroid({ projectRoot: process.cwd() });
await createAab({ projectRoot: process.cwd() });
```

## Development

```bash
bun install
bun run check
```

## License

MIT
