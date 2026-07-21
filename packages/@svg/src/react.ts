import {
  createElement,
  type ReactElement,
} from '@lynx-js/react';
import type { CSSProperties, SVGProps } from '@lynx-js/types';

import { applySvgColor } from './color.js';
import type { CompiledSvg } from './compiler.js';

export type SvgIconSize = number | string;

interface SvgIconBaseProps extends Omit<SVGProps, 'content' | 'src' | 'style'> {
  readonly height?: SvgIconSize;
  readonly size?: SvgIconSize;
  readonly style?: SVGProps['style'];
  readonly width?: SvgIconSize;
}

export interface CompiledSvgIconProps extends SvgIconBaseProps {
  readonly color?: string;
  readonly icon: CompiledSvg | string;
  readonly src?: never;
}

export interface SvgAssetIconProps extends SvgIconBaseProps {
  readonly color?: never;
  readonly icon?: never;
  readonly src: string;
}

export type SvgIconProps = CompiledSvgIconProps | SvgAssetIconProps;

export type BoundSvgIconProps = Omit<CompiledSvgIconProps, 'icon'>;

export interface SvgIconComponent {
  (props: BoundSvgIconProps): ReactElement;
  readonly displayName?: string;
}

export function SvgIcon(props: SvgIconProps): ReactElement {
  return createElement('svg', resolveSvgIconProps(props));
}

export function resolveSvgIconProps(props: SvgIconProps): SVGProps {
  const {
    color,
    height,
    icon,
    size,
    src,
    style,
    width,
    ...elementProps
  } = props;
  const compiled = typeof icon === 'string' ? undefined : icon;
  const content = typeof icon === 'string' ? icon : (icon?.content ?? '');
  const defaultSize = size ?? compiled?.width ?? compiled?.height ?? 24;
  const resolvedWidth = normalizeDimension(width ?? defaultSize, 'width');
  const resolvedHeight = normalizeDimension(height ?? defaultSize, 'height');
  const resolvedStyle = mergeStyle(style, resolvedWidth, resolvedHeight);
  const accessibilityElement =
    elementProps['accessibility-element'] ??
    elementProps['accessibility-label'] !== undefined;

  return {
    ...elementProps,
    'accessibility-element': accessibilityElement,
    style: resolvedStyle,
    ...(src === undefined
      ? {
          content:
            color === undefined
              ? content
              : applySvgColor(content, color),
        }
      : { src }),
  };
}

export function createSvgIcon(
  icon: CompiledSvg | string,
  displayName: string = 'SvgIcon',
): SvgIconComponent {
  const Component = (props: BoundSvgIconProps): ReactElement =>
    SvgIcon({ ...props, icon });
  Object.defineProperty(Component, 'displayName', {
    configurable: true,
    value: displayName,
  });
  return Component;
}

function normalizeDimension(value: SvgIconSize, name: string): SvgIconSize {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`SVG icon ${name} must be a positive number.`);
    }
    return value;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new RangeError(`SVG icon ${name} cannot be empty.`);
  }
  return normalized;
}

function mergeStyle(
  style: SVGProps['style'],
  width: SvgIconSize,
  height: SvgIconSize,
): SVGProps['style'] {
  if (typeof style === 'string') {
    return `width:${cssDimension(width)};height:${cssDimension(height)};${style}`;
  }
  const dimensions: CSSProperties = { height, width };
  return { ...dimensions, ...style };
}

function cssDimension(value: SvgIconSize): string {
  return typeof value === 'number' ? `${value}px` : value;
}
