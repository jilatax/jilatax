export type CliErrorCode =
  | 'JTX_USAGE'
  | 'JTX_CONFIG_INVALID'
  | 'JTX_ANDROID_PROJECT_MISSING'
  | 'JTX_RSPEDY_MISSING'
  | 'JTX_NO_DEVICE'
  | 'JTX_MULTIPLE_DEVICES'
  | 'JTX_DEVICE_UNAVAILABLE'
  | 'JTX_DEV_SERVER_TIMEOUT'
  | 'JTX_BUNDLE_MISSING'
  | 'JTX_ANDROID_BUILD_FAILED'
  | 'JTX_INSTALL_FAILED'
  | 'JTX_ADB_REVERSE_FAILED'
  | 'JTX_LAUNCH_FAILED'
  | 'JTX_AAB_MISSING'
  | 'JTX_COMMAND_FAILED';

export interface CliErrorOptions extends ErrorOptions {
  readonly exitCode?: number;
  readonly hint?: string;
}

export class CliError extends Error {
  readonly code: CliErrorCode;
  readonly exitCode: number;
  readonly hint: string | undefined;

  constructor(
    code: CliErrorCode,
    message: string,
    options: CliErrorOptions = {},
  ) {
    super(message, options);
    this.name = 'CliError';
    this.code = code;
    this.exitCode = options.exitCode ?? 1;
    this.hint = options.hint;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
