/**
 * Single Route App - Replaces entire file-based routing structure
 * Uses state-driven navigation for instant view transitions
 */

import { useAuth } from '@/contexts/AuthProvider';
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

  useEffect(() => {
    if (dateTermsAccepted) {
      void SplashScreen.hideAsync();
    }
  }, [dateTermsAccepted]);

  if (!hasRehydrated || isLoading) {
    console.log('auth is loading');
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
  if (!currentUser) {
    console.log('redirecting to login');
    return <LoginView />;
  }

  // User is authenticated and terms are accepted, render main app
  return (
    // <PostHogSurveyProvider>
    <AppView />
    // </PostHogSurveyProvider>
  );
}
