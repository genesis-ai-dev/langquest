import { getThemeColor } from '@/utils/styleUtils';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

interface RecordingAnimationProps {
  size?: number;
}

export function RecordingAnimation({ size = 96 }: RecordingAnimationProps) {
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1);
  const scale3 = useSharedValue(1);
  const opacity1 = useSharedValue(0.6);
  const opacity2 = useSharedValue(0.4);
  const opacity3 = useSharedValue(0.2);

  useEffect(() => {
    // Animate three concentric circles pulsing outward
    scale1.value = withRepeat(
      withSequence(
        withTiming(1.5, {
          duration: 1500,
          easing: Easing.out(Easing.ease)
        }),
        withTiming(1, {
          duration: 0
        })
      ),
      -1,
      false
    );

    opacity1.value = withRepeat(
      withSequence(
        withTiming(0, {
          duration: 1500,
          easing: Easing.out(Easing.ease)
        }),
        withTiming(0.6, {
          duration: 0
        })
      ),
      -1,
      false
    );

    scale2.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 0
        }),
        withTiming(1.5, {
          duration: 1500,
          easing: Easing.out(Easing.ease)
        }),
        withTiming(1, {
          duration: 0
        })
      ),
      -1,
      false
    );

    opacity2.value = withRepeat(
      withSequence(
        withTiming(0.4, {
          duration: 0
        }),
        withTiming(0, {
          duration: 1500,
          easing: Easing.out(Easing.ease)
        }),
        withTiming(0.4, {
          duration: 0
        })
      ),
      -1,
      false
    );

    scale3.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 0
        }),
        withTiming(1, {
          duration: 500
        }),
        withTiming(1.5, {
          duration: 1500,
          easing: Easing.out(Easing.ease)
        }),
        withTiming(1, {
          duration: 0
        })
      ),
      -1,
      false
    );

    opacity3.value = withRepeat(
      withSequence(
        withTiming(0.2, {
          duration: 0
        }),
        withTiming(0.2, {
          duration: 500
        }),
        withTiming(0, {
          duration: 1500,
          easing: Easing.out(Easing.ease)
        }),
        withTiming(0.2, {
          duration: 0
        })
      ),
      -1,
      false
    );
  }, [scale1, scale2, scale3, opacity1, opacity2, opacity3]);

  const circle1Style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale1.value }],
      opacity: opacity1.value
    };
  });

  const circle2Style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale2.value }],
      opacity: opacity2.value
    };
  });

  const circle3Style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale3.value }],
      opacity: opacity3.value
    };
  });

  const center = size / 2;
  const radius = size / 2 - 8;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Wrap each circle in Animated.View for web compatibility */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center'
          },
          circle1Style
        ]}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={getThemeColor('primary')}
            strokeWidth="2"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center'
          },
          circle2Style
        ]}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={getThemeColor('primary')}
            strokeWidth="2"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center'
          },
          circle3Style
        ]}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={getThemeColor('primary')}
            strokeWidth="2"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

