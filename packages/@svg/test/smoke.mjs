import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import {
  SvgCompileError,
  applySvgColor,
  compileSvg,
  createSvgModule,
} from '@jilatax/svg';
import {
  pluginJilataxSvg,
  svgComponentModule,
} from '@jilatax/svg/plugin';

const source = `<svg width="24" height="24" viewBox="0, 0, 24, 24" role="img">
  <title>Home</title>
  <path id="home" style="fill:#112233;stroke:none" d="M2 2h20v20H2z" />
  <use href="#home" opacity="0.25" />
</svg>`;

const compiled = compileSvg(source, {
  paint: 'currentColor',
  sourceName: 'home.svg',
});
assert.equal(compiled.viewBox, '0 0 24 24');
assert.equal(compiled.width, '24');
assert.equal(compiled.height, '24');
assert.equal(
  compiled.content,
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2h20v20H2z" fill="currentColor" id="home" stroke="none"/><use href="#home" opacity="0.25"/></svg>',
);
assert.deepEqual(
  compiled.diagnostics.map(({ code }) => code),
  ['metadata-removed', 'metadata-removed', 'style-inlined'],
);
assert.match(applySvgColor(compiled.content, '#22C55E'), /fill="#22C55E"/u);
assert.throws(
  () => applySvgColor(compiled.content, 'url(javascript:alert(1))'),
  (error) =>
    error instanceof SvgCompileError && error.code === 'invalid-color',
);

const inferredViewBox = compileSvg(
  '<svg width="32px" height="18"><path d="M0 0h32v18H0z"/></svg>',
);
assert.equal(inferredViewBox.viewBox, '0 0 32 18');
assert.match(inferredViewBox.content, /viewBox="0 0 32 18"/u);
assert.doesNotMatch(inferredViewBox.content, /width=|height=/u);

assertCompileError(
  '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>',
  'unsupported-element',
);
assertCompileError(
  '<svg viewBox="0 0 24 24"><image href="https://example.com/icon.png"/></svg>',
  'external-resource',
);
assertCompileError(
  '<svg viewBox="0 0 24 24"><path id="same" d="M0 0"/><path id="same" d="M1 1"/></svg>',
  'duplicate-id',
);
assertCompileError(
  '<svg viewBox="0 0 24 24"><use href="#missing"/></svg>',
  'invalid-reference',
);
assertCompileError('<svg><path d="M0 0"/></svg>', 'missing-viewbox');
assertCompileError(
  '<!DOCTYPE svg><svg viewBox="0 0 24 24"/>',
  'invalid-svg',
);

const moduleSource = createSvgModule(source, {
  exportName: 'homeIcon',
  paint: 'currentColor',
});
assert.match(moduleSource, /export const homeIcon = Object\.freeze/u);
assert.match(moduleSource, /satisfies import\('@jilatax\/svg'\)\.CompiledSvg/u);
assert.match(moduleSource, /export default homeIcon/u);

let transform;
let scriptPattern;
const plugin = pluginJilataxSvg();
assert.equal(plugin.name, 'jilatax:svg');
plugin.setup({
  modifyBundlerChain(handler) {
    let deletedRule;
    handler({
      module: {
        rule(name) {
          return {
            oneOfs: {
              delete(ruleName) {
                assert.equal(name, 'svg');
                deletedRule = ruleName;
              },
            },
            test(pattern) {
              assert.equal(name, 'js');
              scriptPattern = pattern;
            },
          };
        },
      },
    });
    assert.equal(deletedRule, 'svg-asset');
    assert.match('icon.svg', scriptPattern);
    assert.match('component.tsx', scriptPattern);
  },
  transform(descriptor, handler) {
    assert.match('home.svg', descriptor.test);
    assert.match('', descriptor.resourceQuery);
    transform = handler;
  },
});
assert.equal(typeof transform, 'function');
const componentModule = transform({
  code: source,
  resourcePath: '/project/src/icons/home.svg',
});
assert.match(componentModule, /resolveSvgIconProps/u);
assert.match(componentModule, /function HomeIcon/u);
assert.match(componentModule, /<svg/u);
assert.match(componentModule, /HomeIcon/u);
assert.match(componentModule, /currentColor/u);
assert.equal(
  svgComponentModule(compiled, 'CustomIcon').endsWith('\n'),
  true,
);

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
assert.equal(packageJson.name, '@jilatax/svg');
assert.match(packageJson.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);

const require = createRequire(import.meta.url);
const cjs = require('@jilatax/svg');
const cjsPlugin = require('@jilatax/svg/plugin');
assert.equal(cjs.compileSvg('<svg viewBox="0 0 1 1"/>').viewBox, '0 0 1 1');
assert.equal(cjsPlugin.pluginJilataxSvg().name, 'jilatax:svg');

console.log('smoke test passed');

function assertCompileError(svg, code) {
  assert.throws(
    () => compileSvg(svg),
    (error) => error instanceof SvgCompileError && error.code === code,
  );
}
