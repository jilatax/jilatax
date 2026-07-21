import { SettingsButton } from '../components/ui/buttons/SettingsButton.js';

interface MeScreenProps {
  onSettingsTap: () => void;
}

export function MeScreen({ onSettingsTap }: MeScreenProps) {
  return (
    <view className="screen">
      <SettingsButton onTap={onSettingsTap} />
      <view className="screen__content">
        <text className="centered-message">Me</text>
      </view>
    </view>
  );
}
