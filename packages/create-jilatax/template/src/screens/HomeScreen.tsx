import { useMainThreadRef } from '@lynx-js/react';
import { Logo } from '../components/ui/Logo.js';
import { SettingsButton } from '../components/ui/buttons/SettingsButton.js';

interface HomeScreenProps {
  onSettingsTap: () => void;
}

export function HomeScreen({ onSettingsTap }: HomeScreenProps) {
  const showImage = useMainThreadRef(false);

  const handleScreenTap = () => {
    'main thread';
    showImage.current = !showImage.current;
    lynx.querySelector('#logo-emoji')?.setStyleProperty(
      'opacity',
      showImage.current ? '0' : '1',
    );
    lynx.querySelector('#logo-image')?.setStyleProperty(
      'opacity',
      showImage.current ? '1' : '0',
    );
  };

  return (
    <view className="screen" main-thread:bindtap={handleScreenTap}>
      <SettingsButton onTap={onSettingsTap} />
      <view className="screen__content">
        <Logo />
      </view>
    </view>
  );
}
