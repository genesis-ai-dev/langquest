import '../global.css';

import { UpdateBanner } from '@/components/UpdateBanner';
import { ThemeProvider } from '@/components/theme-provider';
import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SystemProvider } from '@/contexts/SystemContext';
import { system } from '@/db/powersync/system';
import { useColorScheme } from '@/hooks/useColorScheme';
import { QueryProvider } from '@/providers/QueryProvider';
import { initializeNetwork } from '@/store/networkStore';
import { getQueryParams } from '@/utils/supabaseUtils';
import { TranslationUtils } from '@/utils/translationUtils';

import { PortalHost } from '@rn-primitives/portal';
import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

LogBox.ignoreAllLogs(); // Ignore log notifications in the app

export default function RootLayout() {
  const router = useRouter();
  const hasMounted = useRef(false);
  const { colorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = useState(false);

  useEffect(() => {
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    );
    const unsubscribe = initializeNetwork();
    void TranslationUtils.initialize();

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      void handleAuthDeepLink(event.url);
    });

    // Check for initial URL (app opened via link)
    void Linking.getInitialURL().then((url) => {
      if (url) void handleAuthDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAuthDeepLink = (url: string) => {
    console.log('[handleAuthDeepLink] URL:', url);
    const { params, path } = getQueryParams(url);

    if (params.access_token && params.refresh_token) {
      const handleRedirect = async () => {
        await system.supabaseConnector.client.auth.setSession({
          access_token: params.access_token!,
          refresh_token: params.refresh_token!
        });
        router.replace(path as Href);
      };
      void handleRedirect();
    }
  };

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
    <ThemeProvider>
      <SystemBars
        style={{
          statusBar: colorScheme === 'dark' ? 'light' : 'dark',
          navigationBar: colorScheme
        }}
      />
      <SystemProvider>
        <AuthProvider>
          <AudioProvider>
            <QueryProvider>
              <UpdateBanner />
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
              <PortalHost />
            </QueryProvider>
          </AudioProvider>
        </AuthProvider>
      </SystemProvider>
    </ThemeProvider>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? useEffect
    : useLayoutEffect;
