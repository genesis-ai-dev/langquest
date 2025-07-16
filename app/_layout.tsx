import { UpdateBanner } from '@/components/UpdateBanner';
import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SessionCacheProvider } from '@/contexts/SessionCacheContext';
import { system } from '@/db/powersync/system';
import { QueryProvider } from '@/providers/QueryProvider';
import { useLocalStore } from '@/store/localStore';
import { initializeNetwork } from '@/store/networkStore';
import { getQueryParams } from '@/utils/supabaseUtils';
import { TranslationUtils } from '@/utils/translationUtils';
import { PowerSyncContext } from '@powersync/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogBox } from 'react-native';
import App from './app';

// Keep the splash screen visible while we fetch resources
void SplashScreen.preventAutoHideAsync();

LogBox.ignoreAllLogs();

export default function RootLayout() {
  const [isSystemReady, setIsSystemReady] = React.useState(false);
  const [hasRehydrated, setHasRehydrated] = useState(false);

  // Don't render the app until system is ready
  if (!isSystemReady) {
    // Keep splash screen visible while initializing
    return (
      <InitializingApp
        onReady={() => setIsSystemReady(true)}
        setHasRehydrated={setHasRehydrated}
      />
    );
  }

  return <MainApp hasRehydrated={hasRehydrated} />;
}

// Separate component for initialization logic
function InitializingApp({
  onReady,
  setHasRehydrated
}: {
  onReady: () => void;
  setHasRehydrated: (hasRehydrated: boolean) => void;
}) {
  const systemInitialized = useRef(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Start other initializations
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
      const unsubscribe = initializeNetwork();
      void TranslationUtils.initialize();

      // Manually trigger rehydration since skipHydration is true
      console.log('🔄 Triggering local store rehydration...');
      await useLocalStore.persist.rehydrate();
      setHasRehydrated(true);
      console.log('✅ Local store rehydrated!');

      // Initialize system singleton and WAIT for it
      if (!systemInitialized.current) {
        systemInitialized.current = true;
        console.log('🚀 Initializing system singleton directly...');

        try {
          await system.init();
          console.log('✅ System initialization completed!');
          onReady();
          // Hide splash screen now that system is ready
          void SplashScreen.hideAsync();
        } catch (error) {
          console.error('❌ System init error:', error);
          systemInitialized.current = false; // Allow retry on error
          // Still set ready to true to allow app to load (graceful degradation)
          onReady();
          // Hide splash screen even on error to prevent infinite loading
          void SplashScreen.hideAsync();
        }
      } else {
        // Already initialized
        onReady();
        void SplashScreen.hideAsync();
      }

      return unsubscribe;
    };

    let unsubscribe: (() => void) | undefined;

    void initializeApp().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      unsubscribe?.();
    };
  }, [onReady, setHasRehydrated]);

  return null; // Keep splash screen visible
}

// Main app component with all the routing logic
function MainApp({ hasRehydrated }: { hasRehydrated: boolean }) {
  const router = useRouter();

  const handleAuthDeepLink = useCallback(
    async (url: string) => {
      console.log('[handleAuthDeepLink] URL:', url);
      const { params, path } = getQueryParams(url);

      console.log('path', path);
      console.log('params', params);

      if (params.access_token && params.refresh_token) {
        // Check if this is a password reset flow
        const isPasswordReset =
          path === 'reset-password' || url.includes('reset-password');

        console.log('[handleAuthDeepLink] Is password reset:', isPasswordReset);

        try {
          // For password reset, we might not need to call setSession explicitly
          // The auth state change listener might handle it automatically
          // Let's check if we already have a session from the URL
          console.log('[handleAuthDeepLink] Checking current session...');
          const { data: currentSessionData, error: currentSessionError } =
            await system.supabaseConnector.client.auth.getSession();

          console.log('[handleAuthDeepLink] Current session check:', {
            hasSession: !!currentSessionData.session,
            error: currentSessionError?.message
          });

          // If we don't have a session, try to set it
          if (!currentSessionData.session) {
            console.log(
              '[handleAuthDeepLink] No current session, setting session with tokens...'
            );
            const { data, error } =
              await system.supabaseConnector.client.auth.setSession({
                access_token: params.access_token,
                refresh_token: params.refresh_token
              });

            if (error) {
              console.error(
                '[handleAuthDeepLink] Error setting session:',
                error
              );
              return;
            }

            console.log('[handleAuthDeepLink] Session set successfully:', {
              user: data.session?.user.email,
              hasSession: !!data.session
            });
          } else {
            console.log(
              '[handleAuthDeepLink] Session already exists, skipping setSession'
            );
          }

          // If this is a password reset, store a flag
          if (isPasswordReset) {
            await AsyncStorage.setItem(
              'langquest_password_reset_session',
              'true'
            );
            console.log(
              '[handleAuthDeepLink] Marked session as password reset'
            );
          }

          console.log('[handleAuthDeepLink] Navigating to /app');
          router.replace('/app');
        } catch (error) {
          console.error(
            '[handleAuthDeepLink] Error in handleAuthDeepLink:',
            error
          );
        }
      } else {
        console.log(
          '[handleAuthDeepLink] No access_token or refresh_token found'
        );
      }
    },
    [router]
  );

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
  }, [handleAuthDeepLink]);

  console.log('[MainApp] Rendering...');
  console.log('[RootLayout] Rendering...');

  return (
    <>
      <StatusBar style="light" backgroundColor="#000" translucent={false} />
      <PowerSyncContext.Provider value={system.powersync}>
        <AuthProvider>
          <AudioProvider>
            <QueryProvider>
              <SessionCacheProvider>
                <UpdateBanner />
                <App hasRehydrated={hasRehydrated} />
              </SessionCacheProvider>
            </QueryProvider>
          </AudioProvider>
        </AuthProvider>
      </PowerSyncContext.Provider>
    </>
  );
}
