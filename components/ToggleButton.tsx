import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn, useThemeColor } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type ToggleSide = 'left' | 'right';

interface ToggleButtonProps {
  value: ToggleSide;
  onValueChange?: (value: ToggleSide) => void;
  leftIcon: LucideIcon;
  rightIcon: LucideIcon;
  leftText: string;
  rightText: string;
  minWidth?: number;
  disabled?: boolean;
  className?: string;
}

const TRANSITION = { type: 'timing', duration: 220 } as const;

function ToggleOption({
  selected,
  icon,
  text,
  onPress,
  disabled,
  primaryColor
}: {
  selected: boolean;
  icon: LucideIcon;
  text: string;
  onPress: () => void;
  disabled?: boolean;
  primaryColor: string;
}) {
  return (
    <Pressable role="button" onPress={onPress} disabled={disabled}>
      <View
        style={{
          height: 32,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          paddingHorizontal: 10,
          overflow: 'hidden'
        }}
      >
        {/* Fundo com opacity animada — evita interpolação de cor errada */}
        <MotiView
          animate={{ opacity: selected ? 1 : 0 }}
          transition={TRANSITION}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: primaryColor,
            borderRadius: 999
          }}
        />
        <Icon
          as={icon}
          size={14}
          className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        />
        <MotiView
          animate={{
            maxWidth: selected ? 120 : 0,
            opacity: selected ? 1 : 0,
            marginLeft: selected ? 6 : 0
          }}
          transition={TRANSITION}
          style={{ overflow: 'hidden' }}
        >
          <Text className="text-xs font-medium text-primary-foreground" numberOfLines={1}>
            {text}
          </Text>
        </MotiView>
      </View>
    </Pressable>
  );
}

export function ToggleButton({
  value,
  onValueChange,
  leftIcon,
  rightIcon,
  leftText,
  rightText,
  minWidth = 132,
  disabled,
  className
}: ToggleButtonProps) {
  const isLeftSelected = value === 'left';
  const primaryColor = useThemeColor('primary');

  return (
    <View
      style={{ minWidth }}
      className={cn(
        'flex-row items-center justify-between rounded-full border border-border bg-muted p-0.5',
        disabled && 'opacity-50',
        className
      )}
    >
      <ToggleOption
        selected={isLeftSelected}
        icon={leftIcon}
        text={leftText}
        onPress={() => onValueChange?.('left')}
        disabled={disabled}
        primaryColor={primaryColor}
      />
      <ToggleOption
        selected={!isLeftSelected}
        icon={rightIcon}
        text={rightText}
        onPress={() => onValueChange?.('right')}
        disabled={disabled}
        primaryColor={primaryColor}
      />
    </View>
  );
}

export type { ToggleButtonProps, ToggleSide };

