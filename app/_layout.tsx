import '@/global.css';
import { LogBox, Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import PostHogProvider from '@/contexts/PostHogProvider';
import { system } from '@/db/powersync/system';
import { LocalizationProvider } from '@/hooks/useLocalization';
import { QueryProvider } from '@/providers/QueryProvider';
import { handleAuthDeepLink } from '@/utils/deepLinkHandler';
import { PowerSyncContext } from '@powersync/react';
import { PreAuthMigrationCheck } from '@/components/PreAuthMigrationCheck';
import { UpdateBanner } from '@/components/UpdateBanner';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useExpoDb } from '@/hooks/useExpoDb';
import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold
} from '@expo-google-fonts/noto-sans';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useDrizzleStudio } from '@/hooks/useDrizzleStudio';
import { cssTokens } from '@/generated-tokens';
import { toNavTheme } from '@/utils/styleUtils';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { initializePostHogWithStore } from '@/services/posthog';
import { useLocalStore } from '@/store/localStore';
import { initializeNetwork } from '@/store/networkStore';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel
} from 'react-native-reanimated';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false
});

LogBox.ignoreAllLogs(true);

export const NAV_THEME = {
  light: {
    ...DefaultTheme,
    colors: toNavTheme(cssTokens.light as Record<string, string>)
  },
  dark: {
    ...DarkTheme,
    colors: toNavTheme(cssTokens.dark as Record<string, string>)
  }
};

/**
 * Root navigator with Stack.Protected guards.
 * Must be rendered inside providers so hooks (useAuth, useLocalStore) work.
 */
function RootNavigator() {
  const {
    isLoading,
    isAuthenticated,
    sessionType,
    isSystemReady,
    migrationNeeded,
    appUpgradeNeeded
  } = useAuth();
  const dateTermsAccepted = useLocalStore((s) => s.dateTermsAccepted);
  const authView = useLocalStore((s) => s.authView);

  useDrizzleStudio();

  useEffect(() => {
    const cleanup = initializeNetwork();
    const cleanupPostHog = initializePostHogWithStore();
    return () => {
      cleanup();
      cleanupPostHog?.();
    };
  }, []);

  const termsAccepted = !!dateTermsAccepted;

  // Auth-modal visible keeps the app mounted (prevents visual restart during login)
  const authModalVisible = !!authView;

  // Blocking states (only for authenticated users)
  const needsMigration =
    termsAccepted && isAuthenticated && !!migrationNeeded;
  const needsUpgrade =
    termsAccepted && isAuthenticated && !!appUpgradeNeeded;
  const needsPasswordReset =
    termsAccepted && isAuthenticated && sessionType === 'password-reset';

  // System ready: anonymous users are always ready, authenticated users wait
  const systemReady = isAuthenticated ? isSystemReady : true;

  // App is accessible when there are no blocking states
  const appReady =
    termsAccepted &&
    !needsMigration &&
    !needsUpgrade &&
    !needsPasswordReset &&
    (!isLoading || authModalVisible) &&
    (systemReady || authModalVisible);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="terms"
        options={{ presentation: 'modal' }}
      />

      <Stack.Protected guard={appReady}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={needsPasswordReset}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>

      <Stack.Protected guard={needsMigration}>
        <Stack.Screen name="migration" />
      </Stack.Protected>

      <Stack.Protected guard={needsUpgrade}>
        <Stack.Screen name="upgrade" />
      </Stack.Protected>

      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  if (Platform.OS === 'web') {
    // @ts-expect-error - globalThis._frameTimestamp is not defined
    // eslint-disable-next-line react-hooks/immutability, react-compiler/react-compiler
    global._frameTimestamp = null;
  }
  const hasMounted = useRef(false);
  const { colorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = useState(false);

  useExpoDb();

  const [fontsLoaded] = useFonts({
    'NotoSans-Regular': NotoSans_400Regular,
    'NotoSans-Medium': NotoSans_500Medium,
    'NotoSans-SemiBold': NotoSans_600SemiBold,
    'NotoSans-Bold': NotoSans_700Bold
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleUrl = (url: string) => {
      void handleAuthDeepLink(url);
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === 'web') {
      document.documentElement.classList.add('bg-background');
    }
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  if (!isColorSchemeLoaded || !fontsLoaded) {
    return null;
  }

  const scheme: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light';
  const systemBarsStyle = scheme === 'dark' ? 'light' : 'dark';

  return (
    <PowerSyncContext.Provider value={system.powersync}>
      <PostHogProvider>
        <PreAuthMigrationCheck>
          <AuthProvider>
            <QueryProvider>
              <LocalizationProvider>
                <AudioProvider>
                  <SafeAreaProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <StatusBar style={systemBarsStyle} />
                        <UpdateBanner />
                        <BottomSheetModalProvider>
                          <ThemeProvider value={NAV_THEME[scheme]}>
                            <RootNavigator />
                            <PortalHost />
                          </ThemeProvider>
                        </BottomSheetModalProvider>
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </SafeAreaProvider>
                </AudioProvider>
              </LocalizationProvider>
            </QueryProvider>
          </AuthProvider>
        </PreAuthMigrationCheck>
      </PostHogProvider>
    </PowerSyncContext.Provider>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? useEffect
    : useLayoutEffect;
