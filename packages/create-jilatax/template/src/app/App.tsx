import { useState } from '@lynx-js/react';

import { BottomBar } from '../components/navigation/BottomBar.js';
import { AboutScreen } from '../screens/AboutScreen.js';
import { HomeScreen } from '../screens/HomeScreen.js';
import '../styles/global.css';
import type { AppTab } from './navigation.js';

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  return (
    <view className="app-shell">
      {activeTab === 'home' ? <HomeScreen /> : <AboutScreen />}
      <BottomBar activeTab={activeTab} onSelect={setActiveTab} />
    </view>
  );
}
