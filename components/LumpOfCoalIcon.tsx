import React from 'react';
import type { SvgProps } from 'react-native-svg';
import Svg, { G, Path, Polygon } from 'react-native-svg';

const LumpOfCoalIcon = (props: SvgProps) => (
  <Svg
    viewBox="0 0 300.7 300.7"
    width={props.width || 32}
    height={props.height || 32}
    fill="none"
    {...props}
  >
    <G>
      <G>
        <G>
          <Path
            d="M6.186,96.564C2.309,99.288,0,103.73,0,108.469v118.719c0,6.065,3.763,11.495,9.441,13.624l94.548,35.457l28.541-118.973
              L107.223,25.579L6.186,96.564z"
            fill={props.color || '#000'}
          />
          <Path
            d="M299.983,217.783L257.96,88.866l-97.576,77.063l-27.019,112.636l156.573-42.225c3.853-1.038,7.108-3.613,9.007-7.122
              S301.22,221.576,299.983,217.783z"
            fill={props.color || '#000'}
          />
          <Polygon
            points="238.882,66.852 136.193,22.135 157.182,131.377"
            fill={props.color || '#000'}
          />
        </G>
      </G>
    </G>
  </Svg>
);

export default LumpOfCoalIcon;
