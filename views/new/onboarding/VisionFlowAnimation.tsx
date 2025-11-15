import { Icon } from '@/components/ui/icon';
import { GlobeIcon, UsersIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

export function VisionFlowAnimation() {
  // Globe animation
  const globeOpacity = useSharedValue(0);
  const globeScale = useSharedValue(0.8);

  // Users animation
  const usersOpacity = useSharedValue(0);
  const usersScale = useSharedValue(0.8);

  // Particles flowing from globe to users with arcing motion
  // Each particle has X (horizontal) and Y (vertical arc) movement
  const particle1X = useSharedValue(0);
  const particle1Y = useSharedValue(0);
  const particle1Opacity = useSharedValue(0);
  
  const particle2X = useSharedValue(0);
  const particle2Y = useSharedValue(0);
  const particle2Opacity = useSharedValue(0);
  
  const particle3X = useSharedValue(0);
  const particle3Y = useSharedValue(0);
  const particle3Opacity = useSharedValue(0);

  // Particles flowing from users back to globe with arcing motion
  const returnParticle1X = useSharedValue(0);
  const returnParticle1Y = useSharedValue(0);
  const returnParticle1Opacity = useSharedValue(0);
  
  const returnParticle2X = useSharedValue(0);
  const returnParticle2Y = useSharedValue(0);
  const returnParticle2Opacity = useSharedValue(0);
  
  const returnParticle3X = useSharedValue(0);
  const returnParticle3Y = useSharedValue(0);
  const returnParticle3Opacity = useSharedValue(0);

  useEffect(() => {
    // Animate globe in
    globeOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    globeScale.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));

    // Animate users in
    usersOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    usersScale.value = withDelay(400, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));

    // Flow from globe to users with arcing paths
    const flowToUsers = () => {
      // Reset particles - start from globe position (shifted left)
      particle1X.value = -100;
      particle1Y.value = 0;
      particle1Opacity.value = 0;
      particle2X.value = -100;
      particle2Y.value = 0;
      particle2Opacity.value = 0;
      particle3X.value = -100;
      particle3Y.value = 0;
      particle3Opacity.value = 0;

      // Particle 1: Arc up then down
      particle1Opacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 150 })
      );
      particle1X.value = withTiming(100, {
        duration: 1200,
        easing: Easing.out(Easing.ease)
      });
      particle1Y.value = withSequence(
        withTiming(-12, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) })
      );

      // Particle 2: Arc down then up (different path)
      particle2Opacity.value = withDelay(
        300,
        withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(1, { duration: 900 }),
          withTiming(0, { duration: 150 })
        )
      );
      particle2X.value = withDelay(
        300,
        withTiming(100, {
          duration: 1200,
          easing: Easing.out(Easing.ease)
        })
      );
      particle2Y.value = withDelay(
        300,
        withSequence(
          withTiming(8, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) })
        )
      );

      // Particle 3: Higher arc
      particle3Opacity.value = withDelay(
        600,
        withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(1, { duration: 900 }),
          withTiming(0, { duration: 150 })
        )
      );
      particle3X.value = withDelay(
        600,
        withTiming(100, {
          duration: 1200,
          easing: Easing.out(Easing.ease)
        })
      );
      particle3Y.value = withDelay(
        600,
        withSequence(
          withTiming(-16, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) })
        )
      );
    };

    // Flow from users back to globe with arcing paths
    const flowToGlobe = () => {
      // Reset return particles (start from users position - on the right)
      returnParticle1X.value = 100;
      returnParticle1Y.value = 0;
      returnParticle1Opacity.value = 0;
      returnParticle2X.value = 100;
      returnParticle2Y.value = 0;
      returnParticle2Opacity.value = 0;
      returnParticle3X.value = 100;
      returnParticle3Y.value = 0;
      returnParticle3Opacity.value = 0;

      // Return Particle 1: Arc up then down
      returnParticle1Opacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 150 })
      );
      returnParticle1X.value = withTiming(-100, {
        duration: 1200,
        easing: Easing.out(Easing.ease)
      });
      returnParticle1Y.value = withSequence(
        withTiming(-10, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) })
      );

      // Return Particle 2: Arc down then up
      returnParticle2Opacity.value = withDelay(
        400,
        withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(1, { duration: 900 }),
          withTiming(0, { duration: 150 })
        )
      );
      returnParticle2X.value = withDelay(
        400,
        withTiming(-100, {
          duration: 1200,
          easing: Easing.out(Easing.ease)
        })
      );
      returnParticle2Y.value = withDelay(
        400,
        withSequence(
          withTiming(12, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) })
        )
      );

      // Return Particle 3: Lower arc
      returnParticle3Opacity.value = withDelay(
        800,
        withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(1, { duration: 900 }),
          withTiming(0, { duration: 150 })
        )
      );
      returnParticle3X.value = withDelay(
        800,
        withTiming(-100, {
          duration: 1200,
          easing: Easing.out(Easing.ease)
        })
      );
      returnParticle3Y.value = withDelay(
        800,
        withSequence(
          withTiming(-14, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) })
        )
      );
    };

    // Start flow to users
    flowToUsers();
    
    // After particles reach users, start return flow
    const returnDelay = setTimeout(() => {
      flowToGlobe();
    }, 1500);

    // Repeat both flows continuously
    const flowInterval = setInterval(() => {
      flowToUsers();
      setTimeout(() => {
        flowToGlobe();
      }, 1500);
    }, 3000);

    return () => {
      clearTimeout(returnDelay);
      clearInterval(flowInterval);
    };
  }, [
    globeOpacity,
    globeScale,
    usersOpacity,
    usersScale,
    particle1X,
    particle1Y,
    particle1Opacity,
    particle2X,
    particle2Y,
    particle2Opacity,
    particle3X,
    particle3Y,
    particle3Opacity,
    returnParticle1X,
    returnParticle1Y,
    returnParticle1Opacity,
    returnParticle2X,
    returnParticle2Y,
    returnParticle2Opacity,
    returnParticle3X,
    returnParticle3Y,
    returnParticle3Opacity
  ]);

  const globeStyle = useAnimatedStyle(() => ({
    opacity: globeOpacity.value,
    transform: [{ scale: globeScale.value }]
  }));

  const usersStyle = useAnimatedStyle(() => ({
    opacity: usersOpacity.value,
    transform: [{ scale: usersScale.value }]
  }));

  const particle1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: particle1X.value },
      { translateY: particle1Y.value }
    ],
    opacity: particle1Opacity.value
  }));

  const particle2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: particle2X.value },
      { translateY: particle2Y.value }
    ],
    opacity: particle2Opacity.value
  }));

  const particle3Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: particle3X.value },
      { translateY: particle3Y.value }
    ],
    opacity: particle3Opacity.value
  }));

  const returnParticle1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: returnParticle1X.value },
      { translateY: returnParticle1Y.value }
    ],
    opacity: returnParticle1Opacity.value
  }));

  const returnParticle2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: returnParticle2X.value },
      { translateY: returnParticle2Y.value }
    ],
    opacity: returnParticle2Opacity.value
  }));

  const returnParticle3Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: returnParticle3X.value },
      { translateY: returnParticle3Y.value }
    ],
    opacity: returnParticle3Opacity.value
  }));

  return (
    <View className="relative h-24 w-full flex-row items-center justify-center px-8">
      {/* Globe Icon (left) with background circle */}
      <Animated.View style={globeStyle}>
        <View className="relative h-20 w-20 items-center justify-center">
          {/* Semi-transparent background circle */}
          <View className="absolute h-20 w-20 rounded-full bg-background/60 border border-border/50" />
          <View className="relative h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Icon as={GlobeIcon} size={28} className="text-primary" />
          </View>
        </View>
      </Animated.View>

      {/* Flow particles arcing between globe and users */}
      <View className="relative h-full flex-1 items-center justify-center">
        {/* Particles flowing from globe to users */}
        <Animated.View style={particle1Style} className="absolute">
          <View className="h-2 w-2 rounded-full bg-primary" />
        </Animated.View>
        <Animated.View style={particle2Style} className="absolute">
          <View className="h-1.5 w-1.5 rounded-full bg-primary/80" />
        </Animated.View>
        <Animated.View style={particle3Style} className="absolute">
          <View className="h-2 w-2 rounded-full bg-primary" />
        </Animated.View>
        
        {/* Particles flowing from users back to globe */}
        <Animated.View style={returnParticle1Style} className="absolute">
          <View className="h-2 w-2 rounded-full bg-primary" />
        </Animated.View>
        <Animated.View style={returnParticle2Style} className="absolute">
          <View className="h-1.5 w-1.5 rounded-full bg-primary/80" />
        </Animated.View>
        <Animated.View style={returnParticle3Style} className="absolute">
          <View className="h-2 w-2 rounded-full bg-primary" />
        </Animated.View>
      </View>

      {/* Users Icon (right) with background circle */}
      <Animated.View style={usersStyle}>
        <View className="relative h-20 w-20 items-center justify-center">
          {/* Semi-transparent background circle */}
          <View className="absolute h-20 w-20 rounded-full bg-background/60 border border-border/50" />
          <View className="relative h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Icon as={UsersIcon} size={28} className="text-primary" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

