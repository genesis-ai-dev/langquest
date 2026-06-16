import { useAuth } from '@/contexts/AuthContext';
import { useProfileByUserId } from '@/hooks/db/useProfiles';
import {
  hasCompletedAnalyticsConsent,
  profileNeedsAnalyticsConsent
} from '@/services/analyticsConsent';
import { useLocalStore } from '@/store/localStore';
import { AnalyticsConsentView } from '@/views/AnalyticsConsentView';
import React from 'react';
import { View } from 'react-native';

function useRequiresAnalyticsConsent(): boolean {
  const analyticsConsentAt = useLocalStore((s) => s.analyticsConsentAt);
  const { isAuthenticated, currentUser, isLoading: authLoading } = useAuth();
  const { profile, isProfileLoading } = useProfileByUserId(
    currentUser?.id ?? ''
  );

  // Local choice is authoritative after the user taps Continue — don't block
  // while the profile sync is still in flight or PowerSync is disconnected.
  if (hasCompletedAnalyticsConsent(analyticsConsentAt)) {
    return false;
  }

  // Profile already has a choice (e.g. accepted on another device).
  if (
    isAuthenticated &&
    !authLoading &&
    !isProfileLoading &&
    profile &&
    !profileNeedsAnalyticsConsent(profile.analytics_opt_in)
  ) {
    return false;
  }

  if (!isAuthenticated || authLoading || isProfileLoading || !profile) {
    return false;
  }

  return profileNeedsAnalyticsConsent(profile.analytics_opt_in);
}

interface AnalyticsConsentGateProps {
  children: React.ReactNode;
}

/**
 * Blocks signed-in users until they make an explicit analytics choice when
 * profile.analytics_opt_in is null.
 */
export function AnalyticsConsentGate({ children }: AnalyticsConsentGateProps) {
  const requiresAnalyticsConsent = useRequiresAnalyticsConsent();

  if (requiresAnalyticsConsent) {
    return (
      <View className="flex-1 bg-background">
        <AnalyticsConsentView />
      </View>
    );
  }

  return children;
}
