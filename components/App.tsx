import { useAuth } from '@/contexts/AuthContext';
import { initializePostHogWithStore } from '@/services/posthog';
import { useLocalStore } from '@/store/localStore';
import { initializeNetwork } from '@/store/networkStore';
import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoadingView from '@/components/LoadingView';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { AuthNavigator } from '@/navigators/AuthNavigator';
import { colors } from '@/styles/theme';
import AppView from '@/views/AppView';
import ResetPasswordView2 from '@/views/ResetPasswordView2';
import TermsView from '@/views/TermsView';
import clsx from 'clsx';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

// Wrapper component to provide consistent gradient background
function AppWrapper({ children }: { children: React.ReactNode }) {
  const { currentView } = useAppNavigation();
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.gradient}
    >
      <SafeAreaView
        style={{ flex: 1 }}
        className={clsx(currentView === 'projects' && 'bg-background')}
      >
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function App() {
  const { isLoading, isAuthenticated, sessionType, isSystemReady } = useAuth();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);

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

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <AppWrapper>
        <LoadingView />
      </AppWrapper>
    );
  }

  // Check terms acceptance (before auth)
  if (!dateTermsAccepted) {
    return (
      <AppWrapper>
        <TermsView />
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
        <ResetPasswordView2 />
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

const styles = StyleSheet.create({
  gradient: {
    flex: 1
  }
});
