import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    bin: 'src/bin.ts',
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  fixedExtension: false,
  dts: true,
  shims: true,
  publint: { strict: true },
  attw: { level: 'error' },
});
