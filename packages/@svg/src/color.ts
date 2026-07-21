import { SvgCompileError } from './errors.js';
import { escapeXml } from './xml.js';

const SIMPLE_COLOR_PATTERN = /^(?:#[\dA-Fa-f]{3,8}|[A-Za-z]+)$/u;
const FUNCTION_COLOR_PATTERN = /^(?:hsla?|rgba?)\([\d\s.,%+\/-]+\)$/iu;

export function applySvgColor(content: string, color: string): string {
  const normalizedColor = color.trim();
  if (
    normalizedColor.length === 0 ||
    normalizedColor.length > 128 ||
    (!SIMPLE_COLOR_PATTERN.test(normalizedColor) &&
      !FUNCTION_COLOR_PATTERN.test(normalizedColor))
  ) {
    throw new SvgCompileError(
      'invalid-color',
      `Unsupported SVG color: ${color}`,
    );
  }
  return content.replaceAll('currentColor', escapeXml(normalizedColor));
}
