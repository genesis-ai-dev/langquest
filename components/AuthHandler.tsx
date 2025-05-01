import { SplashScreen } from 'expo-router';
import React, { useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';

export function AuthHandler({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      console.log('[AuthHandler] Hiding SplashScreen...');
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Optionally, render nothing or a minimal loader while Auth is loading,
  // though the splash screen is already covering this.
  // if (isLoading) {
  //   return null; // Or <ActivityIndicator />;
  // }

  return <>{children}</>;
} 