import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentProgress } from '@/hooks/useAttachmentProgress';
import { getUpdateVersion } from '@/hooks/useExpoUpdates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import { usePowerSyncStatus } from '@powersync/react-native';
import * as Updates from 'expo-updates';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertTriangle,
  BellIcon,
  CheckCircle2,
  CloudDownload,
  CloudOff,
  CloudUpload,
  HomeIcon,
  LogOutIcon,
  RefreshCw,
  SettingsIcon,
  UserIcon,
  XCircle
} from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Badge } from './ui/badge';

interface DrawerItemType {
  name: string;
  view?: string;
  icon: LucideIcon;
  onPress: () => void;
  notificationCount?: number;
  disabled?: boolean;
}

export default function AppDrawer({
  drawerIsVisible,
  setDrawerIsVisible
}: {
  drawerIsVisible: boolean;
  setDrawerIsVisible: (isVisible: boolean) => void;
}) {
  const { t } = useLocalization();
  const { signOut, currentUser, isAuthenticated } = useAuth();
  const {
    goToProjects,
    goToProfile,
    goToNotifications,
    goToSettings,
    goToCorruptedAttachments,
    currentView
  } = useAppNavigation();

  const notificationResult = useNotifications();
  const notificationCount = useMemo(
    () => notificationResult.totalCount,
    [notificationResult.totalCount]
  );

  const setAuthView = useLocalStore((state) => state.setAuthView);

  // Always call hooks (Rules of Hooks), but only subscribe when drawer is visible
  // The hooks themselves handle memoization to prevent re-renders
  const powerSyncStatus = usePowerSyncStatus();

  // Get attachment progress - hook handles enabled state internally
  // Only query when drawer is visible and user is authenticated
  const { progress: stableProgress, syncProgress } = useAttachmentProgress(
    drawerIsVisible && isAuthenticated
  );

  // Memoize progress values to prevent re-renders when object reference changes
  // but values are the same - extract individual values for dependency tracking
  // TEMPORARILY DISABLED: Commenting out to debug infinite loop
  // const stableProgress = useMemo(() => {
  //   return {
  //     total: 0,
  //     synced: 0,
  //     downloading: 0,
  //     queued: 0,
  //     unsynced: 0,
  //     hasActivity: false
  //   };
  // }, []);

  // // TEMPORARILY DISABLED: Commenting out to debug infinite loop
  // const powerSyncStatus = useMemo(
  //   () => ({
  //     connected: false,
  //     connecting: false,
  //     downloading: false,
  //     uploading: false,
  //     hasSynced: undefined,
  //     lastSyncedAt: undefined,
  //     downloadError: undefined,
  //     uploadError: undefined
  //   }),
  //   []
  // );

  // Track if drawer has ever been opened to ensure proper initialization
  const [hasOpened, setHasOpened] = React.useState(false);

  React.useEffect(() => {
    if (drawerIsVisible) {
      setHasOpened(true);
    }
  }, [drawerIsVisible]);

  // Memoize snapPoints to prevent drawer context from changing unnecessarily
  const snapPoints = React.useMemo(() => ['80%'], []);

  // Helper function to close drawer and execute action
  const closeDrawerAndExecute = useCallback(
    (action: () => void) => {
      setDrawerIsVisible(false);
      action();
    },
    [setDrawerIsVisible]
  );

  // Navigation callbacks
  const handleGoToProjects = useCallback(
    () => closeDrawerAndExecute(goToProjects),
    [closeDrawerAndExecute, goToProjects]
  );
  const handleGoToNotifications = useCallback(
    () => closeDrawerAndExecute(goToNotifications),
    [closeDrawerAndExecute, goToNotifications]
  );
  const handleGoToProfile = useCallback(
    () => closeDrawerAndExecute(goToProfile),
    [closeDrawerAndExecute, goToProfile]
  );
  const handleGoToSettings = useCallback(
    () => closeDrawerAndExecute(goToSettings),
    [closeDrawerAndExecute, goToSettings]
  );
  const handleGoToCorruptedAttachments = useCallback(
    () => closeDrawerAndExecute(goToCorruptedAttachments),
    [closeDrawerAndExecute, goToCorruptedAttachments]
  );
  // const handleGoToDownloadStatus = useCallback(
  //   () => closeDrawerAndExecute(goToDownloadStatus as () => void),
  //   [closeDrawerAndExecute, goToDownloadStatus]
  // );
  const handleSignIn = useCallback(() => {
    setDrawerIsVisible(false);
    setAuthView('sign-in');
  }, [setDrawerIsVisible, setAuthView]);
  const handleSignOut = useCallback(() => {
    closeDrawerAndExecute(() => {
      void signOut();
    });
  }, [closeDrawerAndExecute, signOut]);

  // Format OTA patch version
  const formattedPatchVersion = useMemo(() => {
    try {
      // Handle embedded version (no OTA update applied)
      if (Updates.isEmbeddedLaunch) {
        return 'Embedded';
      }

      const manifest = Updates.manifest;

      // Extract version from updateId (first 8 characters of UUID from updateId)
      const version = getUpdateVersion();
      let dateStr = '';

      // Try to get createdAt from manifest extra or metadata
      const createdAt =
        (manifest as { createdAt?: string }).createdAt ||
        (manifest as { extra?: { createdAt?: string } }).extra?.createdAt;

      if (createdAt) {
        const date = new Date(createdAt);
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
      }

      // Combine into format: "Patch v1.2 • Jan 15, 2025"
      if (dateStr) {
        return `Patch ${version} • ${dateStr}`;
      } else {
        return `Patch ${version}`;
      }
    } catch (error) {
      console.error('Error formatting patch version:', error);
      return 'Unknown';
    }
  }, []);

  // Build drawer items based on auth status
  const drawerItems: DrawerItemType[] = useMemo(() => {
    const items: DrawerItemType[] = [
      {
        name: t('projects'),
        view: 'projects',
        icon: HomeIcon,
        onPress: handleGoToProjects
      }
    ];

    // Only show authenticated-only items if user is logged in
    if (currentUser) {
      items.push({
        name: t('notifications'),
        view: 'notifications',
        icon: BellIcon,
        onPress: handleGoToNotifications,
        notificationCount
      });
      items.push(
        {
          name: t('profile'),
          view: 'profile',
          icon: UserIcon,
          onPress: handleGoToProfile
        },
        {
          name: t('settings'),
          view: 'settings',
          icon: SettingsIcon,
          onPress: handleGoToSettings
        }
      );
    } else {
      // Anonymous user - show Sign In button prominently
      items.push({
        name: t('signIn') || 'Sign In',
        icon: UserIcon,
        onPress: handleSignIn
      });
    }

    // // Add download status menu item (always available)
    // items.push({
    //   name: 'Download Status',
    //   view: 'download-status',
    //   icon: CloudDownload,
    //   onPress: handleGoToDownloadStatus
    // });

    // Add diagnostics menu item in dev mode
    if (__DEV__) {
      items.push({
        name: 'Diagnostics',
        view: 'corrupted-attachments',
        icon: AlertTriangle,
        onPress: handleGoToCorruptedAttachments
      });
    }

    // Add logout for development
    if (__DEV__) {
      items.push({
        name: t('logOut'),
        icon: LogOutIcon,
        onPress: handleSignOut
      });
    }

    return items;
  }, [
    t,
    currentUser,
    notificationCount,
    handleGoToProjects,
    handleGoToNotifications,
    handleGoToProfile,
    handleGoToSettings,
    handleGoToCorruptedAttachments,
    handleSignIn,
    handleSignOut
  ]);

  // Only render Drawer when it's been opened at least once or is currently visible
  // This prevents provider conflicts with other views
  if (!hasOpened && !drawerIsVisible) {
    return null;
  }

  return (
    <Drawer
      open={drawerIsVisible}
      onOpenChange={setDrawerIsVisible}
      dismissible={true}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
    >
      <DrawerContent>
        <DrawerHeader className="hidden">
          <DrawerTitle>{t('menu')}</DrawerTitle>
        </DrawerHeader>
        <View className="flex flex-col gap-4">
          {/* OTA Patch Version */}
          <View className="rounded-md bg-muted p-3">
            <Text className="text-center text-xs text-muted-foreground">
              {formattedPatchVersion}
            </Text>
          </View>

          {/* PowerSync Status - Compact */}
          {isAuthenticated && drawerIsVisible && (
            <View className="rounded-md bg-muted p-2">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-2">
                  <Icon
                    as={
                      powerSyncStatus.connected
                        ? CheckCircle2
                        : powerSyncStatus.connecting
                          ? RefreshCw
                          : powerSyncStatus.downloadError ||
                              powerSyncStatus.uploadError
                            ? XCircle
                            : CloudOff
                    }
                    size={14}
                    className={cn(
                      powerSyncStatus.connected
                        ? 'text-green-500'
                        : powerSyncStatus.connecting
                          ? 'text-yellow-500'
                          : powerSyncStatus.downloadError ||
                              powerSyncStatus.uploadError
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                    )}
                  />
                  <Text className="text-xs text-foreground">
                    {powerSyncStatus.connected
                      ? t('connected')
                      : powerSyncStatus.connecting
                        ? t('connecting')
                        : powerSyncStatus.downloadError ||
                            powerSyncStatus.uploadError
                          ? t('syncError')
                          : t('disconnected')}
                  </Text>
                </View>
                {powerSyncStatus.lastSyncedAt && (
                  <Text className="text-xs text-muted-foreground">
                    {powerSyncStatus.lastSyncedAt.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Attachment Sync Progress - Compact with Download/Upload */}
          {isAuthenticated && drawerIsVisible && stableProgress.total > 0 && (
            <View className="rounded-md bg-muted p-2">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-2">
                  <View className="flex-row items-center gap-1">
                    <Icon
                      as={CloudDownload}
                      size={12}
                      className={cn(
                        stableProgress.downloading > 0 ||
                          syncProgress.downloading
                          ? 'text-blue-500'
                          : 'text-muted-foreground'
                      )}
                    />
                    <Icon
                      as={CloudUpload}
                      size={12}
                      className={cn(
                        stableProgress.uploading > 0 || syncProgress.uploading
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                      )}
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-xs text-foreground">
                        {stableProgress.synced}/{stableProgress.total}{' '}
                        {t('files')}
                      </Text>
                      {stableProgress.hasActivity && (
                        <View className="flex-row items-center gap-1">
                          {stableProgress.downloading > 0 ||
                          syncProgress.downloading ? (
                            <Text className="text-xs text-blue-500">
                              ↓
                              {syncProgress.downloading
                                ? `${syncProgress.downloadCurrent}/${syncProgress.downloadTotal}`
                                : stableProgress.downloading}
                            </Text>
                          ) : null}
                          {stableProgress.uploading > 0 ||
                          syncProgress.uploading ? (
                            <Text className="text-xs text-green-500">
                              ↑
                              {syncProgress.uploading
                                ? `${syncProgress.uploadCurrent}/${syncProgress.uploadTotal}`
                                : stableProgress.uploading}
                            </Text>
                          ) : null}
                          {stableProgress.queued > 0 &&
                            !syncProgress.downloading &&
                            !syncProgress.uploading && (
                              <Text className="text-xs text-muted-foreground">
                                ⏳{stableProgress.queued}
                              </Text>
                            )}
                        </View>
                      )}
                    </View>
                    {/* Stacked progress bars - download from top, upload from bottom */}
                    <View className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-muted-foreground/20">
                      {/* Overall sync progress background (shows synced/total) */}
                      {stableProgress.total > 0 && (
                        <View
                          className="absolute left-0 right-0 bg-primary/30 transition-all"
                          style={{
                            top: 0,
                            bottom: 0,
                            width: `${(stableProgress.synced / stableProgress.total) * 100}%`
                          }}
                        />
                      )}
                      {/* Download progress bar (from top, blue) - overlays on top */}
                      {syncProgress.downloading &&
                        syncProgress.downloadTotal > 0 && (
                          <View
                            className="absolute left-0 right-0 bg-blue-500 transition-all"
                            style={{
                              top: 0,
                              height: `${(syncProgress.downloadCurrent / syncProgress.downloadTotal) * 100}%`
                            }}
                          />
                        )}
                      {/* Upload progress bar (from bottom, green) - overlays on bottom */}
                      {syncProgress.uploading &&
                        syncProgress.uploadTotal > 0 && (
                          <View
                            className="absolute bottom-0 left-0 right-0 bg-green-500 transition-all"
                            style={{
                              height: `${(syncProgress.uploadCurrent / syncProgress.uploadTotal) * 100}%`
                            }}
                          />
                        )}
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Main drawer items */}
          <View className="flex flex-col gap-2">
            {drawerItems.map((item, index) => {
              const isActive = currentView === item.view;

              return (
                <Button
                  key={index}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'h-auto justify-start p-4',
                    item.disabled && 'opacity-50'
                  )}
                  onPress={item.onPress}
                  disabled={item.disabled}
                >
                  <View className="w-full flex-row items-center gap-4">
                    <Icon
                      as={item.icon}
                      size={20}
                      className="text-foreground"
                    />
                    <Text className="flex-1 text-foreground">{item.name}</Text>
                    {!!item.notificationCount && item.notificationCount > 0 && (
                      <Badge
                        className="min-w-5 rounded-full px-1"
                        variant={isActive ? 'secondary' : 'destructive'}
                      >
                        <Text>
                          {item.notificationCount > 99
                            ? '99+'
                            : item.notificationCount}
                        </Text>
                      </Badge>
                    )}
                  </View>
                </Button>
              );
            })}
          </View>
        </View>
      </DrawerContent>
    </Drawer>
  );
}
