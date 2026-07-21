import { useInitData, useState } from '@lynx-js/react';

import { BottomBar } from '../components/navigation/BottomBar.js';
import { SettingsButton } from '../components/ui/buttons/SettingsButton.js';
import { AboutScreen } from '../screens/AboutScreen.js';
import { HomeScreen } from '../screens/HomeScreen.js';
import { MeScreen } from '../screens/MeScreen.js';
import { SettingScreen } from '../screens/settings/SettingScreen.js';
import '../styles/global.css';
import type { AppTab } from './navigation.js';

type AppTheme = 'dark' | 'light';

declare module '@lynx-js/react' {
  interface InitData {
    appTheme?: AppTheme;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const initData = useInitData();
  const appTheme: AppTheme = initData.appTheme === 'dark' ? 'dark' : 'light';

  const handleNavigateToSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleNavigateBack = () => {
    setIsSettingsOpen(false);
  };

  return (
    <view className={`app-shell theme-${appTheme}`}>
      {isSettingsOpen ? (
        <SettingScreen onBack={handleNavigateBack} />
      ) : activeTab === 'home' ? (
        <HomeScreen />
      ) : activeTab === 'about' ? (
        <AboutScreen />
      ) : (
        <MeScreen />
      )}
      {isSettingsOpen ? null : (
        <SettingsButton onTap={handleNavigateToSettings} />
      )}
      {isSettingsOpen ? null : (
        <BottomBar activeTab={activeTab} onSelect={setActiveTab} />
      )}
    </view>
  );
}
