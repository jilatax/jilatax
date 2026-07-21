import SettingsIcon from '../../../assets/icons/settings.svg';
import './SettingsButton.css';

interface SettingsButtonProps {
  onTap: () => void;
}

export function SettingsButton({ onTap }: SettingsButtonProps) {
  return (
    <view className="settings-button" bindtap={onTap}>
      <SettingsIcon
        accessibility-element={false}
        className="settings-button__icon"
        size={52}
      />
    </view>
  );
}
