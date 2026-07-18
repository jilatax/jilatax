import { Brand } from '../components/ui/Brand.js';

export function HomeScreen() {
  return (
    <scroll-view className="screen" scroll-orientation="vertical">
      <view className="screen__content">
        <Brand />

        <view className="hero">
          <view className="eyebrow">
            <view className="eyebrow__dot" />
            <text className="eyebrow__text">ANDROID READY</text>
          </view>
          <text className="hero__title">Build clean.{`\n`}Ship native.</text>
          <text className="hero__description">
            A focused foundation for fast Lynx experiences on Android.
          </text>
        </view>

        <view className="workspace-card">
          <view className="workspace-card__glow" />
          <view className="workspace-card__top">
            <text className="workspace-card__label">YOUR WORKSPACE</text>
            <view className="workspace-card__status">
              <view className="workspace-card__status-dot" />
              <text className="workspace-card__status-text">LIVE</text>
            </view>
          </view>
          <text className="workspace-card__title">Ready for what comes next.</text>
          <text className="workspace-card__description">
            One clear interface, powered by Lynx and prepared for Android.
          </text>
          <view className="workspace-card__footer">
            <view className="tech-pill">
              <text className="tech-pill__text">LYNX</text>
            </view>
            <view className="tech-pill tech-pill--accent">
              <text className="tech-pill__text tech-pill__text--accent">JILATAX</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  );
}
