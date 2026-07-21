import {
  compileSvg,
  type CompileSvgOptions,
  type CompiledSvg,
} from './compiler.js';

export interface PluginJilataxSvgOptions
  extends Omit<CompileSvgOptions, 'sourceName'> {}

interface TransformContext {
  readonly code: string;
  readonly resourcePath: string;
}

interface TransformDescriptor {
  readonly resourceQuery: RegExp;
  readonly test: RegExp;
}

interface BundlerChain {
  readonly module: {
    rule(name: string): {
      readonly oneOfs: {
        delete(name: string): void;
      };
      test(pattern: RegExp): void;
    };
  };
}

interface RsbuildPluginApi {
  modifyBundlerChain(handler: (chain: BundlerChain) => void): void;
  transform(
    descriptor: TransformDescriptor,
    handler: (context: TransformContext) => string,
  ): void;
}

export interface JilataxSvgPlugin {
  readonly name: 'jilatax:svg';
  setup(api: RsbuildPluginApi): void;
}

export function pluginJilataxSvg(
  options: PluginJilataxSvgOptions = {},
): JilataxSvgPlugin {
  return {
    name: 'jilatax:svg',
    setup(api: RsbuildPluginApi): void {
      api.modifyBundlerChain((chain) => {
        chain.module.rule('svg').oneOfs.delete('svg-asset');
        chain.module
          .rule('js')
          .test(/\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts|svg)$/u);
      });
      api.transform({ resourceQuery: /^$/u, test: /\.svg$/u }, ({ code, resourcePath }) =>
        svgComponentModule(
          compileSvg(code, {
            allowExternalResources: options.allowExternalResources,
            paint: options.paint ?? 'currentColor',
            sourceName: resourcePath,
            stripDimensions: options.stripDimensions,
          }),
          componentName(resourcePath),
        ),
      );
    },
  };
}

export function svgComponentModule(
  svg: CompiledSvg,
  displayName: string,
): string {
  const value = JSON.stringify(svg)
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
  return [
    "import { resolveSvgIconProps } from '@jilatax/svg/react';",
    `export const svg = Object.freeze(${value});`,
    `function ${displayName}(props) {`,
    '  return <svg {...resolveSvgIconProps({ ...props, icon: svg })} />;',
    '}',
    `export default ${displayName};`,
    '',
  ].join('\n');
}

function componentName(filePath: string): string {
  const fileName = filePath.split(/[\\/]/u).at(-1)?.replace(/\.svg$/iu, '') ?? 'svg';
  const name = fileName
    .split(/[^A-Za-z\d]+/u)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('');
  const safeName = /^\d/u.test(name) ? `Svg${name}` : name || 'Svg';
  return safeName.endsWith('Icon') ? safeName : `${safeName}Icon`;
}
