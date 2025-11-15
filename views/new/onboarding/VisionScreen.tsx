import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { AnimatedStepContent } from './AnimatedStepContent';

export function VisionScreen() {
  const { t } = useLocalization();
  const { colorScheme } = useColorScheme();
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const logoRotation = useSharedValue(0);

  // Determine which icon to use based on color scheme
  const iconSource =
    colorScheme === 'dark'
      ? require('@/assets/icons/icon_dark.png')
      : require('@/assets/icons/icon_light.png');

  useEffect(() => {
    // Fade in and scale up logo
    logoOpacity.value = withDelay(
      200,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.ease)
      })
    );

    logoScale.value = withDelay(
      200,
      withSpring(1, {
        damping: 12,
        stiffness: 100
      })
    );

    // Subtle rotation animation (very slow, barely noticeable)
    logoRotation.value = withRepeat(
      withSequence(
        withTiming(2, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease)
        }),
        withTiming(-2, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease)
        })
      ),
      -1,
      false
    );
  }, [logoOpacity, logoScale, logoRotation]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotation.value}deg` }
    ],
    opacity: logoOpacity.value
  }));

  return (
    <View className="flex-1 items-center justify-center gap-8 px-6">
      {/* Animated Logo */}
      <AnimatedStepContent delay={0}>
        <Animated.View style={logoStyle}>
          <View className="h-32 w-32 items-center justify-center">
            <Image
              source={iconSource}
              style={{ width: 128, height: 128 }}
              resizeMode="contain"
            />
          </View>
        </Animated.View>
      </AnimatedStepContent>

      {/* Vision Statement */}
      <AnimatedStepContent delay={400}>
        <View className="items-center gap-6">
          <Text
            variant="h1"
            className="text-center text-3xl font-bold leading-tight"
          >
            {t('onboardingVisionTitle') || 'Every language. Every culture. One vision.'}
          </Text>
        </View>
      </AnimatedStepContent>

      {/* Value Proposition */}
      <AnimatedStepContent delay={600}>
        <View className="w-full gap-4">
          <Text
            variant="default"
            className="text-center text-lg leading-relaxed text-muted-foreground"
          >
            {t('onboardingVisionSubtitle') ||
              'Collect text and audio language data quickly. Local-first, sync when connected. Collaborate, translate, validate.'}
          </Text>
        </View>
      </AnimatedStepContent>

      {/* Vision Details */}
      <AnimatedStepContent delay={800}>
        <View className="w-full gap-3">
          <Text
            variant="default"
            className="text-center text-base leading-relaxed"
          >
            {t('onboardingVisionStatement1') ||
              'Every language having access to the world\'s knowledge.'}
          </Text>
          <Text
            variant="default"
            className="text-center text-base leading-relaxed"
          >
            {t('onboardingVisionStatement2') ||
              'Every culture sharing its meaning with the world.'}
          </Text>
        </View>
      </AnimatedStepContent>

      {/* CC0 Note */}
      <AnimatedStepContent delay={1000}>
        <View className="w-full">
          <Text
            variant="small"
            className="text-center text-sm leading-relaxed text-muted-foreground/80"
          >
            {t('onboardingVisionCC0') ||
              'CC0/public domain data ensures no party can stop this vision.'}
          </Text>
        </View>
      </AnimatedStepContent>
    </View>
  );
}

