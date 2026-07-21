import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    plugin: 'src/plugin.ts',
    react: 'src/react.ts',
    types: 'src/types.ts',
  },
  format: ['esm', 'cjs'],
  fixedExtension: false,
  dts: true,
  shims: true,
  publint: { strict: true },
  attw: { level: 'error' },
});
