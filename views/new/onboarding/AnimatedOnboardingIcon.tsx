import { Icon } from '@/components/ui/icon';
import { getThemeColor } from '@/utils/styleUtils';
import { LucideIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';

interface AnimatedOnboardingIconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
  animationType?: 'pulse' | 'float' | 'scale' | 'rotate';
  delay?: number;
}

export function AnimatedOnboardingIcon({
  icon: IconComponent,
  size = 48,
  className,
  animationType = 'pulse',
  delay = 0
}: AnimatedOnboardingIconProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Fade in on mount
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.ease)
    });

    // Start animation after delay
    const timer = setTimeout(() => {
      if (animationType === 'pulse') {
        scale.value = withRepeat(
          withSequence(
            withTiming(1.1, {
              duration: 1000,
              easing: Easing.inOut(Easing.ease)
            }),
            withTiming(1, {
              duration: 1000,
              easing: Easing.inOut(Easing.ease)
            })
          ),
          -1,
          false
        );
      } else if (animationType === 'float') {
        translateY.value = withRepeat(
          withSequence(
            withTiming(-8, {
              duration: 1500,
              easing: Easing.inOut(Easing.ease)
            }),
            withTiming(0, {
              duration: 1500,
              easing: Easing.inOut(Easing.ease)
            })
          ),
          -1,
          false
        );
      } else if (animationType === 'scale') {
        scale.value = withRepeat(
          withSequence(
            withSpring(1.15, {
              damping: 8,
              stiffness: 100
            }),
            withSpring(1, {
              damping: 8,
              stiffness: 100
            })
          ),
          -1,
          false
        );
      } else if (animationType === 'rotate') {
        rotate.value = withRepeat(
          withTiming(360, {
            duration: 3000,
            easing: Easing.linear
          }),
          -1,
          false
        );
      }
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [animationType, delay, opacity, scale, translateY, rotate]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` }
      ],
      opacity: opacity.value
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <View className="h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        <Icon
          as={IconComponent}
          size={size}
          className={className || 'text-primary'}
        />
      </View>
    </Animated.View>
  );
}
