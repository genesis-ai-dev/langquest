import { useAuth } from '@/contexts/AuthContext';
import { AuthNavigator } from '@/navigators/AuthNavigator';
import { useLocalStore } from '@/store/localStore';
import AppView from '@/views/AppView';
import ResetPasswordView2 from '@/views/ResetPasswordView2';
import TermsView from '@/views/TermsView';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

function LoadingView({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={{ marginTop: 10, color: '#666' }}>{message}</Text>
    </View>
  );
}

export default function App() {
  const { isLoading, isAuthenticated, sessionType, isSystemReady } = useAuth();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);

  // Show loading while checking auth state
  if (isLoading) {
    return <LoadingView message="Checking authentication..." />;
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
    return <LoadingView message="Initializing data..." />;
  }

  // Password reset flow - user is authenticated but needs to set new password
  if (sessionType === 'password-reset') {
    return <ResetPasswordView2 />;
  }

  // Normal authenticated user - show main app
  return <AppView />;
}
