/**
 * Single Route App - Replaces entire file-based routing structure
 * Uses state-driven navigation for instant view transitions
 */

import { useAuth } from '@/contexts/AuthContext';
import { SessionCacheProvider } from '@/contexts/SessionCacheContext';
import { useLocalStore } from '@/store/localStore';
import AppView from '@/views/AppView';
import LoginView from '@/views/LoginView';
import TermsView from '@/views/TermsView';
import React from 'react';

export default function App() {
  const { currentUser, isLoading } = useAuth();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);

  // Show loading state while auth is initializing
  if (isLoading) {
    // Could add a loading component here if needed
    return null;
  }

  // Check if terms have been accepted
  if (!dateTermsAccepted) {
    return <TermsView />;
  }

  // Check if user is authenticated
  if (!currentUser) {
    return <LoginView />;
  }

  // User is authenticated and terms are accepted, render main app
  return (
    <SessionCacheProvider>
      {/* <PostHogSurveyProvider> */}
      <AppView />
      {/* </PostHogSurveyProvider> */}
    </SessionCacheProvider>
  );
}
