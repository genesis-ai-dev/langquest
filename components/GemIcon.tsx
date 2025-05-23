import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

export const GemIcon = ({ color, ...props }: SvgProps) => {
  return (
    <Svg viewBox="0 -32 576 576" fill={color ?? 'black'} {...props}>
      <Path d="M485.5 0L576 160H474.9L405.7 0h79.8zm-128 0l69.2 160H149.3L218.5 0h139zm-267 0h79.8l-69.2 160H0L90.5 0zM0 192h100.7l123 251.7c1.5 3.1-2.7 5.9-5 3.3L0 192zm148.2 0h279.6l-137 318.2c-1 2.4-4.5 2.4-5.5 0L148.2 192zm204.1 251.7l123-251.7H576L357.3 446.9c-2.3 2.7-6.5-.1-5-3.2z" />
    </Svg>
  );
};
