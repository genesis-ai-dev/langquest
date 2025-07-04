import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Speed up route transitions
        animationTypeForReplace: 'push',
        animation: 'simple_push', // Faster animation without shadows
        animationDuration: 200, // Reduce animation duration (iOS only)
        gestureEnabled: true, // Enable gestures for better responsiveness
        fullScreenGestureEnabled: true // Enable full screen gestures (iOS)
      }}
    />
  );
}
