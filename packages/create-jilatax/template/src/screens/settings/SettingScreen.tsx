import ArrowLeftIcon from '../../assets/icons/arrow-left.svg';
import './SettingScreen.css';

interface SettingScreenProps {
  onBack: () => void;
}

export function SettingScreen({ onBack }: SettingScreenProps) {
  return (
    <view className="screen setting-screen">
      <view className="setting-screen__header">
        <view className="setting-screen__back" bindtap={onBack}>
          <ArrowLeftIcon
            accessibility-element={false}
            className="setting-screen__back-icon"
            size={52}
          />
        </view>
        <text className="setting-screen__title">Setting</text>
      </view>
    </view>
  );
}
