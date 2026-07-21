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
5. creates and verifies `adb reverse` after installation;
6. launches the Jilatax activity with an explicit bundle source; and
7. watches successful Rspeedy rebuilds and automatically refreshes the app over
   the existing USB connection.

Use `--device <serial>` when multiple devices are connected, `--port <number>`
to select another development port, or `--packaged` to skip the server and open
the bundled Lynx application.

Keep the command running while you edit the project. Rspeedy continues to use
its HMR pipeline, while the CLI verifies the rebuilt bundle and relaunches the
Android activity as a reliable device fallback. Compilation errors do not
reload the last working app, and `Ctrl+C` stops the session.

The development server started by this command removes the QR code plugin from
the project's Lynx configuration; run `bun run dev` in another terminal when
you want the scannable QR code instead.

### `jilatax create:aab`

This builds the production Lynx bundle, copies the output into Android assets,
and runs Gradle's `:app:bundleRelease` task. The resulting file is reported from
`android/app/build/outputs/bundle/release/app-release.aab`.

Signing secrets remain in ignored Android Gradle properties; they are never
accepted as CLI arguments or stored by this package.

## Programmatic API

```ts
import { createAab, runAndroid } from '@jilatax/cli';

const development = await runAndroid({ projectRoot: process.cwd() });
// Keep the process running while developing, then stop the returned session.
development.liveReload?.stop();
await createAab({ projectRoot: process.cwd() });
```

## Development

```bash
bun install
bun run check
```

## License

MIT
