/**
 * Main App View - Single route with state-driven navigation
 * Replaces the entire file-based routing structure
 */

import React, { Suspense, useEffect, useState } from 'react';
import {
  BackHandler,
  InteractionManager,
  StyleSheet,
  View
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/hooks/useAppNavigation';

// Lazy-load view components for instant navigation transitions
// This prevents blocking the main thread with bundle loading
const NotificationsView = React.lazy(() => import('@/views/NotificationsView'));
const ProfileView = React.lazy(() => import('@/views/ProfileView'));
const SettingsView = React.lazy(() => import('@/views/SettingsView'));
const CorruptedAttachmentsView = React.lazy(
  () => import('@/views/CorruptedAttachmentsView')
);
const AccountDeletionView = React.lazy(
  () => import('@/views/AccountDeletionView')
);
const DownloadStatusView = React.lazy(
  () => import('@/views/DownloadStatusView')
);
const NextGenAssetDetailView = React.lazy(
  () => import('@/views/new/NextGenAssetDetailView')
);
const NextGenAssetsView = React.lazy(
  () => import('@/views/new/NextGenAssetsView')
);
const BibleAssetsView = React.lazy(() => import('@/views/new/BibleAssetsView'));
const NextGenProjectsView = React.lazy(
  () => import('@/views/new/NextGenProjectsView')
);
const ProjectDirectoryView = React.lazy(
  () => import('@/views/new/ProjectDirectoryView')
);
const SimpleOnboardingFlow = React.lazy(() =>
  import('@/views/new/SimpleOnboardingFlow').then((module) => ({
    default: module.SimpleOnboardingFlow
  }))
);

// Common UI Components
import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import { AuthModal } from '@/components/AuthModal';
import LoadingView from '@/components/LoadingView';
import {
  CloudLoadingProvider,
  useCloudLoading
} from '@/contexts/CloudLoadingContext';
import { StatusProvider } from '@/contexts/StatusContext';
import { useLocalStore } from '@/store/localStore';

// DEV ONLY: Debug controls for testing OTA updates
// To test OTA updates in development, uncomment the next line:
// import { OTAUpdateDebugControls } from '@/components/OTAUpdateDebugControls';

function AppViewContent() {
  const { currentView, canGoBack, goBack, goToProjects, goBackToView } =
    useAppNavigation();
  const { isAuthenticated } = useAuth();
  const authView = useLocalStore((state) => state.authView);
  const setAuthView = useLocalStore((state) => state.setAuthView);
  const setTriggerOnboarding = useLocalStore(
    (state) => state.setTriggerOnboarding
  );
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const triggerOnboarding = useLocalStore((state) => state.triggerOnboarding);
  const onboardingIsOpen = useLocalStore((state) => state.onboardingIsOpen);
  const setOnboardingIsOpen = useLocalStore(
    (state) => state.setOnboardingIsOpen
  );
  const enableVerseMarkers = useLocalStore((state) => state.enableVerseMarkers);
  const [drawerIsVisible, setDrawerIsVisible] = useState(false);
  const [deferredView, setDeferredView] = useState(currentView);
  const { isCloudLoading } = useCloudLoading();

  // Handler for onboarding button in header (only show on projects view)
  const handleOnboardingPress = React.useCallback(() => {
    if (currentView === 'projects') {
      setTriggerOnboarding(true);
    }
  }, [currentView, setTriggerOnboarding]);

  // Show onboarding AFTER terms are accepted (one-time walkthrough)
  // This ensures users see the walkthrough after accepting terms
  const onboardingCompleted = useLocalStore(
    (state) => state.onboardingCompleted
  );
  React.useEffect(() => {
    // Show onboarding if terms are accepted but onboarding hasn't been completed
    // Only set flag if not already open to prevent duplicate modals
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
  React.useEffect(() => {
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

  // Memoize drawer toggle callback to prevent AppHeader re-renders
  const drawerToggleCallback = React.useCallback(
    () => setDrawerIsVisible((prev) => !prev),
    []
  );

  // Close auth modal when user becomes authenticated
  React.useEffect(() => {
    if (isAuthenticated && authView) {
      setAuthView(null);
    }
  }, [isAuthenticated, authView, setAuthView]);

  // Reset drawer state when auth state changes
  // This ensures drawer closes when switching between anonymous and authenticated states
  React.useEffect(() => {
    setDrawerIsVisible(false);
  }, [isAuthenticated, setDrawerIsVisible]);

  // Close drawer when auth modal opens or closes
  // Prevents drawer and auth modal from being visible simultaneously
  React.useEffect(() => {
    // Always close drawer when auth modal state changes (opens or closes)
    setDrawerIsVisible(false);
  }, [authView, setDrawerIsVisible]);

  // Block profile/settings/notifications views for anonymous users
  // Redirect to projects view if anonymous user tries to access these
  useEffect(() => {
    if (!isAuthenticated) {
      const blockedViews: (typeof currentView)[] = [
        'profile',
        'settings',
        'notifications',
        'corrupted-attachments',
        'account-deletion'
      ];
      if (blockedViews.includes(currentView)) {
        // Redirect anonymous users to projects view
        goToProjects();
      }
    }
  }, [currentView, isAuthenticated, goToProjects]);

  // Block bible-assets view if enableVerseMarkers is disabled
  // Redirect to previous view if user tries to access bible-assets without the feature enabled
  useEffect(() => {
    if (currentView === 'bible-assets' && !enableVerseMarkers) {
      // Redirect to previous view (usually quests or assets)
      if (canGoBack) {
        goBack();
      } else {
        // Fallback to projects if no navigation history
        goToProjects();
      }
    }
  }, [currentView, enableVerseMarkers, canGoBack, goBack, goToProjects]);

  // Track if navigation is in progress
  const isNavigating = currentView !== deferredView;

  // Defer view changes until after animations complete
  // This ensures instant navigation transitions
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setDeferredView(currentView);
    });

    return () => task.cancel();
  }, [currentView]);

  // Handle hardware back button and back gestures
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // If drawer is open, close it first
        if (drawerIsVisible) {
          setDrawerIsVisible(false);
          return true; // Prevent default behavior (exit app)
        }
        // Disable back button while navigation is in progress
        if (isNavigating) {
          return true; // Prevent default behavior (exit app)
        }
        // Otherwise, handle navigation
        if (canGoBack) {
          goBack();
          return true; // Prevent default behavior (exit app)
        }
        return false; // Allow default behavior (exit app) if at root
      }
    );

    return () => backHandler.remove();
  }, [canGoBack, goBack, drawerIsVisible, setDrawerIsVisible, isNavigating]);

  // Use deferred view for rendering to prevent blocking navigation transitions
  const renderCurrentView = () => {
    switch (deferredView) {
      case 'projects':
        return <NextGenProjectsView />;
      case 'quests':
        return <ProjectDirectoryView />;
      case 'assets':
        return <NextGenAssetsView />;
      case 'bible-assets':
        return <BibleAssetsView />;
      case 'asset-detail':
        return <NextGenAssetDetailView />;
      case 'profile':
        return <ProfileView />;
      case 'notifications':
        return <NotificationsView />;
      case 'settings':
        return <SettingsView />;
      case 'corrupted-attachments':
        return <CorruptedAttachmentsView />;
      case 'account-deletion':
        return <AccountDeletionView />;
      case 'download-status':
        return <DownloadStatusView />;
      default:
        return <NextGenProjectsView />;
    }
  };

  return (
    <View style={styles.appContainer}>
      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {/* App Header */}
        <AppHeader
          drawerToggleCallback={drawerToggleCallback}
          isCloudLoading={isCloudLoading}
          isNavigating={isNavigating}
          onOnboardingPress={
            currentView === 'projects' ? handleOnboardingPress : undefined
          }
        />

        {/* Debug Controls (DEV only) - uncomment to test OTA updates */}
        {/* <OTAUpdateDebugControls /> */}

        {/* Current View */}
        <Suspense fallback={<LoadingView />}>
          {renderCurrentView()}

          {/* We need to render the drawer in the suspense otherwise the drawer will not size properly, you'll be stuck with the handle on the top but no content */}
          {/* Drawer Navigation - Rendered last to appear on top */}
          <AppDrawer
            drawerIsVisible={drawerIsVisible}
            setDrawerIsVisible={setDrawerIsVisible}
          />

          {/* Auth Modal for anonymous users */}
          {!isAuthenticated && (
            <AuthModal
              visible={!!authView}
              initialView={authView || 'sign-in'}
              onClose={() => setAuthView(null)}
            />
          )}

          {/* Onboarding Flow - shows globally until terms are accepted */}
          <SimpleOnboardingFlow
            visible={onboardingIsOpen}
            onClose={() => setOnboardingIsOpen(false)}
          />
        </Suspense>
      </View>
    </View>
  );
}

export default function AppView() {
  return (
    <StatusProvider>
      <CloudLoadingProvider>
        <AppViewContent />
      </CloudLoadingProvider>
    </StatusProvider>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1
  },
  appContainer: {
    flex: 1
  },
  contentContainer: {
    flex: 1
  }
});
