import { useAuth } from '@/contexts/AuthContext';
import { useLocalStore } from '@/store/localStore';
import { initializeNetwork } from '@/store/networkStore';
import React, { useEffect } from 'react';

import LoadingView from '@/components/LoadingView';
import { AuthNavigator } from '@/navigators/AuthNavigator';
import AppView from '@/views/AppView';
import ResetPasswordView2 from '@/views/ResetPasswordView2';
import TermsView from '@/views/TermsView';

export default function App() {
  const { isLoading, isAuthenticated, sessionType, isSystemReady } = useAuth();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);

  // Initialize network listener on app startup
  useEffect(() => {
    console.log('[App] Initializing network listener...');
    const cleanup = initializeNetwork();

    return () => {
      console.log('[App] Cleaning up network listener');
      cleanup();
    };
  }, []);

  // Show loading while checking auth state
  if (isLoading) {
    return <LoadingView />;
  }

  // Check terms acceptance (before auth)
  if (!dateTermsAccepted) {
    return <TermsView />;
  }

  // Not authenticated - show auth screens
  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  // Authenticated but system still initializing
  if (!isSystemReady) {
    return <LoadingView />;
  }

  // Password reset flow - user is authenticated but needs to set new password
  if (sessionType === 'password-reset') {
    return <ResetPasswordView2 />;
  }

  // Normal authenticated user - show main app
  return <AppView />;
}
