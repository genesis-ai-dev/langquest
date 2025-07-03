/**
 * Single Route App - Replaces entire file-based routing structure
 * Uses state-driven navigation for instant view transitions
 */

import { SessionCacheProvider } from '@/contexts/SessionCacheContext';
import AppView from '@/views/AppView';
import React from 'react';

export default function App() {
  return (
    <SessionCacheProvider>
      {/* <PostHogSurveyProvider> */}
      <AppView />
      {/* </PostHogSurveyProvider> */}
    </SessionCacheProvider>
  );
}
