import { useMainThreadRef } from '@lynx-js/react';
import { Logo } from '../components/ui/Logo.js';

export function HomeScreen() {
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
      <view className="screen__content">
        <Logo />
      </view>
    </view>
  );
}
