import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { LogBox, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/contexts/AuthContext';
import { useSystem } from '../db/powersync/system';
import { PowerSyncProvider } from '@/contexts/PowerSyncContext';

LogBox.ignoreAllLogs(); // Ignore log notifications in the app

// Separate component that will be wrapped by AuthProvider
function DeepLinkHandler() {
  const router = useRouter();
  const system = useSystem();

  // Define the type for our hash parameters
  type AuthParams = {
    access_token?: string;
    refresh_token?: string;
    type?: string;
    expires_at?: string;
    expires_in?: string;
    token_type?: string;
  };

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Check for initial URL (app opened via link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = async (url: string) => {
    console.log('[Deep Link] Received URL:', url);
    if (url) {
      // Split URL into base and hash parts
      const [basePath, hashPart] = url.split('#');

      // Parse the base URL
      const { path, queryParams } = Linking.parse(basePath);

      // Parse the hash fragment if it exists
      let hashParams: AuthParams = {};
      if (hashPart) {
        const hashSearchParams = new URLSearchParams(hashPart);
        hashParams = Object.fromEntries(
          hashSearchParams.entries()
        ) as AuthParams;
      }

      // Combine query params and hash params
      const allParams: AuthParams = { ...queryParams, ...hashParams };

      console.log('[Deep Link] Parsed:', {
        path,
        params: allParams
      });

      // Get the actual path without any params
      const actualPath = (
        path || basePath.split('://')[1]?.split('?')[0]
      )?.split('#')[0];
      console.log('[Deep Link] Actual path:', actualPath);

      // Simply route to the appropriate screen based on the path
      switch (actualPath) {
        case 'reset-password':
          console.log('[Deep Link] Routing to reset-password screen');
          // Set the session with the tokens before navigating
          if (allParams.access_token && allParams.refresh_token) {
            try {
              await system.supabaseConnector.client.auth.setSession({
                access_token: allParams.access_token,
                refresh_token: allParams.refresh_token
              });
            } catch (error) {
              console.error('[Deep Link] Error setting session:', error);
            }
          }
          router.replace('/reset-password');
          break;

        case 'registration-confirmation':
          console.log('[Deep Link] Handling registration confirmation');
          // Set the session with the tokens
          if (allParams.access_token && allParams.refresh_token) {
            try {
              await system.supabaseConnector.client.auth.setSession({
                access_token: allParams.access_token,
                refresh_token: allParams.refresh_token
              });
              // Show success message and navigate to login
              Alert.alert(
                'Registration Successful',
                'Your account has been verified. You can now log in.',
                [{ text: 'OK', onPress: () => router.replace('/') }]
              );
            } catch (error) {
              console.error('[Deep Link] Error setting session:', error);
              Alert.alert(
                'Registration Error',
                'There was an error verifying your account. Please try again.',
                [{ text: 'OK', onPress: () => router.replace('/') }]
              );
            }
          }
          break;

        case 'projects':
          router.push('/');
          break;

        case 'settings':
          router.push('/settings');
          break;

        default:
          console.log('[Deep Link] Unhandled path:', actualPath);
          router.replace('/');
      }
    }
  };

  return null;
}

export default function RootLayout() {
  const system = useSystem();

  useEffect(() => {
    system.init();
  }, []);

  return (
    <PowerSyncProvider>
      <AuthProvider>
        <DeepLinkHandler />
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
    </PowerSyncProvider>
  );
}
