import { easeOut } from '@/constants/animations';
import { cn } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import { EllipsisVerticalIcon, XIcon } from 'lucide-react-native';
import * as React from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import type { ButtonProps } from './button';
import { Button } from './button';
import { Icon } from './icon';
import * as Slot from './slot';

// Consumers control placement and alignment by composing these parts.

interface SpeedDialContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  closeOnItemPress: boolean;
}

const SpeedDialContext = React.createContext<SpeedDialContextValue>(
  {} as SpeedDialContextValue
);

function useSpeedDialContext() {
  return React.useContext(SpeedDialContext);
}

interface SpeedDialProps extends ViewProps {
  closeOnItemPress?: boolean;
}

function SpeedDial({
  children,
  closeOnItemPress = true,
  className,
  ...props
}: React.PropsWithChildren<SpeedDialProps>) {
  const [open, setOpen] = React.useState(false);

  const toggle = React.useCallback(() => {
    setOpen((v) => !v);
  }, []);

  return (
    <View {...props} className={cn('flex flex-col gap-2', className)}>
      <SpeedDialContext.Provider
        value={{
          open,
          setOpen,
          toggle,
          closeOnItemPress
        }}
      >
        {children}
      </SpeedDialContext.Provider>
    </View>
  );
}
SpeedDial.displayName = 'SpeedDial';

interface TriggerProps extends Omit<ButtonProps, 'ref'> {
  iconClosed?: LucideIcon;
  iconOpen?: LucideIcon;
  iconClassName?: string;
  iconSize?: number;
  openClassName?: string;
  closedClassName?: string;
  disableIconRotation?: boolean;
}

function SpeedDialTrigger({
  iconClosed = EllipsisVerticalIcon,
  iconOpen = XIcon,
  iconClassName,
  iconSize = 20,
  openClassName,
  closedClassName,
  disableIconRotation = false,
  className,
  ...props
}: TriggerProps) {
  const { open, toggle } = useSpeedDialContext();
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.set(
      withTiming(disableIconRotation || !open ? 0 : 90, {
        duration: 150,
        easing: easeOut
      })
    );
  }, [open, disableIconRotation, rotation]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }]
  }));

  const onPress = () => toggle();

  return (
    <Button
      onPress={onPress}
      size="icon-xl"
      variant="outline"
      className={cn(
        'rounded-full border-0 bg-primary/95',
        open ? openClassName : closedClassName,
        className
      )}
      {...props}
    >
      <Animated.View style={iconStyle}>
        <Icon
          as={open ? iconOpen : iconClosed}
          strokeWidth={2.5}
          size={iconSize}
          className={cn('text-secondary', iconClassName)}
        />
      </Animated.View>
    </Button>
  );
}
SpeedDialTrigger.displayName = 'SpeedDialTrigger';

function SpeedDialItems({ children, className }: ViewProps) {
  const arrayChildren = React.Children.toArray(children)
    .filter(React.isValidElement)
    .reverse();
  const { open } = useSpeedDialContext();

  return (
    <View className={cn('flex flex-col-reverse gap-1', className)}>
      {open
        ? arrayChildren.map((child, order) => (
            <Slot.Generic<ItemInjectedProps> key={order} _order={order}>
              {child}
            </Slot.Generic>
          ))
        : null}
    </View>
  );
}
SpeedDialItems.displayName = 'SpeedDialItems';

interface ItemProps {
  icon: LucideIcon;
  onPress: () => void;
  className?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  iconClassName?: string;
}

// Internal-only props injected by SpeedDialItems
interface ItemInjectedProps {
  _order?: number;
  _total?: number;
}

function SpeedDialItem({
  icon,
  onPress,
  className,
  variant,
  size,
  iconClassName,
  _order = 0
}: ItemProps & ItemInjectedProps) {
  const { setOpen, closeOnItemPress } = useSpeedDialContext();

  const handlePress = () => {
    if (closeOnItemPress) {
      setOpen(false);
    }
    onPress();
  };

  const offset = _order * 5;
  return (
    <Animated.View
      entering={FadeInUp.duration(150).delay(offset).easing(easeOut)}
      exiting={FadeOut.duration(120).easing(easeOut)}
    >
      <Button
        onPress={handlePress}
        size={size ?? 'icon-xl'}
        variant={variant}
        className={cn('bg-primary/95', className)}
      >
        <Icon
          as={icon}
          size={20}
          strokeWidth={2.5}
          className={cn('text-secondary', iconClassName)}
        />
      </Button>
    </Animated.View>
  );
}
SpeedDialItem.displayName = 'SpeedDialItem';

export { SpeedDial, SpeedDialItem, SpeedDialItems, SpeedDialTrigger };

export type { ItemProps as SpeedDialItemProps, SpeedDialProps };
