import { cn } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import { EllipsisVerticalIcon, XIcon } from 'lucide-react-native';
import { AnimatePresence, MotiView } from 'moti';
import * as React from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';
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

interface TriggerProps extends ButtonProps {
  iconClosed?: LucideIcon;
  iconOpen?: LucideIcon;
}

function SpeedDialTrigger({
  iconClosed = EllipsisVerticalIcon,
  iconOpen = XIcon,
  className,
  ...props
}: TriggerProps) {
  const { open, toggle } = useSpeedDialContext();
  const onPress = () => toggle();

  return (
    <Button
      onPress={onPress}
      size="icon-xl"
      variant="outline"
      className={cn(!open && 'opacity-50', className)}
      {...props}
    >
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: open ? '90deg' : '0deg' }}
        transition={{ duration: 150, type: 'timing' }}
      >
        <Icon as={open ? iconOpen : iconClosed} strokeWidth={2.5} size={20} />
      </MotiView>
    </Button>
  );
}
SpeedDialTrigger.displayName = 'SpeedDialTrigger';

function SpeedDialItems({ children, className }: ViewProps) {
  const arrayChildren = React.Children.toArray(children)
    .filter(React.isValidElement)
    .reverse();
  const { open } = useSpeedDialContext();

  //   return <Portal name="speed-dial">{content}</Portal>;
  return (
    <AnimatePresence>
      {open && (
        <View className={cn('flex flex-col-reverse gap-1', className)}>
          {arrayChildren.map((child, order) => {
            return (
              <Slot.Generic<ItemInjectedProps> key={order} _order={order}>
                {child}
              </Slot.Generic>
            );
          })}
        </View>
      )}
    </AnimatePresence>
  );
}
SpeedDialItems.displayName = 'SpeedDialItems';

interface ItemProps {
  icon: LucideIcon;
  onPress: () => void;
  className?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
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
    <MotiView
      from={{
        translateY: offset,
        opacity: 0,
        scale: 0.95
      }}
      animate={{
        opacity: 1,
        scale: 1,
        translateY: [-2, 0]
      }}
      exit={{
        translateY: 0,
        opacity: 0,
        scale: 0.95
      }}
      transition={{
        type: 'timing',
        duration: 150,
        delay: offset
        // loop: true
      }}
    >
      <Button
        onPress={handlePress}
        size="icon-xl"
        variant={variant}
        className={className}
      >
        <Icon as={icon} size={20} strokeWidth={2.5} />
      </Button>
    </MotiView>
  );
}
SpeedDialItem.displayName = 'SpeedDialItem';

export { SpeedDial, SpeedDialItem, SpeedDialItems, SpeedDialTrigger };

export type { ItemProps as SpeedDialItemProps, SpeedDialProps };
