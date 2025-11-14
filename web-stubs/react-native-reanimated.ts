// @prettier-ignore-file
// Complete web stub for react-native-reanimated
// This is a standalone implementation that doesn't import from the real package

import type { ComponentType } from 'react';
import { Animated as AnimatedRN, Image, Text, View } from 'react-native';

// No-op functions
const NOOP = (): void => {};
const NOOP_FACTORY = <T extends (...args: any[]) => any>(): T => NOOP as T;
const ID = <T>(t: T): T => t;
const IMMEDIATE_CALLBACK_INVOCATION = <T>(callback: () => T): T => callback();

// SharedValue type
interface SharedValue<T> {
  value: T;
  get(): T;
  set(newValue: T | ((current: T) => T)): void;
  modify(modifier: (current: T) => T): void;
}

// SharedValue implementation
function useSharedValue<T>(init: T): SharedValue<T> {
  const value = {
    value: init
  };
  return new Proxy(value, {
    get(target, prop) {
      if (prop === 'value') {
        return target.value;
      }
      if (prop === 'get') {
        return () => target.value;
      }
      if (prop === 'set') {
        return (newValue: T | ((current: T) => T)) => {
          if (typeof newValue === 'function') {
            target.value = (newValue as (current: T) => T)(target.value);
          } else {
            target.value = newValue;
          }
        };
      }
      if (prop === 'modify') {
        return (modifier: (current: T) => T) => {
          if (typeof modifier === 'function') {
            target.value = modifier(target.value);
          }
        };
      }
      return (target as any)[prop];
    },
    set(target, prop, newValue) {
      if (prop === 'value') {
        target.value = newValue as T;
        return true;
      }
      return false;
    }
  }) as SharedValue<T>;
}

// Hooks
const useAnimatedProps = IMMEDIATE_CALLBACK_INVOCATION;
const useAnimatedStyle = IMMEDIATE_CALLBACK_INVOCATION;
const useAnimatedReaction = <T>(
  dependency: SharedValue<T>,
  reaction: (value: T) => void
): void => {};
const useAnimatedRef = <T>() => ({
  current: null as T | null
});
const useAnimatedScrollHandler = <T extends Record<string, any>>(
  handlers: T,
  dependencies?: any[]
): T => handlers;
const useDerivedValue = <T>(processor: () => T): SharedValue<T> => {
  const result = processor();
  return {
    value: result,
    get: () => result,
    set: () => {},
    modify: () => {}
  } as SharedValue<T>;
};
const useAnimatedSensor = () => ({
  sensor: {
    value: {
      x: 0,
      y: 0,
      z: 0,
      interfaceOrientation: 0,
      qw: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      yaw: 0,
      pitch: 0,
      roll: 0
    }
  },
  unregister: NOOP,
  isAvailable: false,
  config: {
    interval: 0,
    adjustToInterfaceOrientation: false,
    iosReferenceFrame: 0
  }
});
const useAnimatedKeyboard = () => ({
  height: {
    value: 0
  },
  state: {
    value: 0
  }
});
const useScrollViewOffset = () => ({
  value: 0
});
const useScrollOffset = () => ({
  value: 0
});
const useFrameCallback = (
  _callback: (frameInfo: { timestamp: number }) => void
): void => {};
const useEvent = <T extends (...args: any[]) => any>(): T => NOOP as T;
const useReducedMotion = (): boolean => false;

// runOnJS - on web, just execute the function directly
const runOnJS = <Args extends unknown[], ReturnValue>(
  fn: (...args: Args) => ReturnValue
): ((...args: Args) => ReturnValue) => {
  if (typeof fn === 'function') {
    return (...args: Args) => {
      try {
        return fn(...args);
      } catch (error) {
        console.warn('Error in runOnJS callback:', error);
        throw error;
      }
    };
  }
  return fn as (...args: Args) => ReturnValue;
};

// runOnUI - on web, UI thread is the same as JS thread, so just execute directly
const runOnUI = <Args extends unknown[], ReturnValue>(
  fn: (...args: Args) => ReturnValue
): ((...args: Args) => ReturnValue) => {
  if (typeof fn === 'function') {
    return (...args: Args) => {
      try {
        return fn(...args);
      } catch (error) {
        console.warn('Error in runOnUI callback:', error);
        throw error;
      }
    };
  }
  return fn as (...args: Args) => ReturnValue;
};

// makeMutable - creates a mutable shared value (same as useSharedValue on web)
const makeMutable = <T>(init: T): SharedValue<T> => {
  const value = {
    value: init
  };
  return new Proxy(value, {
    get(target, prop) {
      if (prop === 'value') {
        return target.value;
      }
      if (prop === 'get') {
        return () => target.value;
      }
      if (prop === 'set') {
        return (newValue: T | ((current: T) => T)) => {
          if (typeof newValue === 'function') {
            target.value = (newValue as (current: T) => T)(target.value);
          } else {
            target.value = newValue;
          }
        };
      }
      if (prop === 'modify') {
        return (modifier: (current: T) => T) => {
          if (typeof modifier === 'function') {
            target.value = modifier(target.value);
          }
        };
      }
      return (target as any)[prop];
    },
    set(target, prop, newValue) {
      if (prop === 'value') {
        target.value = newValue as T;
        return true;
      }
      return false;
    }
  }) as SharedValue<T>;
};

// scrollTo - on web, just a no-op since we don't have native scroll views
const scrollTo = (
  _ref: any,
  _x: number,
  _y: number,
  _animated?: boolean
): void => {};

// Animation functions
const cancelAnimation = (_sharedValue: SharedValue<any>): void => {};
const withDecay = (
  _userConfig: any,
  callback?: (finished: boolean) => void
): number => {
  callback?.(true);
  return 0;
};
const withDelay = <T>(_delayMs: number, nextAnimation: T): T => nextAnimation;
const withRepeat = <T>(animation: T): T => animation;
const withSequence = (..._animations: any[]): number => 0;
const withSpring = (
  toValue: number,
  _userConfig?: any,
  callback?: (finished: boolean) => void
): number => {
  callback?.(true);
  return toValue;
};
const withTiming = (
  toValue: number,
  _userConfig?: any,
  callback?: (finished: boolean) => void
): number => {
  callback?.(true);
  return toValue;
};
const withClamp = <T>(animation: T): T => animation;

// Interpolation
const interpolate = (
  value: number,
  inputRange: number[],
  outputRange: number[],
  _options?: any
): number => {
  // Simple linear interpolation
  if (inputRange.length !== outputRange.length) return outputRange[0] || 0;
  if (value <= inputRange[0]) return outputRange[0];
  if (value >= inputRange[inputRange.length - 1])
    return outputRange[outputRange.length - 1];

  for (let i = 0; i < inputRange.length - 1; i++) {
    if (value >= inputRange[i] && value <= inputRange[i + 1]) {
      const ratio =
        (value - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return outputRange[i] + (outputRange[i + 1] - outputRange[i]) * ratio;
    }
  }
  return outputRange[0] || 0;
};

const interpolateColor = (
  _value: number,
  _inputRange: number[],
  outputRange: string[]
): string => {
  return outputRange[0] || '#000000';
};

// Easing
const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t * (2 - t),
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  poly: (n: number) => (t: number) => Math.pow(t, n),
  sin: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  circle: (t: number) => 1 - Math.sqrt(1 - t * t),
  exp: (t: number) => Math.pow(2, 10 * (t - 1)),
  elastic: (bounciness: number) => (t: number) => {
    const p = bounciness * Math.PI;
    return 1 - Math.pow(Math.cos((t * Math.PI) / 2), 3) * Math.cos(t * p);
  },
  back: (s: number) => (t: number) => t * t * ((s + 1) * t - s),
  bounce: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  },
  bezier: () => (t: number) => t,
  in: <T>(easing: T): T => easing,
  out: <T>(easing: T): T => easing,
  inOut: <T>(easing: T): T => easing
};

// Constants - defined before Animated so it can reference them
const Extrapolation = {
  IDENTITY: 'identity',
  CLAMP: 'clamp',
  EXTEND: 'extend'
} as const;

// Animated components
const createAnimatedComponent = <P extends object>(
  component: ComponentType<P>
): ComponentType<P> => component;

// Define addWhitelistedUIProps and addWhitelistedNativeProps as proper functions
const addWhitelistedUIProps = (_props: string[]): void => {};
const addWhitelistedNativeProps = (_props: string[]): void => {};

const Animated = {
  View: View,
  Text: Text,
  Image: Image,
  ScrollView: (AnimatedRN.ScrollView || View) as ComponentType<any>,
  FlatList: (AnimatedRN.FlatList || View) as ComponentType<any>,
  SectionList: (AnimatedRN.SectionList || View) as ComponentType<any>,
  Extrapolate: Extrapolation, // Alias for Extrapolation
  interpolate: NOOP, // No-op on web
  interpolateColor: NOOP, // No-op on web
  clamp: NOOP, // No-op on web
  createAnimatedComponent,
  addWhitelistedUIProps,
  addWhitelistedNativeProps
};

const ReanimatedLogLevel = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
} as const;

const configureReanimatedLogger = (_config: any): void => {};

// ReduceMotion constant
const ReduceMotion = {
  Off: 'off',
  On: 'on',
  Auto: 'auto'
} as const;

// Entry animations (no-op on web)
const FadeIn = {};
const FadeOut = {};
const SlideInDown = {};
const SlideInUp = {};
const SlideInLeft = {};
const SlideInRight = {};
const SlideOutDown = {};
const SlideOutUp = {};
const SlideOutLeft = {};
const SlideOutRight = {};

// Type exports (no-op on web)
const ColorSpace = {};
const InterfaceOrientation = {};
const IOSReferenceFrame = {};
const KeyboardState = {};
const SensorType = {};

// Ensure Animated has all required methods (defensive check)
if (!Animated.addWhitelistedUIProps) {
  Animated.addWhitelistedUIProps = addWhitelistedUIProps;
}
if (!Animated.addWhitelistedNativeProps) {
  Animated.addWhitelistedNativeProps = addWhitelistedNativeProps;
}

// Verify Animated object has the required methods (for debugging)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  if (
    !Animated.addWhitelistedUIProps ||
    typeof Animated.addWhitelistedUIProps !== 'function'
  ) {
    console.error(
      '[REANIMATED STUB] Animated.addWhitelistedUIProps is missing or not a function!',
      {
        hasMethod: !!Animated.addWhitelistedUIProps,
        type: typeof Animated.addWhitelistedUIProps,
        animatedKeys: Object.keys(Animated)
      }
    );
  }
}

// Build the Reanimated object with all exports (matching the real mock structure)
const Reanimated = {
  createAnimatedComponent,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useDerivedValue,
  useAnimatedSensor,
  useAnimatedKeyboard,
  useScrollViewOffset,
  useScrollOffset,
  useFrameCallback,
  useEvent,
  useReducedMotion,
  runOnJS,
  runOnUI,
  makeMutable,
  scrollTo,
  cancelAnimation,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  withClamp,
  interpolate,
  interpolateColor,
  Easing,
  Extrapolation,
  ReanimatedLogLevel,
  configureReanimatedLogger,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInUp,
  SlideInLeft,
  SlideInRight,
  SlideOutDown,
  SlideOutUp,
  SlideOutLeft,
  SlideOutRight,
  // Type exports (no-op on web)
  ColorSpace,
  InterfaceOrientation,
  IOSReferenceFrame,
  KeyboardState,
  ReduceMotion,
  SensorType
};

// ES module export - match the real mock.js structure
const exports = {
  __esModule: true as const,
  ...Reanimated,
  default: {
    ...Animated
  },
  Animated
};

// Verify default export has the method (for debugging)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  if (
    !exports.default.addWhitelistedUIProps ||
    typeof exports.default.addWhitelistedUIProps !== 'function'
  ) {
    console.error(
      '[REANIMATED STUB] Default export missing addWhitelistedUIProps!',
      {
        hasMethod: !!exports.default.addWhitelistedUIProps,
        type: typeof exports.default.addWhitelistedUIProps,
        defaultKeys: Object.keys(exports.default)
      }
    );
  } else {
    console.log(
      '[REANIMATED STUB] Loaded successfully - Animated.addWhitelistedUIProps is available'
    );
  }
}

// Export as ES module
export default exports.default;
export {
  Animated,
  cancelAnimation,
  ColorSpace,
  configureReanimatedLogger,
  createAnimatedComponent,
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  InterfaceOrientation,
  interpolate,
  interpolateColor,
  IOSReferenceFrame,
  KeyboardState,
  makeMutable,
  ReanimatedLogLevel,
  ReduceMotion,
  runOnJS,
  runOnUI,
  scrollTo,
  SensorType,
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideInUp,
  SlideOutDown,
  SlideOutLeft,
  SlideOutRight,
  SlideOutUp,
  useAnimatedKeyboard,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useEvent,
  useFrameCallback,
  useReducedMotion,
  useScrollOffset,
  useScrollViewOffset,
  useSharedValue,
  withClamp,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
};

// Also export as CommonJS for Metro compatibility
if (typeof module !== 'undefined' && module.exports) {
  (module as any).exports = exports;
}
