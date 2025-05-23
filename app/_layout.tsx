import { UpdateBanner } from '@/components/UpdateBanner';
import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SystemProvider } from '@/contexts/SystemContext';
import { system } from '@/db/powersync/system';
import { QueryProvider } from '@/providers/QueryProvider';
import { initializeNetwork } from '@/store/networkStore';
import { getQueryParams } from '@/utils/supabaseUtils';
import { TranslationUtils } from '@/utils/translationUtils';
import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';

LogBox.ignoreAllLogs(); // Ignore log notifications in the app

export default function RootLayout() {
  const router = useRouter();

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

  return (
    <>
      <StatusBar style="light" backgroundColor="#000" translucent={false} />
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
            </QueryProvider>
          </AudioProvider>
        </AuthProvider>
      </SystemProvider>
    </>
  );
}
