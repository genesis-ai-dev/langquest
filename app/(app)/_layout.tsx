/**
 * App group layout - shared chrome (header, drawer, overlays) + Stack.Protected route guards.
 * The root layout's Stack.Protected guards ensure this layout only mounts when the app is ready.
 */

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';

import { AccountDeletedOverlay } from '@/components/AccountDeletedOverlay';
import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  CloudLoadingProvider,
  useCloudLoading
} from '@/contexts/CloudLoadingContext';
import { StatusProvider } from '@/contexts/StatusContext';
import { useProfileByUserId } from '@/hooks/db/useProfiles';
import { useLocalStore } from '@/store/localStore';
import { Stack, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const SimpleOnboardingFlow = React.lazy(() =>
  import('@/views/new/SimpleOnboardingFlow').then((module) => ({
    default: module.SimpleOnboardingFlow
  }))
);

/**
 * Inner content that needs CloudLoadingContext.
 * Renders AppHeader, the Stack navigator with protected routes, and overlays.
 */
function AppContent() {
  const { isAuthenticated, currentUser } = useAuth();
  const { profile } = useProfileByUserId(currentUser?.id || '');
  const authView = useLocalStore((s) => s.authView);
  const setAuthView = useLocalStore((s) => s.setAuthView);
  const setTriggerOnboarding = useLocalStore(
    (s) => s.setTriggerOnboarding
  );
  const dateTermsAccepted = useLocalStore((s) => s.dateTermsAccepted);
  const triggerOnboarding = useLocalStore((s) => s.triggerOnboarding);
  const onboardingIsOpen = useLocalStore((s) => s.onboardingIsOpen);
  const setOnboardingIsOpen = useLocalStore((s) => s.setOnboardingIsOpen);
  const onboardingCompleted = useLocalStore((s) => s.onboardingCompleted);
  const [drawerIsVisible, setDrawerIsVisible] = useState(false);
  const { isCloudLoading } = useCloudLoading();
  const pathname = usePathname();
  const isProjectsView = pathname === '/' || pathname === '';

  // Account deleted overlay (soft-delete: active === false)
  const accountDeleted = !!profile && profile.active === false;

  const handleOnboardingPress = useCallback(() => {
    if (isProjectsView) {
      setTriggerOnboarding(true);
    }
  }, [isProjectsView, setTriggerOnboarding]);

  // Show onboarding after terms are accepted (one-time walkthrough)
  useEffect(() => {
    if (dateTermsAccepted && !onboardingCompleted && !onboardingIsOpen) {
      setOnboardingIsOpen(true);
    }
  }, [
    dateTermsAccepted,
    onboardingCompleted,
    onboardingIsOpen,
    setOnboardingIsOpen
  ]);

  // Watch for trigger from AppHeader
  useEffect(() => {
    if (triggerOnboarding && !onboardingIsOpen) {
      setOnboardingIsOpen(true);
      setTriggerOnboarding(false);
    }
  }, [
    triggerOnboarding,
    setTriggerOnboarding,
    onboardingIsOpen,
    setOnboardingIsOpen
  ]);

  const drawerToggleCallback = useCallback(
    () => setDrawerIsVisible((prev) => !prev),
    []
  );

  // Close auth modal when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && authView) {
      setAuthView(null);
    }
  }, [isAuthenticated, authView, setAuthView]);

  // Reset drawer when auth state changes
  useEffect(() => {
    setDrawerIsVisible(false);
  }, [isAuthenticated]);

  // Close drawer when auth modal opens or closes
  useEffect(() => {
    setDrawerIsVisible(false);
  }, [authView]);

  // Hardware back button closes drawer first, then lets expo-router handle back
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (drawerIsVisible) {
          setDrawerIsVisible(false);
          return true;
        }
        return false;
      }
    );
    return () => backHandler.remove();
  }, [drawerIsVisible]);

  // Account deleted: block everything with overlay
  if (accountDeleted) {
    return <AccountDeletedOverlay />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        drawerToggleCallback={drawerToggleCallback}
        isCloudLoading={isCloudLoading}
        onOnboardingPress={isProjectsView ? handleOnboardingPress : undefined}
      />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right'
        }}
      >
        {/* Public routes - accessible to both anonymous and authenticated users */}
        <Stack.Screen name="index" />
        <Stack.Screen name="project/[projectId]" />
        <Stack.Screen name="quest/[questId]" />
        <Stack.Screen name="bible-quest/[questId]" />
        <Stack.Screen name="asset/[assetId]" />
        <Stack.Screen name="recording" />
        <Stack.Screen name="download-status" />

        {/* Auth-only routes - anonymous users are redirected to index */}
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="profile" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="corrupted-attachments" />
          <Stack.Screen name="account-deletion" />
        </Stack.Protected>
      </Stack>

      <Suspense fallback={null}>
        <AppDrawer
          drawerIsVisible={drawerIsVisible}
          setDrawerIsVisible={setDrawerIsVisible}
        />

        {!isAuthenticated && (
          <AuthModal
            visible={!!authView}
            initialView={authView || 'sign-in'}
            onClose={() => setAuthView(null)}
          />
        )}

        <SimpleOnboardingFlow
          visible={onboardingIsOpen}
          onClose={() => setOnboardingIsOpen(false)}
        />
      </Suspense>
    </View>
  );
}

export default function AppLayout() {
  return (
    <SafeAreaView
      style={{ flex: 1 }}
      className="bg-background"
      edges={['top', 'left', 'right']}
    >
      <StatusProvider>
        <CloudLoadingProvider>
          <AppContent />
        </CloudLoadingProvider>
      </StatusProvider>
    </SafeAreaView>
  );
}
