import { cn, getThemeToken } from '@/utils/styleUtils';
import { Lucide, type LucideIconName } from '@react-native-vector-icons/lucide';
import type { MotiProps } from 'moti';
import { useMotify } from 'moti';
import { cssInterop } from 'nativewind';
import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { TextClassContext } from './text';

type BaseIconProps = TextProps & {
  name: LucideIconName;
  size?: number;
  color?: TextStyle['color'];
  className?: string;
};

type IconProps = MotiProps<BaseIconProps> & BaseIconProps;

const MotiIconImpl = React.forwardRef<React.ComponentRef<typeof Text>, IconProps>(
  function MotiIconImpl({ name, size, color, className, style, ...props }, ref) {
    const animated = useMotify<BaseIconProps>(props);
    const textClass = React.useContext(TextClassContext);
    
    return (
      <Lucide
        name={name}
        size={size}
        color={color}
        style={[animated.style, style]}
        className={cn('text-foreground', textClass, className)}
        innerRef={ref}
        {...props}
      />
    );
  }
);

const IconImpl = React.forwardRef<React.ComponentRef<typeof Text>, IconProps>(
  function IconImpl({ name, size, color, className, style, ...props }, ref) {
    const textClass = React.useContext(TextClassContext);
    
    return (
      <Lucide
        name={name}
        size={size}
        color={color}
        style={style}
        className={cn('text-foreground', textClass, className)}
        innerRef={ref}
        {...props}
      />
    );
  }
);

cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      fontSize: 'size',
      color: 'color'
    }
  }
});

cssInterop(MotiIconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      fontSize: 'size',
      color: 'color'
    }
  }
});

/**
 * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.
 *
 * This component allows you to render any Lucide icon while applying utility classes
 * using `nativewind`. It uses @react-native-vector-icons/lucide for icon rendering.
 *
 * @component
 * @example
 * ```tsx
 * import { Icon } from '@/components/ui/icon';
 *
 * <Icon name="arrow-right" className="text-red-500" size={16} />
 * ```
 *
 * @param {LucideIconName} name - The name of the Lucide icon to render.
 * @param {string} className - Utility classes to style the icon using Nativewind.
 * @param {number} size - Icon size (defaults to --default-icon-size).
 * @param {string} color - Icon color (can also be set via className).
 * @param {...TextProps} ...props - Additional Text props passed to the icon.
 */
function Icon({
  name,
  className,
  size = getThemeToken('default-icon-size'),
  color,
  ...props
}: IconProps) {
  const textClass = React.useContext(TextClassContext);
  return (
    <IconImpl
      name={name}
      className={cn('text-foreground', textClass, className)}
      size={size}
      color={color}
      {...props}
    />
  );
}

function MotiIcon({
  name,
  className,
  size = getThemeToken('default-icon-size'),
  color,
  ...props
}: IconProps) {
  return (
    <MotiIconImpl
      name={name}
      className={cn('text-foreground', className)}
      size={size}
      color={color}
      {...props}
    />
  );
}

export { Icon, MotiIcon };
