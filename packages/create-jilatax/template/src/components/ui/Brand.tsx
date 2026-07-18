import jilataxIcon from '../../../public/assets/jilatax-icon.png';

interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <view className={`brand${compact ? ' brand--compact' : ''}`}>
      <view className="brand__icon-wrap">
        <image className="brand__icon" mode="aspectFit" src={jilataxIcon} />
      </view>
      <view className="brand__copy">
        <text className="brand__name">JILATAX</text>
        <text className="brand__caption">LYNX TO ANDROID</text>
      </view>
    </view>
  );
}
