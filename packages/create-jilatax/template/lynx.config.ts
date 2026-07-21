import { pluginJilataxSvg } from '@jilatax/svg/plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  output: {
    assetPrefix: 'asset:///',
    filename: {
      bundle: '[name].lynx.bundle',
    },
  },
  plugins: [
    pluginJilataxSvg(),
    pluginQRCode({
      schema(url: string): string {
        return `${url}?fullscreen=true`;
      },
    }),
    pluginReactLynx(),
  ],
});
