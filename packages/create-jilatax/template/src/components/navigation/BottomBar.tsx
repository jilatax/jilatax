import { APP_TABS, type AppTab } from '../../app/navigation.js';
import './BottomBar.css';

interface BottomBarProps {
  activeTab: AppTab;
  onSelect: (tab: AppTab) => void;
}

export function BottomBar({ activeTab, onSelect }: BottomBarProps) {
  return (
    <view className="bottom-bar-wrap">
      <view className="bottom-bar">
        {APP_TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <view
              className={`bottom-bar__button${isActive ? ' bottom-bar__button--active' : ''}`}
              bindtap={() => onSelect(tab.id)}
              key={tab.id}
            >
              <view
                className={`bottom-bar__dot${isActive ? ' bottom-bar__dot--active' : ''}`}
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
