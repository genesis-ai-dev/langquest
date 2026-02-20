import type { LucideIcon, LucideProps } from 'lucide-react-native';
import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * Custom FIA icon matching the LucideIcon interface.
 * Three overlapping chevrons: up (^), down (V), and right (>),
 * arranged to interlock without touching — the FIA logo.
 *
 * Coordinates derived from the official FIA SVG, scaled to fill 24×24
 * with slight horizontal spacing added between each chevron pair.
 */
const FiaIcon: LucideIcon = React.forwardRef<React.ComponentRef<typeof Svg>, LucideProps>(
  (
    {
      color = 'currentColor',
      size = 24,
      strokeWidth = 2.5,
      absoluteStrokeWidth,
      ...rest
    },
    ref
  ) => {
    const sw = absoluteStrokeWidth
      ? (Number(strokeWidth) * 24) / Number(size)
      : strokeWidth;

    return (
      <Svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {/* Chevron UP (^): peak at (7.1, 5.3) */}
        <Path d="M 0.1 13.1 L 7.1 5.3 L 13.1 12.7" />
        {/* Chevron DOWN (V): peak at (12.8, 18.7) */}
        <Path d="M 6.8 11.8 L 12.8 18.7 L 18.5 11.7" />
        {/* Chevron RIGHT (>): tip at (23.4, 11.0), arms extended to match UP peak and DOWN tip */}
        <Path d="M 18.0 5.3 L 23.4 11.0 L 17.8 18.7" />
      </Svg>
    );
  }
);

FiaIcon.displayName = 'FiaIcon';

export { FiaIcon };
