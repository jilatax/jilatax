import ArrowLeftIcon from '../../assets/icons/arrow-left.svg';
import MoonFilledIcon from '../../assets/icons/filled/moon-filled.svg';
import SunFilledIcon from '../../assets/icons/filled/sun-filled.svg';
import MoonOutlineIcon from '../../assets/icons/outline/moon-outline.svg';
import SunOutlineIcon from '../../assets/icons/outline/sun-outline.svg';
import SystemIcon from '../../assets/icons/system.svg';
import type { AppTheme, ThemePreference } from '../../app/theme.js';
import './SettingScreen.css';

interface SettingScreenProps {
  appTheme: AppTheme;
  onBack: () => void;
  onThemeChange: (theme: ThemePreference) => void;
  selectedTheme: ThemePreference;
}

export function SettingScreen({
  appTheme,
  onBack,
  onThemeChange,
  selectedTheme,
}: SettingScreenProps) {
  const isLight = selectedTheme === 'light';
  const isDark = selectedTheme === 'dark';
  const isSystem = selectedTheme === 'system';
  const iconColor = appTheme === 'dark' ? '#ffffff' : '#18181a';

  return (
    <view className="screen setting-screen">
      <view className="setting-screen__header">
        <view className="setting-screen__back" bindtap={onBack}>
          <ArrowLeftIcon
            accessibility-element={false}
            color={iconColor}
            size={52}
          />
        </view>
        <text className="setting-screen__title">Settings</text>
      </view>

      <view className="setting-screen__content">
        <view className="theme-selector">
          <view
            className={`theme-selector__option ${isLight ? 'theme-selector__option--active' : ''}`}
            bindtap={() => onThemeChange('light')}
          >
            {isLight ? (
              <SunFilledIcon
                accessibility-element={false}
                color="#000000"
                size={52}
              />
            ) : (
              <SunOutlineIcon
                accessibility-element={false}
                color={iconColor}
                size={52}
              />
            )}
            <text
              className={`theme-selector__label ${isLight ? 'theme-selector__label--active' : ''}`}
            >
              Light
            </text>
          </view>

          <view
            className={`theme-selector__option ${isDark ? 'theme-selector__option--active' : ''}`}
            bindtap={() => onThemeChange('dark')}
          >
            {isDark ? (
              <MoonFilledIcon
                accessibility-element={false}
                color="#000000"
                size={52}
              />
            ) : (
              <MoonOutlineIcon
                accessibility-element={false}
                color={iconColor}
                size={52}
              />
            )}
            <text
              className={`theme-selector__label ${isDark ? 'theme-selector__label--active' : ''}`}
            >
              Dark
            </text>
          </view>

          <view
            className={`theme-selector__option ${isSystem ? 'theme-selector__option--active' : ''}`}
            bindtap={() => onThemeChange('system')}
          >
            <SystemIcon
              accessibility-element={false}
              color={isSystem ? '#000000' : iconColor}
              size={52}
            />
            <text
              className={`theme-selector__label ${isSystem ? 'theme-selector__label--active' : ''}`}
            >
              System
            </text>
          </view>
        </view>
      </view>
    </view>
  );
}
