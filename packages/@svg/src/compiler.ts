import { SaxesParser, type SaxesTagPlain } from 'saxes';

import { SvgCompileError } from './errors.js';
import { escapeXml } from './xml.js';

export type SvgPaintMode = 'currentColor' | 'preserve';

export type SvgDiagnosticCode = 'metadata-removed' | 'style-inlined';

export interface SvgDiagnostic {
  readonly code: SvgDiagnosticCode;
  readonly message: string;
}

export interface CompileSvgOptions {
  readonly allowExternalResources?: boolean;
  readonly paint?: SvgPaintMode;
  readonly sourceName?: string;
  readonly stripDimensions?: boolean;
}

export interface CompiledSvg {
  readonly content: string;
  readonly diagnostics: readonly SvgDiagnostic[];
  readonly height?: string;
  readonly viewBox: string;
  readonly width?: string;
}

export interface CreateSvgModuleOptions extends CompileSvgOptions {
  readonly exportName?: string;
}

interface SvgElementNode {
  readonly attributes: Map<string, string>;
  readonly children: Array<SvgElementNode | string>;
  readonly name: string;
}

interface NormalizeAttributesContext {
  readonly allowExternalResources: boolean;
  readonly diagnostics: SvgDiagnostic[];
  readonly elementName: string;
  readonly paint: SvgPaintMode;
  readonly sourceName: string | undefined;
}

const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_ELEMENTS = 1_024;
const MAX_DEPTH = 64;

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

const SUPPORTED_ELEMENTS = new Set([
  'circle',
  'clipPath',
  'defs',
  'ellipse',
  'g',
  'image',
  'line',
  'linearGradient',
  'path',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'stop',
  'svg',
  'text',
  'use',
]);

const METADATA_ELEMENTS = new Set(['desc', 'metadata', 'title']);

const SUPPORTED_ATTRIBUTES = new Set([
  'clip-path',
  'clip-rule',
  'clipPathUnits',
  'color',
  'cx',
  'cy',
  'd',
  'fill',
  'fill-opacity',
  'fill-rule',
  'font-size',
  'fx',
  'fy',
  'gradientTransform',
  'gradientUnits',
  'height',
  'href',
  'id',
  'offset',
  'opacity',
  'points',
  'preserveAspectRatio',
  'r',
  'rx',
  'ry',
  'spreadMethod',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'style',
  'transform',
  'viewBox',
  'width',
  'x',
  'x1',
  'x2',
  'xlink:href',
  'xmlns',
  'xmlns:xlink',
  'y',
  'y1',
  'y2',
]);

const STYLE_ATTRIBUTES = new Set([
  'color',
  'fill',
  'fill-opacity',
  'fill-rule',
  'opacity',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
]);

const PAINT_ATTRIBUTES = new Set([
  'color',
  'fill',
  'stop-color',
  'stroke',
]);

const OMITTED_METADATA_ATTRIBUTES = new Set([
  'aria-hidden',
  'aria-label',
  'focusable',
  'role',
  'version',
]);

const JAVASCRIPT_URL_PATTERN = /(?:^|[\s('"=])javascript\s*:/iu;
const INTERNAL_URL_PATTERN = /url\(\s*#([^\s)'"<>]+)\s*\)/giu;
const ANY_URL_PATTERN = /url\(([^)]*)\)/giu;
const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/u;
const XML_ID_PATTERN = /^[A-Za-z_][A-Za-z\d_.:-]*$/u;
export function compileSvg(
  source: string,
  options: CompileSvgOptions = {},
): CompiledSvg {
  const sourceName = options.sourceName;
  if (source.trim().length === 0) {
    throw new SvgCompileError('empty-source', 'SVG source cannot be empty.', sourceName);
  }
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    throw new SvgCompileError(
      'source-too-large',
      `SVG source exceeds the ${MAX_SOURCE_BYTES / 1024} KiB icon limit.`,
      sourceName,
    );
  }

  const diagnostics: SvgDiagnostic[] = [];
  const allowExternalResources = options.allowExternalResources === true;
  const paint = options.paint ?? 'preserve';
  const stack: SvgElementNode[] = [];
  let ignoredDepth = 0;
  let elementCount = 0;
  let root: SvgElementNode | undefined;

  const parser = new SaxesParser({ xmlns: false });
  parser.on('doctype', () => {
    throw new SvgCompileError(
      'invalid-svg',
      'DOCTYPE declarations are not allowed in SVG icons.',
      sourceName,
    );
  });
  parser.on('opentag', (tag: SaxesTagPlain) => {
    if (ignoredDepth > 0) {
      ignoredDepth += 1;
      return;
    }
    if (METADATA_ELEMENTS.has(tag.name)) {
      ignoredDepth = 1;
      diagnostics.push({
        code: 'metadata-removed',
        message: `Removed <${tag.name}> metadata from the icon.`,
      });
      return;
    }
    if (!SUPPORTED_ELEMENTS.has(tag.name)) {
      throw new SvgCompileError(
        'unsupported-element',
        `<${tag.name}> is not supported by Lynx SVG.`,
        sourceName,
      );
    }
    if (tag.name === 'image' && !allowExternalResources) {
      throw new SvgCompileError(
        'external-resource',
        '<image> requires allowExternalResources because it embeds another asset.',
        sourceName,
      );
    }

    elementCount += 1;
    if (elementCount > MAX_ELEMENTS || stack.length >= MAX_DEPTH) {
      throw new SvgCompileError(
        'source-too-complex',
        `SVG icons are limited to ${MAX_ELEMENTS} elements and ${MAX_DEPTH} levels.`,
        sourceName,
      );
    }

    const node: SvgElementNode = {
      attributes: normalizeAttributes(tag.attributes, {
        allowExternalResources,
        diagnostics,
        elementName: tag.name,
        paint,
        sourceName,
      }),
      children: [],
      name: tag.name,
    };
    const parent = stack.at(-1);
    if (parent === undefined) {
      if (root !== undefined) {
        throw new SvgCompileError(
          'invalid-root',
          'SVG source must contain exactly one root element.',
          sourceName,
        );
      }
      root = node;
    } else {
      parent.children.push(node);
    }
    stack.push(node);
  });
  parser.on('text', (text: string) => {
    if (ignoredDepth > 0 || text.trim().length === 0) return;
    const parent = stack.at(-1);
    if (parent?.name !== 'text') {
      throw new SvgCompileError(
        'invalid-svg',
        'Text content is only allowed inside <text>.',
        sourceName,
      );
    }
    parent.children.push(text);
  });
  parser.on('cdata', (text: string) => {
    if (ignoredDepth > 0) return;
    const parent = stack.at(-1);
    if (parent?.name !== 'text') {
      throw new SvgCompileError(
        'invalid-svg',
        'CDATA content is only allowed inside <text>.',
        sourceName,
      );
    }
    parent.children.push(text);
  });
  parser.on('closetag', () => {
    if (ignoredDepth > 0) {
      ignoredDepth -= 1;
      return;
    }
    stack.pop();
  });
  parser.on('error', (error: Error) => {
    throw new SvgCompileError(
      'invalid-svg',
      `Invalid SVG XML: ${error.message}`,
      sourceName,
      { cause: error },
    );
  });

  try {
    parser.write(source).close();
  } catch (error) {
    if (error instanceof SvgCompileError) throw error;
    throw new SvgCompileError(
      'invalid-svg',
      `Invalid SVG XML: ${errorMessage(error)}`,
      sourceName,
      { cause: error },
    );
  }

  if (root === undefined || root.name !== 'svg') {
    throw new SvgCompileError(
      'invalid-root',
      'The root element must be <svg>.',
      sourceName,
    );
  }

  const width = root.attributes.get('width');
  const height = root.attributes.get('height');
  const viewBox = normalizeViewBox(root, width, height, sourceName);
  root.attributes.set('xmlns', SVG_NAMESPACE);
  if (paint === 'currentColor' && !root.attributes.has('fill')) {
    root.attributes.set('fill', 'currentColor');
  }
  if (options.stripDimensions !== false) {
    root.attributes.delete('height');
    root.attributes.delete('width');
  }
  validateReferences(root, sourceName);

  return {
    content: serializeElement(root),
    diagnostics,
    ...(height === undefined ? {} : { height }),
    viewBox,
    ...(width === undefined ? {} : { width }),
  };
}

export function createSvgModule(
  source: string,
  options: CreateSvgModuleOptions = {},
): string {
  const exportName = options.exportName ?? 'svg';
  if (!IDENTIFIER_PATTERN.test(exportName)) {
    throw new SvgCompileError(
      'invalid-svg',
      `${exportName} is not a valid JavaScript export name.`,
      options.sourceName,
    );
  }
  const compiled = compileSvg(source, options);
  const value = serializeJavaScript(compiled);
  return `export const ${exportName} = Object.freeze(${value}) satisfies import('@jilatax/svg').CompiledSvg;\nexport default ${exportName};\n`;
}

function normalizeAttributes(
  source: Record<string, string>,
  context: NormalizeAttributesContext,
): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const [name, rawValue] of Object.entries(source)) {
    if (
      OMITTED_METADATA_ATTRIBUTES.has(name) ||
      name.startsWith('aria-') ||
      name.startsWith('data-')
    ) {
      context.diagnostics.push({
        code: 'metadata-removed',
        message: `Removed non-rendering ${name} metadata.`,
      });
      continue;
    }
    if (name.toLowerCase().startsWith('on') || !SUPPORTED_ATTRIBUTES.has(name)) {
      throw new SvgCompileError(
        'invalid-attribute',
        `${name} is not supported on <${context.elementName}>.`,
        context.sourceName,
      );
    }
    if (name === 'style') {
      inlineStyle(rawValue, attributes, context);
      continue;
    }

    const value = rawValue.trim();
    validateAttributeValue(name, value, context);
    attributes.set(name, normalizePaint(name, value, context.paint));
  }
  return attributes;
}

function inlineStyle(
  style: string,
  attributes: Map<string, string>,
  context: NormalizeAttributesContext,
): void {
  for (const declaration of style.split(';')) {
    if (declaration.trim().length === 0) continue;
    const separator = declaration.indexOf(':');
    if (separator < 1) {
      throw new SvgCompileError(
        'invalid-attribute',
        `Invalid SVG style declaration: ${declaration.trim()}`,
        context.sourceName,
      );
    }
    const name = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    if (!STYLE_ATTRIBUTES.has(name) || value.length === 0) {
      throw new SvgCompileError(
        'invalid-attribute',
        `${name || 'Empty style property'} is not supported in SVG icon styles.`,
        context.sourceName,
      );
    }
    validateAttributeValue(name, value, context);
    attributes.set(name, normalizePaint(name, value, context.paint));
  }
  context.diagnostics.push({
    code: 'style-inlined',
    message: `Converted the <${context.elementName}> style attribute to SVG attributes.`,
  });
}

function validateAttributeValue(
  name: string,
  value: string,
  context: NormalizeAttributesContext,
): void {
  if (value.length === 0 || JAVASCRIPT_URL_PATTERN.test(value)) {
    throw new SvgCompileError(
      'invalid-attribute',
      `${name} contains an invalid value.`,
      context.sourceName,
    );
  }
  if (name === 'id' && !XML_ID_PATTERN.test(value)) {
    throw new SvgCompileError(
      'invalid-attribute',
      `${value} is not a valid SVG id.`,
      context.sourceName,
    );
  }
  if (name === 'xmlns' && value !== SVG_NAMESPACE) {
    throw new SvgCompileError(
      'invalid-attribute',
      `Unsupported SVG namespace: ${value}`,
      context.sourceName,
    );
  }
  if (name === 'xmlns:xlink' && value !== XLINK_NAMESPACE) {
    throw new SvgCompileError(
      'invalid-attribute',
      `Unsupported XLink namespace: ${value}`,
      context.sourceName,
    );
  }
  if (name === 'href' || name === 'xlink:href') {
    if (!value.startsWith('#') && !context.allowExternalResources) {
      throw new SvgCompileError(
        'external-resource',
        `${name} must reference an id inside the SVG icon.`,
        context.sourceName,
      );
    }
  }

  for (const match of value.matchAll(ANY_URL_PATTERN)) {
    const target = match[1]?.trim().replace(/^['"]|['"]$/gu, '') ?? '';
    if (!target.startsWith('#') && !context.allowExternalResources) {
      throw new SvgCompileError(
        'external-resource',
        `${name} contains an external resource URL.`,
        context.sourceName,
      );
    }
  }
}

function normalizePaint(
  name: string,
  value: string,
  paint: SvgPaintMode,
): string {
  if (paint !== 'currentColor' || !PAINT_ATTRIBUTES.has(name)) return value;
  const lowerValue = value.toLowerCase();
  if (
    lowerValue === 'none' ||
    lowerValue === 'transparent' ||
    lowerValue === 'currentcolor' ||
    lowerValue.startsWith('url(')
  ) {
    return lowerValue === 'currentcolor' ? 'currentColor' : value;
  }
  return 'currentColor';
}

function normalizeViewBox(
  root: SvgElementNode,
  width: string | undefined,
  height: string | undefined,
  sourceName: string | undefined,
): string {
  const rawViewBox = root.attributes.get('viewBox');
  if (rawViewBox === undefined) {
    const numericWidth = parseDimension(width);
    const numericHeight = parseDimension(height);
    if (numericWidth === undefined || numericHeight === undefined) {
      throw new SvgCompileError(
        'missing-viewbox',
        'SVG icons require viewBox or numeric width and height attributes.',
        sourceName,
      );
    }
    const viewBox = `0 0 ${numericWidth} ${numericHeight}`;
    root.attributes.set('viewBox', viewBox);
    return viewBox;
  }

  const values = rawViewBox.trim().split(/[\s,]+/u).map(Number);
  if (
    values.length !== 4 ||
    values.some((value) => !Number.isFinite(value)) ||
    (values[2] ?? 0) <= 0 ||
    (values[3] ?? 0) <= 0
  ) {
    throw new SvgCompileError(
      'invalid-viewbox',
      `Invalid SVG viewBox: ${rawViewBox}`,
      sourceName,
    );
  }
  const viewBox = values.join(' ');
  root.attributes.set('viewBox', viewBox);
  return viewBox;
}

function parseDimension(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+(?:\.\d+)?(?:px)?$/u.test(value)) {
    return undefined;
  }
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function validateReferences(
  root: SvgElementNode,
  sourceName: string | undefined,
): void {
  const ids = new Set<string>();
  const references = new Set<string>();

  walkElements(root, (element) => {
    const id = element.attributes.get('id');
    if (id !== undefined) {
      if (ids.has(id)) {
        throw new SvgCompileError(
          'duplicate-id',
          `Duplicate SVG id: ${id}`,
          sourceName,
        );
      }
      ids.add(id);
    }
    for (const [name, value] of element.attributes) {
      if ((name === 'href' || name === 'xlink:href') && value.startsWith('#')) {
        references.add(value.slice(1));
      }
      for (const match of value.matchAll(INTERNAL_URL_PATTERN)) {
        const reference = match[1];
        if (reference !== undefined) references.add(reference);
      }
    }
  });

  for (const reference of references) {
    if (!ids.has(reference)) {
      throw new SvgCompileError(
        'invalid-reference',
        `SVG references missing id: ${reference}`,
        sourceName,
      );
    }
  }
}

function walkElements(
  element: SvgElementNode,
  visit: (element: SvgElementNode) => void,
): void {
  visit(element);
  for (const child of element.children) {
    if (typeof child !== 'string') walkElements(child, visit);
  }
}

function serializeElement(element: SvgElementNode): string {
  const attributes = [...element.attributes]
    .sort(([left], [right]) => attributeOrder(left) - attributeOrder(right) || left.localeCompare(right))
    .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
    .join('');
  if (element.children.length === 0) return `<${element.name}${attributes}/>`;
  const children = element.children
    .map((child) =>
      typeof child === 'string' ? escapeXml(child) : serializeElement(child),
    )
    .join('');
  return `<${element.name}${attributes}>${children}</${element.name}>`;
}

function attributeOrder(name: string): number {
  if (name === 'xmlns') return 0;
  if (name === 'xmlns:xlink') return 1;
  if (name === 'viewBox') return 2;
  if (name === 'width') return 3;
  if (name === 'height') return 4;
  return 10;
}

function serializeJavaScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
