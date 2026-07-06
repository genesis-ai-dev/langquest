import { useAuth } from '@/contexts/AuthContext';
import { Text } from '@/components/ui/text';
import { useProfileByUserId } from '@/hooks/db/useProfiles';
import { useLocalization } from '@/hooks/useLocalization';
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
 * profile.analytics_opt_in is null. Disclosure names screen replays and account linking.
 */
export function AnalyticsConsentGate({ children }: AnalyticsConsentGateProps) {
  const { t } = useLocalization();
  const requiresAnalyticsConsent = useRequiresAnalyticsConsent();

  if (requiresAnalyticsConsent) {
    return (
      <View className="flex-1 bg-background">
        <View className="border-b border-border px-6 pb-5 pt-6">
          <Text className="text-base font-medium leading-6 text-foreground">
            {t('analyticsConsentLead')}
          </Text>
        </View>
        <AnalyticsConsentView />
      </View>
    );
  }

  return children;
}
