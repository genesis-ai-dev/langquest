import '@/global.css';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import PostHogProvider from '@/contexts/PostHogProvider';
import { system } from '@/db/powersync/system';
import { QueryProvider } from '@/providers/QueryProvider';
import { handleAuthDeepLink } from '@/utils/deepLinkHandler';
import { PowerSyncContext } from '@powersync/react-native';
// Removed NavThemeProvider and PortalHost to align with SystemBars-only approach
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { cssTokens } from '@/generated-tokens';
import { toNavTheme } from '@/utils/styleUtils';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import {
  configureReanimatedLogger,
  ReanimatedLogLevel
} from 'react-native-reanimated';

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false // Disables warnings with nativewind animations
});

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
    const g = globalThis as unknown as Record<string, unknown>;
    if (typeof g._frameTimestamp === 'undefined') {
      // Workaround for Reanimated on web (see Moti docs)
      g._frameTimestamp = null as unknown as number;
    }
  }
  const hasMounted = useRef(false);
  const { colorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = useState(false);

  useEffect(() => {
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

  if (!isColorSchemeLoaded) {
    return null;
  }

  const scheme: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light';
  const systemBarsStyle = scheme === 'dark' ? 'light' : 'dark';

  console.log('[RootLayout] scheme:', scheme);

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={systemBarsStyle} />
      <PowerSyncContext.Provider value={system.powersync}>
        <PostHogProvider>
          <AuthProvider>
            <QueryProvider>
              <AudioProvider>
                <SafeAreaProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <Stack screenOptions={{ headerShown: false }} />
                    <PortalHost />
                  </GestureHandlerRootView>
                </SafeAreaProvider>
              </AudioProvider>
            </QueryProvider>
          </AuthProvider>
        </PostHogProvider>
      </PowerSyncContext.Provider>
    </ThemeProvider>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? useEffect
    : useLayoutEffect;
