import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import PostHogProvider from '@/contexts/PostHogProvider';
import { system } from '@/db/powersync/system';
import { QueryProvider } from '@/providers/QueryProvider';
import { handleAuthDeepLink } from '@/utils/deepLinkHandler';
import { PowerSyncContext } from '@powersync/react-native';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
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

  return (
    <>
      <SystemBars
        style={{
          statusBar: 'light',
          navigationBar: 'light'
        }}
      />
      <PowerSyncContext.Provider value={system.powersync}>
        <PostHogProvider>
          <AuthProvider>
            <QueryProvider>
              <AudioProvider>
                <SafeAreaProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="app" />
                    </Stack>
                  </GestureHandlerRootView>
                </SafeAreaProvider>
              </AudioProvider>
            </QueryProvider>
          </AuthProvider>
        </PostHogProvider>
      </PowerSyncContext.Provider>
    </>
  );
}
