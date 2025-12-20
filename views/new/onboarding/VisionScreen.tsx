import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import type { ImageSourcePropType } from 'react-native';
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
import { VisionFlowAnimation } from './VisionFlowAnimation';

// Icon sources - using require for React Native image assets
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
const iconDark: ImageSourcePropType = require('@/assets/icons/icon_dark.png');
const iconLight: ImageSourcePropType = require('@/assets/icons/icon_light.png');

export function VisionScreen() {
  const { t } = useLocalization();
  const { colorScheme } = useColorScheme();
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const logoRotation = useSharedValue(0);

  // Determine which icon to use based on color scheme
  const iconSource = colorScheme === 'dark' ? iconDark : iconLight;

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
    <View className="flex-1 items-center justify-center gap-4 px-6">
      {/* Animated Logo */}
      <AnimatedStepContent delay={0}>
        <Animated.View style={logoStyle}>
          <View className="h-24 w-24 items-center justify-center">
            <Image
              source={iconSource}
              style={{ width: 96, height: 96 }}
              resizeMode="contain"
            />
          </View>
        </Animated.View>
      </AnimatedStepContent>

      {/* Vision Statement */}
      <AnimatedStepContent delay={300}>
        <View className="items-center gap-2">
          <Text
            variant="h2"
            className="text-center text-2xl font-bold leading-tight"
          >
            {t('onboardingVisionTitle')}
          </Text>
        </View>
      </AnimatedStepContent>

      {/* Value Proposition */}
      <AnimatedStepContent delay={500}>
        <View className="w-full">
          <Text
            variant="default"
            className="text-center text-base leading-relaxed text-muted-foreground"
          >
            {t('onboardingVisionSubtitle')}
          </Text>
        </View>
      </AnimatedStepContent>

      {/* Vision Details - Highlighted Box */}
      <AnimatedStepContent delay={700}>
        <Card className="w-full border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-center text-base font-semibold text-primary">
              {t('onboardingOurVision')}
            </CardTitle>
          </CardHeader>
          <CardContent className="gap-3 pt-0">
            {/* Flow Animation */}
            <View className="w-full items-center justify-center py-2">
              <VisionFlowAnimation />
            </View>
            <Text
              variant="default"
              className="text-center text-base font-medium leading-relaxed"
            >
              {t('onboardingVisionStatement1')}
            </Text>
            <Text
              variant="default"
              className="text-center text-base font-medium leading-relaxed"
            >
              {t('onboardingVisionStatement2')}
            </Text>
          </CardContent>
        </Card>
      </AnimatedStepContent>

      {/* CC0 Note */}
      <AnimatedStepContent delay={900}>
        <View className="w-full">
          <Text
            variant="small"
            className="text-center text-xs leading-relaxed text-muted-foreground/80"
          >
            {t('onboardingVisionCC0')}
          </Text>
        </View>
      </AnimatedStepContent>
    </View>
  );
}
