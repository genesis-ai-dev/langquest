import '../global.css';

import { UpdateBanner } from '@/components/UpdateBanner';
import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import PostHogProvider from '@/contexts/PostHogProvider';
import { system } from '@/db/powersync/system';
import { useColorScheme } from '@/hooks/useColorScheme';
import { NAV_THEME } from '@/lib/constants';
import { QueryProvider } from '@/providers/QueryProvider';
import { handleAuthDeepLink } from '@/utils/deepLinkHandler';
import { PowerSyncContext } from '@powersync/react-native';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider
} from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LogBox, Platform } from 'react-native';

LogBox.ignoreAllLogs(); // Ignore log notifications in the app

const THEMES = {
  dark: {
    ...DarkTheme,
    colors: NAV_THEME.dark
  },
  light: {
    ...DefaultTheme,
    colors: NAV_THEME.light
  }
} as const;

export default function RootLayout() {
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

  return (
    <ThemeProvider value={THEMES[colorScheme]}>
      <PowerSyncContext.Provider value={system.powersync}>
        <PostHogProvider>
          <AuthProvider>
            <AudioProvider>
              <QueryProvider>
                <UpdateBanner />
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                <Stack
                  screenOptions={{
                    headerShown: false
                  }}
                >
                  <Stack.Screen
                    name="terms"
                    options={{
                      presentation: 'modal'
                    }}
                  />
                </Stack>
              </QueryProvider>
            </AudioProvider>
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
