import SettingsIcon from '../../../assets/icons/settings.svg';
import type { AppTheme } from '../../../app/theme.js';
import './SettingsButton.css';

interface SettingsButtonProps {
  appTheme: AppTheme;
  onTap: () => void;
}

export function SettingsButton({ appTheme, onTap }: SettingsButtonProps) {
  const iconColor = appTheme === 'dark' ? '#79efb5' : '#08774f';

  return (
    <view className="settings-button" bindtap={onTap}>
      <SettingsIcon
        accessibility-element={false}
        color={iconColor}
        size={52}
      />
    </view>
  );
}
