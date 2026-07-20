import { useInitData, useState } from '@lynx-js/react';

import { BottomBar } from '../components/navigation/BottomBar.js';
import { AboutScreen } from '../screens/AboutScreen.js';
import { HomeScreen } from '../screens/HomeScreen.js';
import { SettingScreen } from '../screens/SettingScreen.js';
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
  const initData = useInitData();
  const appTheme: AppTheme = initData.appTheme === 'dark' ? 'dark' : 'light';

  return (
    <view className={`app-shell theme-${appTheme}`}>
      {activeTab === 'home' ? <HomeScreen /> : activeTab === 'about' ? <AboutScreen /> : <SettingScreen />}
      <BottomBar activeTab={activeTab} onSelect={setActiveTab} />
    </view>
  );
}
