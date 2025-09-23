import { cn, getThemeToken } from '@/utils/styleUtils';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import type { MotiProps } from 'moti';
import { useMotify } from 'moti';
import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

type IconProps = MotiProps<LucideProps> &
  LucideProps & {
    as: LucideIcon;
  };

import React from 'react';
import { TextClassContext } from './text';

const MotiIconImpl = React.forwardRef<
  React.ComponentRef<LucideIcon>,
  IconProps
>(function IconImpl({ as: IconComponent, ...props }, ref) {
  const AnimatedComponent = Animated.createAnimatedComponent(IconComponent);
  const animated = useMotify<LucideProps>(props);
  return (
    <AnimatedComponent
      {...props}
      animatedProps={animated.style}
      // @ts-expect-error - ref type mismatch between animated component and original
      ref={ref}
    />
  );
});

const IconImpl = React.forwardRef<React.ComponentRef<LucideIcon>, IconProps>(
  function IconImpl({ as: IconComponent, ...props }, ref) {
    return (
      <IconComponent
        {...props}
        // @ts-expect-error - ref type mismatch
        ref={ref}
      />
    );
  }
);

cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: 'size',
      width: 'size',
      fill: 'fill'
    }
  }
});

cssInterop(MotiIconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: 'size',
      width: 'size',
      fill: 'fill'
    }
  }
});

/**
 * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.
 *
 * This component allows you to render any Lucide icon while applying utility classes
 * using `nativewind`. It avoids the need to wrap or configure each icon individually.
 *
 * @component
 * @example
 * ```tsx
 * import { ArrowRight } from 'lucide-react-native';
 * import { Icon } from '@/registry/components/ui/icon';
 *
 * <Icon as={ArrowRight} className="text-red-500" size={16} />
 * ```
 *
 * @param {LucideIcon} as - The Lucide icon component to render.
 * @param {string} className - Utility classes to style the icon using Nativewind.
 * @param {number} size - Icon size (defaults to 14).
 * @param {...LucideProps} ...props - Additional Lucide icon props passed to the "as" icon.
 */
function Icon({
  as: IconComponent,
  className,
  size = getThemeToken('default-icon-size'),
  ...props
}: IconProps) {
  const textClass = React.useContext(TextClassContext);
  return (
    <IconImpl
      as={IconComponent}
      className={cn('text-foreground', textClass, className)}
      size={size}
      {...props}
    />
  );
}

function MotiIcon({
  as: IconComponent,
  className,
  size = getThemeToken('default-icon-size'),
  ...props
}: IconProps) {
  return (
    <MotiIconImpl
      as={IconComponent}
      className={cn('text-foreground', className)}
      size={size}
      {...props}
    />
  );
}

export { Icon, MotiIcon };
