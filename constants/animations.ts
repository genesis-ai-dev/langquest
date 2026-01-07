import { Easing } from 'react-native-reanimated';

// Standard ease-out - good default for most animations
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

// Easing curve for button press animation - ease out with not so sharp scale down/up on start
export const easeButton = Easing.bezier(0.16, 0.1, 0.3, 1);

// Smooth ease-in-out for symmetrical animations
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

// Snappy ease for quick feedback
export const easeSnappy = Easing.bezier(0.2, 0, 0, 1);

// Spring-like bounce
export const easeSpring = Easing.bezier(0.34, 1.56, 0.64, 1);


