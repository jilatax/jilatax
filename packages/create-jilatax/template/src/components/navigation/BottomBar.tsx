import type { SvgIconComponent } from '@jilatax/svg/react';

import type { AppTab } from '../../app/navigation.js';
import AboutIcon from '../../assets/icons/about.svg';
import HomeIcon from '../../assets/icons/home.svg';
import SettingsIcon from '../../assets/icons/settings.svg';
import './BottomBar.css';

interface BottomBarProps {
  activeTab: AppTab;
  onSelect: (tab: AppTab) => void;
}

interface BottomBarTab {
  readonly icon: SvgIconComponent;
  readonly id: AppTab;
  readonly label: string;
}

const tabs: readonly BottomBarTab[] = [
  { icon: HomeIcon, id: 'home', label: 'Home' },
  { icon: AboutIcon, id: 'about', label: 'About' },
  { icon: SettingsIcon, id: 'setting', label: 'Setting' },
];

export function BottomBar({ activeTab, onSelect }: BottomBarProps) {
  return (
    <view className="bottom-bar-wrap">
      <view className="bottom-bar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <view
              className={`bottom-bar__button${isActive ? ' bottom-bar__button--active' : ''}`}
              bindtap={() => onSelect(tab.id)}
              key={tab.id}
            >
              <Icon
                accessibility-element={false}
                className="bottom-bar__icon"
                color={isActive ? '#00aa6b' : '#879990'}
                size={20}
              />
              <text className={`bottom-bar__label${isActive ? ' bottom-bar__label--active' : ''}`}>
                {tab.label}
              </text>
            </view>
          );
        })}
      </view>
    </view>
  );
}
