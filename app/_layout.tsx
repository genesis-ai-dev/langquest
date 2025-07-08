import { UpdateBanner } from '@/components/UpdateBanner';
import { AudioProvider } from '@/contexts/AudioContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { QueryProvider } from '@/providers/QueryProvider';
import { initializeNetwork } from '@/store/networkStore';
import { getQueryParams } from '@/utils/supabaseUtils';
import { TranslationUtils } from '@/utils/translationUtils';
import { PowerSyncContext } from '@powersync/react';
import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
import App from './app';

// Keep the splash screen visible while we fetch resources
void SplashScreen.preventAutoHideAsync();

LogBox.ignoreAllLogs();

const RootStack = memo(() => (
  <Stack
    screenOptions={{
      headerShown: true,
      // Speed up route transitions
      animationTypeForReplace: 'push',
      animation: 'simple_push',
      animationDuration: 200,
      gestureEnabled: true,
      fullScreenGestureEnabled: true
    }}
  >
    <Stack.Screen
      name="terms"
      options={{
        presentation: 'modal'
      }}
    />
  </Stack>
));

RootStack.displayName = 'RootStack';

export default function RootLayout() {
  const [isSystemReady, setIsSystemReady] = React.useState(false);

  // Don't render the app until system is ready
  if (!isSystemReady) {
    // Keep splash screen visible while initializing
    return <InitializingApp onReady={() => setIsSystemReady(true)} />;
  }

  return <MainApp />;
}

// Separate component for initialization logic
function InitializingApp({ onReady }: { onReady: () => void }) {
  const systemInitialized = useRef(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Start other initializations
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
      const unsubscribe = initializeNetwork();
      void TranslationUtils.initialize();

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
  }, [onReady]);

  return null; // Keep splash screen visible
}

// Main app component with all the routing logic
function MainApp() {
  const router = useRouter();

  const handleAuthDeepLink = useCallback(
    (url: string) => {
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
    },
    [router]
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleAuthDeepLink(event.url);
    });

    // Check for initial URL (app opened via link)
    void Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleAuthDeepLink]);

  console.log('[MainApp] Rendering...');

  return (
    <>
      <StatusBar style="light" backgroundColor="#000" translucent={false} />
      <PowerSyncContext.Provider value={system.powersync}>
        <AuthProvider>
          <AudioProvider>
            <QueryProvider>
              <UpdateBanner />
              <App />
            </QueryProvider>
          </AudioProvider>
        </AuthProvider>
      </PowerSyncContext.Provider>
    </>
  );
}
