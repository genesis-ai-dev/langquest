import * as Linking from 'expo-linking';
import { Href, Stack, useRouter } from 'expo-router';
import React, { Fragment, useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import PostHogProvider from '@/contexts/PostHogProvider';
import { PowerSyncProvider } from '@/contexts/PowerSyncContext';
import { getQueryParams } from '@/utils/supabaseQueryParams';
import { useSystem } from '../db/powersync/system';
import { Drawer } from '@/components/Drawer';
import { QueryProvider } from '@/providers/QueryProvider';
import { initializeNetwork } from '@/store/networkStore';
import { TranslationUtils } from '@/utils/translationUtils';

LogBox.ignoreAllLogs(); // Ignore log notifications in the app

export default function RootLayout() {
  const system = useSystem();
  const router = useRouter();

  console.log('Posthog key:', process.env.EXPO_PUBLIC_POSTHOG_KEY);
  console.log(process.env.EXPO_PUBLIC_POSTHOG_HOST);

  useEffect(() => {
    system.init();
  }, []);

  useEffect(() => {
    const unsubscribe = initializeNetwork();
    return () => {
      unsubscribe();
    };
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

  useEffect(() => {
    TranslationUtils.initialize();
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
        router.replace(path as Href<string>);
      };
      handleRedirect();
    }
  };

  return (
    <PowerSyncProvider>
      <LanguageProvider>
        <PostHogProvider>
          <QueryProvider>
            <AuthProvider>
              <SafeAreaProvider>
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
              </SafeAreaProvider>
            </AuthProvider>
          </QueryProvider>
        </PostHogProvider>
      </LanguageProvider>
    </PowerSyncProvider>
  );
}
