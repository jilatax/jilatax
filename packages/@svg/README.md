# @jilatax/svg

Compile imported SVG icons into typed ReactLynx components for Jilatax applications.
The compilation happens during the Rspeedy build, so the XML parser never ships in
the Lynx application bundle.

Requires Node.js 22.18 or newer.

## Install

```bash
bun add @jilatax/svg
```

## Configure Rspeedy

Add the SVG plugin before the ReactLynx plugin in `lynx.config.ts`:

```ts
import { pluginJilataxSvg } from '@jilatax/svg/plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [pluginJilataxSvg(), pluginReactLynx()],
});
```

Enable TypeScript declarations in `src/rspeedy-env.d.ts`:

```ts
import '@jilatax/svg/types';
import '@lynx-js/rspeedy/client';
```

## Use an icon

```tsx
import HomeIcon, { svg as homeSvg } from './icons/home.svg';

export function HomeButton() {
  return (
    <HomeIcon
      accessibility-label="Home"
      color="#22C55E"
      size={24}
    />
  );
}

console.log(homeSvg.viewBox);
```

Plain `.svg` imports become components. The generated component accepts `size`,
`width`, `height`, `color`, `style`, and native Lynx SVG accessibility properties.
The named `svg` export exposes the compiled representation when a custom renderer
needs it.

The plugin uses `currentColor` by default, which is ideal for bottom bars and
single-color buttons. Preserve an SVG's original palette when needed:

```ts
pluginJilataxSvg({ paint: 'preserve' });
```

Rspeedy's standard `?url`, `?inline`, and `?raw` imports are left untouched:

```ts
import source from './illustration.svg?raw';
import url from './illustration.svg?url';
```

## Compiler API

The build-independent API can validate and normalize SVG source directly:

```ts
import { compileSvg, createSvgModule } from '@jilatax/svg';

const icon = compileSvg(source, {
  paint: 'currentColor',
  sourceName: 'home.svg',
});

const moduleSource = createSvgModule(source, {
  exportName: 'homeIcon',
});
```

The compiler accepts the SVG subset implemented by Lynx, normalizes `viewBox`,
inlines supported style declarations, validates internal references, and rejects
scripts, event handlers, unsafe URLs, unsupported elements, and excessive input.
External `<image>` resources are disabled unless explicitly enabled.

## Development and production

During `bun run run:android`, Rspeedy watches imported SVG files. Saving an icon
recompiles the affected module, and the Jilatax CLI's live-reload flow delivers the
updated Lynx bundle to the Android app without a Gradle rebuild.

For production, the normalized SVG content is embedded in the Lynx bundle and
rendered by Lynx's native `<svg>` element. It is not emitted as an Android
`VectorDrawable` resource, so the same component boundary remains valid if Jilatax
adds another Lynx platform later.

## Development

```bash
bun run check
npm pack --dry-run
```

## License

MIT
