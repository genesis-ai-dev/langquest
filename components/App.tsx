import { useAuth } from '@/contexts/AuthContext';
import { initializePostHogWithStore } from '@/services/posthog';
import { useLocalStore } from '@/store/localStore';
import { initializeNetwork } from '@/store/networkStore';
import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppUpgradeScreen } from '@/components/AppUpgradeScreen';
import LoadingView from '@/components/LoadingView';
import { MigrationScreen } from '@/components/MigrationScreen';
import { useDrizzleStudio } from '@/hooks/useDrizzleStudio';
import { AuthNavigator } from '@/navigators/AuthNavigator';
import AppView from '@/views/AppView';
import ResetPasswordView from '@/views/ResetPasswordView';
import { useRouter } from 'expo-router';

// Wrapper component to provide consistent gradient background
function AppWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView
      style={{ flex: 1 }}
      className="bg-background"
      edges={['top', 'left', 'right']}
    >
      {children}
    </SafeAreaView>
  );
}

export default function App() {
  const {
    isLoading,
    isAuthenticated,
    sessionType,
    isSystemReady,
    migrationNeeded,
    appUpgradeNeeded,
    upgradeError
  } = useAuth();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const router = useRouter();

  useDrizzleStudio();

  // Initialize network listener on app startup
  useEffect(() => {
    if (!isSystemReady) return;
    console.log('[App] Initializing network listener...');
    const cleanup = initializeNetwork();
    const cleanupPostHog = initializePostHogWithStore();

    return () => {
      console.log('[App] Cleaning up network listener');
      cleanup();
      cleanupPostHog?.();
    };
  }, [isSystemReady]);

  useEffect(() => {
    if (!isLoading && !dateTermsAccepted) {
      router.navigate('/terms');
    }
  }, [isLoading, dateTermsAccepted, router]);

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <AppWrapper>
        <LoadingView />
      </AppWrapper>
    );
  }

  // Not authenticated - show auth screens
  if (!isAuthenticated) {
    return (
      <AppWrapper>
        <AuthNavigator />
      </AppWrapper>
    );
  }

  // CRITICAL: App upgrade required - block everything until user upgrades
  // This takes precedence over migration since the app version is incompatible
  if (appUpgradeNeeded && upgradeError) {
    return (
      <AppWrapper>
        <AppUpgradeScreen
          localVersion={upgradeError.localVersion}
          serverVersion={upgradeError.serverVersion}
          reason={upgradeError.reason as 'server_ahead' | 'server_behind'}
        />
      </AppWrapper>
    );
  }

  // CRITICAL: Migration required - block everything until migration completes
  if (migrationNeeded) {
    return (
      <AppWrapper>
        <MigrationScreen />
      </AppWrapper>
    );
  }

  // Authenticated but system still initializing
  if (!isSystemReady) {
    return (
      <AppWrapper>
        <LoadingView />
      </AppWrapper>
    );
  }

  // Password reset flow - user is authenticated but needs to set new password
  if (sessionType === 'password-reset') {
    return (
      <AppWrapper>
        <ResetPasswordView />
      </AppWrapper>
    );
  }

  // Normal authenticated user - show main app (AppView has its own wrapper)
  return (
    <AppWrapper>
      <AppView />
    </AppWrapper>
  );
}
