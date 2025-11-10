import { useAuth } from '@/contexts/AuthContext';
import { initializePostHogWithStore } from '@/services/posthog';
import { useLocalStore } from '@/store/localStore';
import { initializeNetwork } from '@/store/networkStore';
import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountDeletedOverlay } from '@/components/AccountDeletedOverlay';
import { AppUpgradeScreen } from '@/components/AppUpgradeScreen';
import LoadingView from '@/components/LoadingView';
import { MigrationScreen } from '@/components/MigrationScreen';
import { useProfileByUserId } from '@/hooks/db/useProfiles';
import { useDrizzleStudio } from '@/hooks/useDrizzleStudio';
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
  const authView = useLocalStore((state) => state.authView);
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
  // BUT: If authView is set (user is interacting with auth modal), keep showing AppView
  // to prevent visual restart when isLoading changes
  if (isLoading && !authView) {
    return (
      <AppWrapper>
        <LoadingView />
      </AppWrapper>
    );
  }

  // Anonymous users can browse without authentication
  // Allow anonymous browsing - only block if authenticated AND upgrade/migration needed
  if (isAuthenticated) {
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
    // BUT: If authView is set (auth modal was visible), keep showing AppView
    // to prevent app from disappearing during system initialization after login
    if (!isSystemReady && !authView) {
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

    // Check if account is deleted (soft delete: active = false)
    // This check happens after system is ready and user is authenticated
    return <AccountStatusCheck />;
  }

  // Anonymous user - allow browsing (system ready is set immediately for anonymous)
  // BUT: Show loading briefly during sign-out transition to prevent components from
  // accessing system.db before PowerSync cleanup completes
  // System ready check is not needed for anonymous users as they use cloud-only queries
  if (!isSystemReady) {
    return (
      <AppWrapper>
        <LoadingView />
      </AppWrapper>
    );
  }

  return (
    <AppWrapper>
      <AppView />
    </AppWrapper>
  );
}

function AccountStatusCheck() {
  const { currentUser } = useAuth();
  const { profile } = useProfileByUserId(currentUser?.id || '');

  // If profile exists and is inactive, show deleted account overlay
  if (profile && profile.active === false) {
    return (
      <AppWrapper>
        <AccountDeletedOverlay />
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
