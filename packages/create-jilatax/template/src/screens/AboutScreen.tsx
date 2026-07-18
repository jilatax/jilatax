import { Brand } from '../components/ui/Brand.js';

const principles = [
  { number: '01', title: 'Simple by default', detail: 'A small structure that stays easy to evolve.' },
  { number: '02', title: 'Native in the end', detail: 'A direct path from Lynx UI to Android.' },
  { number: '03', title: 'Built with intent', detail: 'Clear hierarchy, spacing, and interaction.' },
] as const;

export function AboutScreen() {
  return (
    <scroll-view className="screen" scroll-orientation="vertical">
      <view className="screen__content">
        <Brand compact />

        <view className="about-heading">
          <text className="about-heading__label">THE FOUNDATION</text>
          <text className="about-heading__title">Small core.{`\n`}Native result.</text>
          <text className="about-heading__description">
            JILATAX keeps the route from idea to Android direct and understandable.
          </text>
        </view>

        <view className="principles">
          {principles.map((principle) => (
            <view className="principle" key={principle.number}>
              <text className="principle__number">{principle.number}</text>
              <view className="principle__copy">
                <text className="principle__title">{principle.title}</text>
                <text className="principle__detail">{principle.detail}</text>
              </view>
            </view>
          ))}
        </view>
      </view>
    </scroll-view>
  );
}
