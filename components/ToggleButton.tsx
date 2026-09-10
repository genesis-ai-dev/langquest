import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { easeOut } from '@/constants/animations';
import { cn, useThemeColor } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

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

const TRANSITION_MS = 220;

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
  const selectedProgress = useSharedValue(selected ? 1 : 0);

  React.useEffect(() => {
    selectedProgress.set(
      withTiming(selected ? 1 : 0, {
        duration: TRANSITION_MS,
        easing: easeOut
      })
    );
  }, [selected, selectedProgress]);

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: selectedProgress.get()
  }));

  return (
    <Pressable role="button" onPress={onPress} disabled={disabled}>
      <Animated.View
        layout={LinearTransition.duration(TRANSITION_MS).easing(easeOut)}
        style={{
          height: 32,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          paddingHorizontal: 10,
          overflow: 'hidden',
          gap: 6
        }}
      >
        {/* Fundo com opacity animada — evita interpolação de cor errada */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: primaryColor,
              borderRadius: 999
            },
            backgroundStyle
          ]}
        />
        <Icon
          as={icon}
          size={14}
          className={
            selected ? 'text-primary-foreground' : 'text-muted-foreground'
          }
        />
        {selected ? (
          <Animated.View
            entering={FadeIn.duration(TRANSITION_MS).easing(easeOut)}
            exiting={FadeOut.duration(160).easing(easeOut)}
          >
            <Text
              className="text-xs font-medium text-primary-foreground"
              numberOfLines={1}
            >
              {text}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
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
