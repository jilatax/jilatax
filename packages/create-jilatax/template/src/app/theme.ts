export type AppTheme = 'dark' | 'light';

export type ThemePreference = AppTheme | 'system';

export interface ThemeState {
  appTheme: AppTheme;
  themePreference: ThemePreference;
}

interface ThemeInitData {
  appTheme?: unknown;
  themePreference?: unknown;
}

interface JilataxThemeModule {
  setPreference(
    preference: ThemePreference,
    callback: (
      success: boolean,
      themePreference: ThemePreference,
      appTheme: AppTheme,
    ) => void,
  ): void;
}

export function readThemeState(initData: ThemeInitData): ThemeState {
  return {
    appTheme: initData.appTheme === 'dark' ? 'dark' : 'light',
    themePreference: isThemePreference(initData.themePreference)
      ? initData.themePreference
      : 'system',
  };
}

export function setNativeThemePreference(
  preference: ThemePreference,
): void {
  'background only';
  const themeModule = NativeModules.JilataxTheme as
    | JilataxThemeModule
    | undefined;
  if (!themeModule?.setPreference) {
    console.error('JilataxTheme native module is unavailable.');
    return;
  }

  themeModule.setPreference(preference, (success) => {
    if (!success) {
      console.error('Unable to persist the Jilatax theme preference.');
    }
  });
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}
