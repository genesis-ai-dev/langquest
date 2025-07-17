/**
 * Main App View - Single route with state-driven navigation
 * Replaces the entire file-based routing structure
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { Suspense, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors } from '@/styles/theme';

// View Components (to be created/migrated)
import AssetDetailView from '@/views/AssetDetailView';
import AssetsView from '@/views/AssetsView';
import NotificationsView from '@/views/NotificationsView';
import ProfileView from '@/views/ProfileView';
import ProjectsView from '@/views/ProjectsView';
import QuestsView from '@/views/QuestsView';
import SettingsView from '@/views/SettingsView';

// Common UI Components
import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import LoadingView from '@/components/LoadingView';
import RapidRecordingView from './RapidRecordingView';

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
        return <ProjectsView />;
        // return <RapidRecordingView />;
      case 'quests':
        return <QuestsView />;
      case 'assets':
        return <AssetsView />;
      case 'asset-detail':
        return <AssetDetailView />;
      case 'profile':
        return <ProfileView />;
      case 'notifications':
        return <NotificationsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <ProjectsView />;
    }
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={styles.gradient}
        >
          <SafeAreaView
            style={styles.safeArea}
            edges={['top', 'left', 'right']}
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
                  drawerToggleCallback={() =>
                    setDrawerIsVisible(!drawerIsVisible)
                  }
                />

                {/* Current View */}
                <Suspense fallback={<LoadingView />}>
                  {renderCurrentView()}
                </Suspense>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  gradient: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  appContainer: {
    flex: 1,
    flexDirection: 'row'
  },
  contentContainer: {
    marginTop: 50,
    flex: 1
  }
});
