import '@/global.css';
import { LogBox, Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { PreAuthMigrationCheck } from '@/components/PreAuthMigrationCheck';
import { UpdateBanner } from '@/components/UpdateBanner';
import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import PostHogProvider from '@/contexts/PostHogProvider';
import { system } from '@/db/powersync/system';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useExpoDb } from '@/hooks/useExpoDb';
import { LocalizationProvider } from '@/hooks/useLocalization';
import { QueryProvider } from '@/providers/QueryProvider';
import { handleAuthDeepLink } from '@/utils/deepLinkHandler';
import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold
} from '@expo-google-fonts/noto-sans';
import { PowerSyncContext } from '@powersync/react';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { cssTokens } from '@/generated-tokens';
import { useDrizzleStudio } from '@/hooks/useDrizzleStudio';
import { initializePostHogWithStore } from '@/services/posthog';
import { useHasHydrated, useLocalStore } from '@/store/localStore';
import { initializeNetwork } from '@/store/networkStore';
import { toNavTheme } from '@/utils/styleUtils';
import { TermsGateView } from '@/views/TermsGateView';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

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

SplashScreen.preventAutoHideAsync();

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

export const DEFAULT_STACK_OPTIONS = {
  headerShown: false
  // animation: 'slide_from_right',
} as const;

export const FORM_SHEET_OPTIONS = {
  presentation: 'formSheet',
  sheetCornerRadius: Platform.OS === 'android' ? 24 : undefined
} as const;

/**
 * Root navigator with Stack.Protected guards.
 * Must be rendered inside providers so hooks (useAuth, useLocalStore) work.
 *
 * (auth) is NOT guarded by Stack.Protected. Changing a parent Stack.Protected
 * guard while a sibling group has a mounted nested <Stack> corrupts that
 * nested navigator's state → "Cannot read property 'stale' of undefined".
 * Instead, (auth)/_layout.tsx handles auth routing with <Redirect href="/">.
 */
function RootNavigator() {
  const { isLoading, isAuthenticated, migrationNeeded, appUpgradeNeeded } =
    useAuth();

  const needsMigration = isAuthenticated && !!migrationNeeded;
  const needsUpgrade = isAuthenticated && !!appUpgradeNeeded;

  const appReady = !needsMigration && !needsUpgrade && !isLoading;

  const isReady = appReady || needsMigration || needsUpgrade;

  useDrizzleStudio();

  useEffect(() => {
    const cleanup = initializeNetwork();
    const cleanupPostHog = initializePostHogWithStore();
    return () => {
      cleanup();
      cleanupPostHog?.();
    };
  }, []);

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <Stack screenOptions={DEFAULT_STACK_OPTIONS}>
      <Stack.Screen
        name="(auth)"
        options={{
          ...DEFAULT_STACK_OPTIONS,
          ...FORM_SHEET_OPTIONS
        }}
      />
      <Stack.Protected guard={appReady}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={needsMigration}>
        <Stack.Screen name="migration" />
      </Stack.Protected>
      <Stack.Protected guard={needsUpgrade}>
        <Stack.Screen name="upgrade" />
      </Stack.Protected>
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

  const hasHydrated = useHasHydrated();
  const termsAccepted = useLocalStore((s) => !!s.dateTermsAccepted);

  if (!isColorSchemeLoaded || !fontsLoaded || !hasHydrated) {
    return null;
  }

  const scheme: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light';
  const systemBarsStyle = scheme === 'dark' ? 'light' : 'dark';

  if (!termsAccepted) {
    return (
      <ThemeProvider value={NAV_THEME[scheme]}>
        <TermsGateView systemBarsStyle={systemBarsStyle} />
      </ThemeProvider>
    );
  }

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
