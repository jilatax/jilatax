import type { AppTab } from '../../app/navigation.js';
import './BottomBar.css';

interface BottomBarProps {
  activeTab: AppTab;
  onSelect: (tab: AppTab) => void;
}

const tabs: ReadonlyArray<{ id: AppTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'setting', label: 'Setting' },
];

export function BottomBar({ activeTab, onSelect }: BottomBarProps) {
  return (
    <view className="bottom-bar-wrap">
      <view className="bottom-bar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <view
              className={`bottom-bar__button${isActive ? ' bottom-bar__button--active' : ''}`}
              bindtap={() => onSelect(tab.id)}
              key={tab.id}
            >
              <view className={`bottom-bar__mark${isActive ? ' bottom-bar__mark--active' : ''}`} />
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
