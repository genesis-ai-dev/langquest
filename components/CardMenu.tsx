import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import type { LucideIcon } from 'lucide-react-native';
import { EllipsisIcon, XIcon } from 'lucide-react-native';
import { AnimatePresence, MotiView } from 'moti';
import * as React from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export type CardMenuDirection = 'left' | 'right';
export type CardMenuActionTone = 'default' | 'destructive';

export interface CardMenuAction {
  icon: LucideIcon;
  onPress: () => void;
  confirmMessage: string;
  confirmTitle: string;
  accessibilityLabel?: string;
  /** Visual tone of the action button. Defaults to `default`. */
  tone?: CardMenuActionTone;
  id?: string;
}

export interface CardMenuProps {
  actions: CardMenuAction[];
  /** Side the actions expand toward. */
  direction?: CardMenuDirection;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const TRIGGER_ICON_SIZE = 16;
const ACTION_ICON_SIZE = 20;
const TRIGGER_BUTTON_CLASS =
  'size-8 rounded-full border-0 bg-primary/95 text-destructive-foreground';
const ACTION_BUTTON_CLASS = 'size-14 rounded-full border-0';

function getActionKey(action: CardMenuAction, index: number): string {
  if (action.id) {
    return action.id;
  }
  const iconName = action.icon.displayName;
  if (iconName) {
    return `${iconName}-${action.confirmMessage}`;
  }
  return `card-menu-action-${String(index)}`;
}

function CardMenuItem({
  action,
  order,
  direction,
  reduceMotion,
  onSelect
}: {
  action: CardMenuAction;
  order: number;
  direction: CardMenuDirection;
  reduceMotion: boolean;
  onSelect: (action: CardMenuAction) => void;
}) {
  const handlePress = () => {
    onSelect(action);
  };

  const tone = action.tone ?? 'default';
  const isDestructive = tone === 'destructive';
  const enterOffset = direction === 'left' ? 8 : -8;

  return (
    <MotiView
      from={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.9, translateX: enterOffset }
      }
      animate={{ opacity: 1, scale: 1, translateX: 0 }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.9, translateX: enterOffset }
      }
      transition={{
        type: 'timing',
        duration: 200,
        delay: reduceMotion ? 0 : order * 40
      }}
      exitTransition={{
        type: 'timing',
        duration: 150
      }}
    >
      <Button
        size="icon-lg"
        variant="plain"
        onPress={handlePress}
        data-tone={tone}
        className={cn(
          ACTION_BUTTON_CLASS,
          isDestructive ? 'bg-red-100' : 'bg-muted'
        )}
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel ?? action.confirmMessage}
      >
        <Icon
          as={action.icon}
          size={ACTION_ICON_SIZE}
          strokeWidth={2.5}
          className={isDestructive ? 'text-destructive' : 'text-primary'}
        />
      </Button>
    </MotiView>
  );
}

/**
 * Horizontal SpeedDial sized for a quest version card.
 * Expands left or right and confirms before running each action.
 */
export function CardMenu({
  actions,
  direction = 'left',
  open: openProp,
  onOpenChange,
  disabled,
  className
}: CardMenuProps) {
  const { t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleSelect = (action: CardMenuAction) => {
    setOpen(false);
    RNAlert.alert(action.confirmTitle, action.confirmMessage, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: action.tone === 'destructive' ? 'destructive' : 'default',
        isPreferred: true,
        onPress: action.onPress
      }
    ]);
  };

  if (actions.length === 0) {
    return null;
  }

  const items = (
    <View
      data-slot="card-menu-items"
      className={cn(
        'absolute z-50 flex-row items-center gap-1',
        direction === 'left'
          ? 'right-full top-1/2 -translate-y-1/2 flex-row-reverse pr-1'
          : 'left-full top-1/2 -translate-y-1/2 pl-1'
      )}
    >
      <AnimatePresence>
        {open
          ? actions.map((action, index) => (
              <CardMenuItem
                key={getActionKey(action, index)}
                action={action}
                order={index}
                direction={direction}
                reduceMotion={reduceMotion}
                onSelect={handleSelect}
              />
            ))
          : null}
      </AnimatePresence>
    </View>
  );

  return (
    <View
      data-slot="card-menu"
      data-state={open ? 'open' : 'closed'}
      data-direction={direction}
      className={cn('relative z-50 items-center justify-center', className)}
    >
      <View className="flex-row items-center">
        {direction === 'left' ? items : null}
        <Button
          size="icon-sm"
          variant="outline"
          disabled={disabled}
          onPress={handleToggle}
          className={TRIGGER_BUTTON_CLASS}
          accessibilityRole="button"
          accessibilityLabel={t('options')}
          accessibilityState={{ expanded: open, disabled: !!disabled }}
        >
          <MotiView
            from={{ rotate: '0deg' }}
            animate={{ rotate: open ? '90deg' : '0deg' }}
            transition={{ duration: reduceMotion ? 0 : 150, type: 'timing' }}
          >
            <Icon
              as={open ? XIcon : EllipsisIcon}
              size={TRIGGER_ICON_SIZE}
              strokeWidth={2.5}
              className="text-secondary"
            />
          </MotiView>
        </Button>
        {direction === 'right' ? items : null}
      </View>
    </View>
  );
}
