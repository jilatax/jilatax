import logo from '../../assets/images/logo.png';

const containerStyle = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 'auto',
} as const;

const iconWrapperStyle = {
  width: '32px',
  height: '32px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
} as const;

const textStyle = { margin: 0 };
const textWithPaddingStyle = { margin: 0, paddingRight: '8px' };
const imageStyle = { width: '32px', height: '32px' };

interface LogoProps {
  showImage?: boolean;
}

export function Logo({ showImage }: LogoProps) {
  return (
    <view style={containerStyle}>
      <text className="centered-message" style={textWithPaddingStyle}>
        Welcome
      </text>
      <view style={iconWrapperStyle}>
        {showImage ? (
          <image src={logo} style={imageStyle} />
        ) : (
          <text className="centered-message" style={textStyle}>
            🎉
          </text>
        )}
      </view>
    </view>
  );
}
