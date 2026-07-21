export type SvgCompileErrorCode =
  | 'duplicate-id'
  | 'empty-source'
  | 'external-resource'
  | 'invalid-attribute'
  | 'invalid-color'
  | 'invalid-reference'
  | 'invalid-root'
  | 'invalid-svg'
  | 'invalid-viewbox'
  | 'missing-viewbox'
  | 'source-too-complex'
  | 'source-too-large'
  | 'unsupported-element';

export class SvgCompileError extends Error {
  readonly code: SvgCompileErrorCode;
  readonly sourceName: string | undefined;

  constructor(
    code: SvgCompileErrorCode,
    message: string,
    sourceName?: string,
    options?: ErrorOptions,
  ) {
    super(sourceName === undefined ? message : `${sourceName}: ${message}`, options);
    this.name = 'SvgCompileError';
    this.code = code;
    this.sourceName = sourceName;
  }
}
