/**
 * Main App View - Single route with state-driven navigation
 * Replaces the entire file-based routing structure
 */

import React, { Suspense, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { useAppNavigation } from '@/hooks/useAppNavigation';

// View Components (to be created/migrated)
import NotificationsView from '@/views/NotificationsView';
import ProfileView from '@/views/ProfileView';
// import ProjectsView from '@/views/ProjectsView';
// import QuestsView from '@/views/QuestsView';
import SettingsView from '@/views/SettingsView';
import NextGenAssetDetailView from '@/views/new/NextGenAssetDetailView';
import NextGenAssetsView from '@/views/new/NextGenAssetsView';
import NextGenProjectsView from '@/views/new/NextGenProjectsView';
// import NextGenQuestsView from '@/views/new/NextGenQuestsView';
import ProjectDirectoryView from '@/views/new/ProjectDirectoryView';

// Common UI Components
import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import LoadingView from '@/components/LoadingView';
import { UpdateBanner } from '@/components/UpdateBanner';
import { StatusProvider } from '@/contexts/StatusContext';

export default function AppView() {
  const { currentView, canGoBack, goBack } = useAppNavigation();
  const [drawerIsVisible, setDrawerIsVisible] = useState(false);

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

  const renderCurrentView = () => {
    switch (currentView) {
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
      default:
        return <NextGenProjectsView />;
    }
  };

  return (
    <StatusProvider>
      <View style={styles.appContainer}>
        {/* Main Content Area */}
        <View style={styles.contentContainer}>
          {/* App Header */}
          <AppHeader
            drawerToggleCallback={() => setDrawerIsVisible(!drawerIsVisible)}
          />

          {/* OTA Update Banner */}
          <UpdateBanner />

          {/* Current View */}
          <Suspense fallback={<LoadingView />}>{renderCurrentView()}</Suspense>
        </View>

        {/* Drawer Navigation - Rendered last to appear on top */}
        <AppDrawer
          drawerIsVisible={drawerIsVisible}
          setDrawerIsVisible={setDrawerIsVisible}
        />
      </View>
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
