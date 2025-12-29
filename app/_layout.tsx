import '@/global.css';
import { LogBox, Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import PostHogProvider from '@/contexts/PostHogProvider';
import { system } from '@/db/powersync/system';
import { QueryProvider } from '@/providers/QueryProvider';
import { handleAuthDeepLink } from '@/utils/deepLinkHandler';
import { PowerSyncContext } from '@powersync/react';
// Removed NavThemeProvider and PortalHost to align with SystemBars-only approach
import { UpdateBanner } from '@/components/UpdateBanner';
import { useColorScheme } from '@/hooks/useColorScheme';
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

import { cssTokens } from '@/generated-tokens';
import { toNavTheme } from '@/utils/styleUtils';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PressablesConfig } from 'pressto';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel
} from 'react-native-reanimated';

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false // Disables warnings with nativewind animations
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

export default function RootLayout() {
  if (Platform.OS === 'web') {
    // @ts-expect-error - globalThis._frameTimestamp is not defined
    // eslint-disable-next-line react-hooks/immutability, react-compiler/react-compiler
    global._frameTimestamp = null;
  }
  const hasMounted = useRef(false);
  const { colorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = useState(false);

  // Load Noto Sans fonts
  const [fontsLoaded] = useFonts({
    'NotoSans-Regular': NotoSans_400Regular,
    'NotoSans-Medium': NotoSans_500Medium,
    'NotoSans-SemiBold': NotoSans_600SemiBold,
    'NotoSans-Bold': NotoSans_700Bold
  });

  useEffect(() => {
    // async function init() {
    //   await tagService.preloadTagsIntoCache();
    // }
    // void init();

    if (Platform.OS === 'web') return;
    console.log('[_layout] Setting up deep link handler');

    // Handle deep links
    const handleUrl = (url: string) => {
      console.log('[_layout] Received deep link:', url);
      void handleAuthDeepLink(url);
    };

    // Set up deep link listener
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    // Check for initial URL (app opened via deep link)
    void Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[_layout] Initial URL:', url);
        handleUrl(url);
      }
    });

    return () => {
      console.log('[_layout] Cleaning up deep link listener');
      subscription.remove();
    };
  }, []);

  console.log('[RootLayout] Rendering...');

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === 'web') {
      // Adds the background color to the html element to prevent white background on overscroll.
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

  console.log('[RootLayout] scheme:', scheme);

  return (
    <PowerSyncContext.Provider value={system.powersync}>
      <PostHogProvider>
        <AuthProvider>
          <QueryProvider>
            <AudioProvider>
              <SafeAreaProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <StatusBar style={systemBarsStyle} />
                    {/* OTA Update Banner - shown before login and after */}
                    <UpdateBanner />
                    <BottomSheetModalProvider>
                      <ThemeProvider value={NAV_THEME[scheme]}>
                        <PressablesConfig
                          animationConfig={{
                            duration: 100
                            // easing: Easing.out(Easing.ease)
                          }}
                        >
                          <Stack screenOptions={{ headerShown: false }} />
                        </PressablesConfig>
                        <PortalHost />
                      </ThemeProvider>
                    </BottomSheetModalProvider>
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SafeAreaProvider>
            </AudioProvider>
          </QueryProvider>
        </AuthProvider>
      </PostHogProvider>
    </PowerSyncContext.Provider>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? useEffect
    : useLayoutEffect;
