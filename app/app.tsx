/**
 * Single Route App - Replaces entire file-based routing structure
 * Uses state-driven navigation for instant view transitions
 */

import { useAuth } from '@/contexts/AuthContext';
import { useLocalStore } from '@/store/localStore';
import { colors } from '@/styles/theme';
import AppView from '@/views/AppView';
import LoginView from '@/views/LoginView';
import TermsView from '@/views/TermsView';
import { LinearGradient } from 'expo-linear-gradient';
import { SplashScreen } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

export default function App({ hasRehydrated }: { hasRehydrated: boolean }) {
  const { currentUser, isLoading } = useAuth();
  console.log('hasRehydrated', hasRehydrated);
  console.log('isLoading', isLoading);
  console.log('currentUser', currentUser);
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const isPasswordResetMode = useLocalStore(
    (state) => state.isPasswordResetMode
  );

  console.log('[App] isPasswordResetMode from store:', isPasswordResetMode);
  console.log('[App] dateTermsAccepted:', !!dateTermsAccepted);
  console.log('[App] currentUser:', !!currentUser);

  useEffect(() => {
    // Log whenever password reset mode changes
    console.log('[App] Password reset mode changed to:', isPasswordResetMode);
  }, [isPasswordResetMode]);

  useEffect(() => {
    if (dateTermsAccepted) {
      void SplashScreen.hideAsync();
    }
  }, [dateTermsAccepted]);

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

  // Check if this is a password reset flow (even if authenticated)
  if (isPasswordResetMode) {
    console.log('Password reset mode detected, showing reset form');
    return <LoginView initialMode="reset-password-form" />;
  }

  // Check if user is authenticated
  if (!currentUser) {
    console.log('redirecting to login');
    return <LoginView initialMode="sign-in" />;
  }

  // User is authenticated and terms are accepted, render main app
  return (
    // <PostHogSurveyProvider>
    <AppView />
    // </PostHogSurveyProvider>
  );
}
