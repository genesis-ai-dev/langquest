import * as Linking from 'expo-linking';
import { Href, SplashScreen, Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';

import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PowerSyncProvider } from '@/contexts/PowerSyncContext';
import { getQueryParams } from '@/utils/supabaseQueryParams';
import { useSystem } from '../db/powersync/system';

LogBox.ignoreAllLogs(); // Ignore log notifications in the app
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const system = useSystem();
  const router = useRouter();

  useEffect(() => {
    system.init();
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleAuthDeepLink(event.url);
    });

    // Check for initial URL (app opened via link)
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAuthDeepLink = async (url: string) => {
    console.log('[handleAuthDeepLink] URL:', url);
    const { params, path } = getQueryParams(url);

    if (params.access_token && params.refresh_token) {
      const handleRedirect = async () => {
        await system.supabaseConnector.client.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token
        });
        router.replace(path as Href);
      };
      handleRedirect();
    }
  };

  return (
    <PowerSyncProvider>
      <LanguageProvider>
        <AuthProvider>
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
        </AuthProvider>
      </LanguageProvider>
    </PowerSyncProvider>
  );
}
