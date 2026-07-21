import logo from '../../assets/images/logo.png';

const containerStyle = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 'auto',
} as const;

const iconWrapperStyle = {
  position: 'relative',
  width: '32px',
  height: '32px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
} as const;

const textStyle = { margin: 0, position: 'absolute' } as const;
const textWithPaddingStyle = { margin: 0, paddingRight: '8px' };
const imageStyle = {
  width: '32px',
  height: '32px',
  opacity: 0,
  position: 'absolute',
} as const;

export function Logo() {
  return (
    <view style={containerStyle}>
      <text className="centered-message" style={textWithPaddingStyle}>
        Welcome
      </text>
      <view style={iconWrapperStyle}>
        <image id="logo-image" src={logo} style={imageStyle} />
        <text id="logo-emoji" className="centered-message" style={textStyle}>
          🎉
        </text>
      </view>
    </view>
  );
}
