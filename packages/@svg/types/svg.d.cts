declare module '*.svg' {
  import type { CompiledSvg } from '@jilatax/svg';
  import type { SvgIconComponent } from '@jilatax/svg/react';

  export const svg: CompiledSvg;
  const SvgIcon: SvgIconComponent;
  export default SvgIcon;
}
