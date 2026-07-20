import { useState } from '@lynx-js/react';
import { Logo } from '../components/ui/Logo.js';

export function HomeScreen() {
  const [showImage, setShowImage] = useState(false);

  const handleScreenTap = () => {
    setShowImage((prev) => !prev);
  };

  return (
    <view className="screen" bindtap={handleScreenTap}>
      <view className="screen__content">
        <Logo showImage={showImage} />
      </view>
    </view>
  );
}
