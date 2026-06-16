import {
  CURRENT_LEGAL_VERSION,
  hasAcceptedCurrentPrivacyPolicyVersion,
  isLegalUpdateRequired,
  resolveAcceptedPrivacyPolicyVersion
} from '@/constants/legalVersions';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileByUserId } from '@/hooks/db/useProfiles';
import { useLocalStore } from '@/store/localStore';
import { LegalUpdateView } from '@/views/LegalUpdateView';
import React from 'react';
import { View } from 'react-native';

function useRequiresLegalUpdate(): boolean {
  const dateTermsAccepted = useLocalStore((s) => s.dateTermsAccepted);
  const acceptedPrivacyPolicyVersion = useLocalStore(
    (s) => s.acceptedPrivacyPolicyVersion
  );
  const { isAuthenticated, currentUser, isLoading: authLoading } = useAuth();
  const { profile, isProfileLoading } = useProfileByUserId(
    currentUser?.id ?? ''
  );

  // Local acceptance is authoritative after the user taps Agree — don't block
  // while the profile sync is still in flight.
  if (
    hasAcceptedCurrentPrivacyPolicyVersion(
      dateTermsAccepted,
      acceptedPrivacyPolicyVersion
    )
  ) {
    return false;
  }

  // Profile already current (e.g. accepted on another device).
  if (
    isAuthenticated &&
    !authLoading &&
    !isProfileLoading &&
    profile &&
    resolveAcceptedPrivacyPolicyVersion(profile.privacy_policy_version) ===
      CURRENT_LEGAL_VERSION
  ) {
    return false;
  }

  if (
    dateTermsAccepted &&
    isLegalUpdateRequired(dateTermsAccepted, acceptedPrivacyPolicyVersion)
  ) {
    return true;
  }

  if (
    isAuthenticated &&
    !authLoading &&
    !isProfileLoading &&
    profile &&
    resolveAcceptedPrivacyPolicyVersion(profile.privacy_policy_version) !==
      CURRENT_LEGAL_VERSION
  ) {
    return true;
  }

  return false;
}

interface LegalUpdateGateProps {
  children: React.ReactNode;
}

/**
 * Blocks the app until the user accepts the current privacy policy version.
 * Covers local store state and, when signed in, the profile privacy_policy_version.
 */
export function LegalUpdateGate({ children }: LegalUpdateGateProps) {
  const requiresLegalUpdate = useRequiresLegalUpdate();

  if (requiresLegalUpdate) {
    return (
      <View className="flex-1 bg-background">
        <LegalUpdateView />
      </View>
    );
  }

  return children;
}
