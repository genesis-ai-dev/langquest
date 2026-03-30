import type { LucideIcon, LucideProps } from 'lucide-react-native';
import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * Custom FIA icon matching the LucideIcon interface.
 * Three interlocking chevrons from the official FIA logo.
 */
const FiaIcon: LucideIcon = React.forwardRef<
  React.ComponentRef<typeof Svg>,
  LucideProps
>(({ color = 'currentColor', size = 24, ...rest }, ref) => {
  return (
    <Svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 300 167.52"
      fill={color}
      {...rest}
    >
      <Path d="M149.39 164.39c-3.47 0-6.93-1.32-9.57-3.97l-68-67.99c-5.29-5.29-5.29-13.86 0-19.15s13.86-5.29 19.15 0l44.46 44.46c7.71 7.71 20.21 7.71 27.92 0l44.46-44.46c5.29-5.29 13.86-5.29 19.15 0s5.29 13.86 0 19.15l-67.99 68a13.5 13.5 0 0 1-9.57 3.97Z" />
      <Path d="M81.53 0C85 0 88.46 1.32 91.1 3.97l68 67.99c5.29 5.29 5.29 13.86 0 19.15s-13.86 5.29-19.15 0L95.49 46.65c-7.71-7.71-20.21-7.71-27.92 0L23.11 91.11c-5.29 5.29-13.86 5.29-19.15 0s-5.29-13.86 0-19.15l68-67.99A13.5 13.5 0 0 1 81.53 0" />
      <Path d="M300 85.98c0 3.47-1.32 6.93-3.97 9.57l-67.99 67.99c-5.29 5.29-13.86 5.29-19.15 0s-5.29-13.86 0-19.15l44.46-44.46c7.71-7.71 7.71-20.21 0-27.92l-44.46-44.46c-5.29-5.29-5.29-13.86 0-19.15s13.86-5.29 19.15 0l67.99 67.99a13.5 13.5 0 0 1 3.97 9.57Z" />
    </Svg>
  );
});

FiaIcon.displayName = 'FiaIcon';

export { FiaIcon };
