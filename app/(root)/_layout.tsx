import PostHogProvider from '@/contexts/PostHogProvider';
import { initializeLanguage, useLocalStore } from '@/store/localStore';
import { colors } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function TermsLayout() {
  const [hasRehydrated, setHasRehydrated] = useState(
    useLocalStore.persist.hasHydrated()
  );
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);

  useEffect(() => {
    if (hasRehydrated && dateTermsAccepted) {
      void SplashScreen.hideAsync();
    }
  }, [hasRehydrated, dateTermsAccepted]);

  useEffect(() => {
    const rehydrate = async () => {
      await useLocalStore.persist.rehydrate();
      await initializeLanguage();
      setHasRehydrated(true);
    };
    void rehydrate();
  }, []);

  if (!hasRehydrated) {
    console.log('local store not hydrated');
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.text} />
      </LinearGradient>
    );
  }

  if (!dateTermsAccepted) {
    console.log('redirecting to terms');
    return <Redirect href="/terms" />;
  }

  return (
    <PostHogProvider>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: true,
            // Speed up route transitions
            animationTypeForReplace: 'push',
            animation: 'simple_push',
            animationDuration: 200,
            gestureEnabled: true,
            fullScreenGestureEnabled: true
          }}
        />
      </SafeAreaProvider>
    </PostHogProvider>
  );
}
