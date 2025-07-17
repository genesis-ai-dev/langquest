/**
 * Single Route App - Replaces entire file-based routing structure
 * Uses state-driven navigation for instant view transitions
 */

import { useAuth } from '@/contexts/old_AuthContext';
import { useLocalStore } from '@/store/old_localStore';
import { colors } from '@/styles/theme';
import AppView from '@/views/AppView';
import ForgotPasswordView from '@/views/ForgotPasswordView';
import RegisterView from '@/views/RegisterView';
import ResetPasswordView from '@/views/ResetPasswordView';
import SignInView from '@/views/SignInView';
import TermsView from '@/views/TermsView';
import { LinearGradient } from 'expo-linear-gradient';
import { SplashScreen } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

export default function App({ hasRehydrated }: { hasRehydrated: boolean }) {
  const { currentUser, isLoading, sessionType, isAuthenticated } = useAuth();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const authView = useLocalStore((state) => state.authView);
  const setAuthView = useLocalStore((state) => state.setAuthView);

  console.log('[App] State:', {
    hasRehydrated,
    isLoading,
    currentUser: !!currentUser,
    isAuthenticated,
    sessionType,
    authView,
    dateTermsAccepted: !!dateTermsAccepted
  });

  useEffect(() => {
    if (dateTermsAccepted) {
      void SplashScreen.hideAsync();
    }
  }, [dateTermsAccepted]);

  // Reset authView when user signs in/out
  useEffect(() => {
    if (isAuthenticated && authView !== null) {
      setAuthView(null);
    } else if (!isAuthenticated && authView === null) {
      setAuthView('sign-in');
    }
  }, [isAuthenticated, authView, setAuthView]);

  if (!hasRehydrated || isLoading) {
    console.log(
      'auth is loading - hasRehydrated:',
      hasRehydrated,
      'isLoading:',
      isLoading
    );
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.text} />
      </LinearGradient>
    );
  }

  if (!dateTermsAccepted) {
    console.log('redirecting to terms');
    return <TermsView />;
  }

  // Check if user is authenticated
  if (isAuthenticated) {
    // Check if this is a password reset session
    console.log('sessionType:', sessionType);
    if (sessionType === 'password-reset') {
      console.log('Password reset session detected');
      return <ResetPasswordView />;
    }

    // Check if we have a current user profile
    if (!currentUser) {
      console.log('Authenticated but no user profile, showing loading');
      return (
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size="large" color={colors.text} />
        </LinearGradient>
      );
    }

    // Normal authenticated user
    return <AppView />;
  }

  // Not authenticated - show appropriate auth view
  console.log('Not authenticated, showing auth view:', authView);

  switch (authView) {
    case 'register':
      return <RegisterView />;
    case 'forgot-password':
      return <ForgotPasswordView />;
    case 'sign-in':
    default:
      return <SignInView />;
  }
}
