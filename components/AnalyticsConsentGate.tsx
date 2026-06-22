import { useAuth } from '@/contexts/AuthContext';
import { useProfileByUserId } from '@/hooks/db/useProfiles';
import { shouldShowAnalyticsConsentGate } from '@/services/analyticsConsent';
import { usePostHogAvailable } from '@/services/postHogAvailability';
import { useLocalStore } from '@/store/localStore';
import { AnalyticsConsentView } from '@/views/AnalyticsConsentView';
import React from 'react';
import { View } from 'react-native';

function useRequiresAnalyticsConsent(): boolean {
  const postHogAvailable = usePostHogAvailable();
  const analyticsConsentAt = useLocalStore((s) => s.analyticsConsentAt);
  const { isAuthenticated, currentUser, isLoading: authLoading } = useAuth();
  const { profile, isProfileLoading } = useProfileByUserId(
    currentUser?.id ?? ''
  );

  return shouldShowAnalyticsConsentGate({
    postHogAvailable,
    analyticsConsentAt,
    profileAnalyticsOptIn: profile?.analytics_opt_in,
    isAuthenticated,
    profileLoaded: !authLoading && !isProfileLoading && profile != null
  });
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
