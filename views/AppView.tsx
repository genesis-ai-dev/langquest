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

import { useAppNavigation } from '@/hooks/useAppNavigation';

// Lazy-load view components for instant navigation transitions
// This prevents blocking the main thread with bundle loading
const NotificationsView = React.lazy(() => import('@/views/NotificationsView'));
const ProfileView = React.lazy(() => import('@/views/ProfileView'));
const SettingsView = React.lazy(() => import('@/views/SettingsView'));
const CorruptedAttachmentsView = React.lazy(
  () => import('@/views/CorruptedAttachmentsView')
);
const NextGenAssetDetailView = React.lazy(
  () => import('@/views/new/NextGenAssetDetailView')
);
const NextGenAssetsView = React.lazy(
  () => import('@/views/new/NextGenAssetsView')
);
const NextGenProjectsView = React.lazy(
  () => import('@/views/new/NextGenProjectsView')
);
const ProjectDirectoryView = React.lazy(
  () => import('@/views/new/ProjectDirectoryView')
);

// Common UI Components
import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import LoadingView from '@/components/LoadingView';
import { UpdateBanner } from '@/components/UpdateBanner';
import {
  CloudLoadingProvider,
  useCloudLoading
} from '@/contexts/CloudLoadingContext';
import { StatusProvider } from '@/contexts/StatusContext';

// DEV ONLY: Debug controls for testing OTA updates
// To test OTA updates in development, uncomment the next line:
// import { OTAUpdateDebugControls } from '@/components/OTAUpdateDebugControls';

function AppViewContent() {
  const { currentView, canGoBack, goBack } = useAppNavigation();
  const [drawerIsVisible, setDrawerIsVisible] = useState(false);
  const [deferredView, setDeferredView] = useState(currentView);
  const { isCloudLoading } = useCloudLoading();

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
        if (canGoBack) {
          goBack();
          return true; // Prevent default behavior (exit app)
        }
        return false; // Allow default behavior (exit app) if at root
      }
    );

    return () => backHandler.remove();
  }, [canGoBack, goBack]);

  // Use deferred view for rendering to prevent blocking navigation transitions
  const renderCurrentView = () => {
    switch (deferredView) {
      case 'projects':
        return <NextGenProjectsView />;
      case 'quests':
        return <ProjectDirectoryView />;
      case 'assets':
        return <NextGenAssetsView />;
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
          drawerToggleCallback={() => setDrawerIsVisible(!drawerIsVisible)}
          isCloudLoading={isCloudLoading}
        />

        {/* OTA Update Banner */}
        <UpdateBanner />

        {/* Debug Controls (DEV only) - uncomment to test OTA updates */}
        {/* <OTAUpdateDebugControls /> */}

        {/* Current View */}
        <Suspense fallback={<LoadingView />}>{renderCurrentView()}</Suspense>
      </View>

      {/* Drawer Navigation - Rendered last to appear on top */}
      <AppDrawer
        drawerIsVisible={drawerIsVisible}
        setDrawerIsVisible={setDrawerIsVisible}
      />
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
