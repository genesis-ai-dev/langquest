/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Main App View - Single route with state-driven navigation
 * Replaces the entire file-based routing structure
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { Suspense, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors } from '@/styles/theme';

// View Components (to be created/migrated)
import NotificationsView from '@/views/NotificationsView';
import ProfileView from '@/views/ProfileView';
// import ProjectsView from '@/views/ProjectsView';
// import QuestsView from '@/views/QuestsView';
import SettingsView from '@/views/SettingsView';
import NextGenAssetDetailView from '@/views/new/NextGenAssetDetailView';
import NextGenAssetsView from '@/views/new/NextGenAssetsView';
import NextGenProjectsView from '@/views/new/NextGenProjectsView';
import NextGenQuestsView from '@/views/new/NextGenQuestsView';

// Common UI Components
import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import LoadingView from '@/components/LoadingView';
import AssetDetailView from './AssetDetailView';
import AssetsView from './AssetsView';
import ProjectsView from './ProjectsView';
import QuestsView from './QuestsView';

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

  const SHOULD_USE_NEXT_GEN_VIEWS = true;
  const renderCurrentView = () => {
    switch (currentView) {
      case 'projects':
        return SHOULD_USE_NEXT_GEN_VIEWS ? (
          <NextGenProjectsView />
        ) : (
          <ProjectsView />
        );
      case 'quests':
        return SHOULD_USE_NEXT_GEN_VIEWS ? (
          <NextGenQuestsView />
        ) : (
          <QuestsView />
        );
      case 'assets':
        return SHOULD_USE_NEXT_GEN_VIEWS ? (
          <NextGenAssetsView />
        ) : (
          <AssetsView />
        );
      case 'asset-detail':
        return SHOULD_USE_NEXT_GEN_VIEWS ? (
          <NextGenAssetDetailView />
        ) : (
          <AssetDetailView />
        );
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
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.gradient}
    >
      <View style={styles.appContainer}>
        {/* Drawer Navigation */}
        <AppDrawer
          drawerIsVisible={drawerIsVisible}
          setDrawerIsVisible={setDrawerIsVisible}
        />

        {/* Main Content Area */}
        <View style={styles.contentContainer}>
          {/* App Header */}
          <AppHeader
            drawerToggleCallback={() => setDrawerIsVisible(!drawerIsVisible)}
          />

          {/* Current View */}
          <Suspense fallback={<LoadingView />}>{renderCurrentView()}</Suspense>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1
  },
  appContainer: {
    flex: 1,
    flexDirection: 'row'
  },
  contentContainer: {
    flex: 1
  }
});
