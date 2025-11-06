import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { getUpdateVersion } from '@/hooks/useExpoUpdates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNotifications } from '@/hooks/useNotifications';
import { getCorruptedCount } from '@/services/corruptedAttachmentsService';
import { useLocalStore } from '@/store/localStore';
import {
  backupUnsyncedAudio,
  prepareBackupPaths,
  requestBackupDirectory
} from '@/utils/backupUtils';
import { useRenderCounter } from '@/utils/performanceUtils';
import { cn, getThemeColor } from '@/utils/styleUtils';
import { AttachmentState } from '@powersync/attachments';
import * as Updates from 'expo-updates';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertTriangle,
  BellIcon,
  CloudDownload,
  CloudUpload,
  CloudUploadIcon,
  Download,
  HomeIcon,
  LogOutIcon,
  SaveIcon,
  SettingsIcon,
  UserIcon
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IndeterminateProgressBar } from './IndeterminateProgressBar';
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
  const { signOut, currentUser } = useAuth();
  const {
    goToProjects,
    goToProfile,
    goToNotifications,
    goToSettings,
    goToCorruptedAttachments,
    currentView
  } = useAppNavigation();

  // Get safe area insets for Android navigation bar
  const insets = useSafeAreaInsets();

  // Add performance tracking
  useRenderCounter('AppDrawer');

  const systemReady = useLocalStore((state) => state.systemReady);

  // Track corrupted attachments count
  const [corruptedCount, setCorruptedCount] = useState(0);

  // Load corrupted attachments count when drawer opens
  useEffect(() => {
    if (drawerIsVisible && systemReady) {
      void (async () => {
        try {
          const count = await getCorruptedCount();
          setCorruptedCount(count);
        } catch (error) {
          console.error('Failed to get corrupted count:', error);
          setCorruptedCount(0);
        }
      })();
    }
  }, [drawerIsVisible, systemReady]);

  const isConnected = useNetworkStatus();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  // Progress tracking states
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncOperation, setSyncOperation] = useState<
    'backup' | 'restore' | null
  >(null);

  // Animation and grace period states
  const [showAttachmentProgress, setShowAttachmentProgress] = useState(false);
  const [isInGracePeriod, setIsInGracePeriod] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const gracePeriodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const GRACE_PERIOD_MS = 3000; // 3 seconds grace period

  // Get PowerSync status
  const powersyncStatus = systemReady ? system.powersync.currentStatus : null;

  // Get attachment sync progress from store (no debouncing for real-time updates)
  const attachmentSyncProgress = useLocalStore(
    (state) => state.attachmentSyncProgress
  );

  // Get all attachment states for accurate progress tracking
  // Only watch attachment states when drawer is open to prevent unnecessary renders
  const { attachmentStates, isLoading: attachmentStatesLoading } =
    useAttachmentStates([], drawerIsVisible);

  // Smooth progress animation state
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);

  // Throttled attachment progress - only update when counts change significantly
  const [throttledProgress, setThrottledProgress] = useState({
    total: 0,
    synced: 0,
    downloading: 0,
    queued: 0,
    hasActivity: false,
    unsynced: 0
  });

  const lastUpdateTimeRef = useRef(0);
  const THROTTLE_MS = 200; // Update at most every 200ms (faster for snappier feel)

  // Animate progress smoothly (Safari-style)
  // Only animate when drawer is open to prevent unnecessary renders
  useEffect(() => {
    // Skip animation updates when drawer is closed
    if (!drawerIsVisible) {
      setAnimatedProgress(0);
      targetProgressRef.current = 0;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    if (
      !attachmentSyncProgress.downloading &&
      !attachmentSyncProgress.uploading
    ) {
      setAnimatedProgress(0);
      targetProgressRef.current = 0;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Calculate target progress
    const downloadProgress =
      attachmentSyncProgress.downloadTotal > 0
        ? (attachmentSyncProgress.downloadCurrent /
            attachmentSyncProgress.downloadTotal) *
          100
        : 0;

    targetProgressRef.current = downloadProgress;

    // Smooth animation using requestAnimationFrame
    const animate = () => {
      setAnimatedProgress((current) => {
        const diff = targetProgressRef.current - current;

        // If we're close enough, snap to target
        if (Math.abs(diff) < 0.1) {
          return targetProgressRef.current;
        }

        // For big jumps (>5%), snap immediately to reduce lag
        if (Math.abs(diff) > 5) {
          return targetProgressRef.current;
        }

        // For medium jumps, animate quickly
        // Use 30% of the difference per frame for very responsive feel
        const speed = Math.max(1.5, Math.abs(diff) * 0.3);
        return current + (diff > 0 ? speed : -speed);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    drawerIsVisible,
    attachmentSyncProgress.downloading,
    attachmentSyncProgress.uploading,
    attachmentSyncProgress.downloadCurrent,
    attachmentSyncProgress.downloadTotal
  ]);

  // Calculate attachment progress stats
  // Return empty state when drawer is closed to prevent unnecessary computation
  const attachmentProgress = useMemo(() => {
    // Short-circuit when drawer is closed - return empty state
    if (!drawerIsVisible) {
      return {
        total: 0,
        synced: 0,
        downloading: 0,
        queued: 0,
        hasActivity: false,
        unsynced: 0
      };
    }

    if (attachmentStatesLoading || attachmentStates.size === 0) {
      return {
        total: 0,
        synced: 0,
        downloading: 0,
        queued: 0,
        hasActivity: false,
        unsynced: 0
      };
    }

    let synced = 0;
    let downloading = 0;
    let queued = 0;
    const total = attachmentStates.size;

    // Debug: log the states we're seeing
    const statesCounts = new Map<string, number>();

    for (const record of attachmentStates.values()) {
      // Count states for debugging
      const stateKey = `${record.state}`;
      statesCounts.set(stateKey, (statesCounts.get(stateKey) || 0) + 1);

      if (record.state === AttachmentState.SYNCED) {
        synced++;
      } else if (record.state === AttachmentState.QUEUED_DOWNLOAD) {
        downloading++;
      } else if (record.state === AttachmentState.QUEUED_SYNC) {
        queued++;
      }
    }

    const hasActivity = downloading > 0 || queued > 0;

    // Debug logging when there's activity (but throttled)
    // const now = Date.now();
    // if (
    //   (hasActivity || total > 0) &&
    //   now - lastUpdateTimeRef.current > THROTTLE_MS
    // ) {
    //   console.log(`📊 [AppDrawer] Attachment states:`, {
    //     total,
    //     synced,
    //     downloading,
    //     queued,
    //     hasActivity,
    //     statesCounts: Object.fromEntries(statesCounts)
    //   });
    //   lastUpdateTimeRef.current = now;
    // }

    return {
      total,
      synced,
      downloading,
      queued,
      hasActivity,
      unsynced: total - synced
    };
  }, [drawerIsVisible, attachmentStatesLoading, attachmentStates]); // Only recompute when size changes, not on every attachment state change

  // Throttle updates to the rendered progress
  // Skip throttling when drawer is closed
  useEffect(() => {
    // Don't update throttled progress when drawer is closed
    if (!drawerIsVisible) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    // Check if counts have changed meaningfully
    const countsDifferent =
      attachmentProgress.total !== throttledProgress.total ||
      attachmentProgress.synced !== throttledProgress.synced ||
      attachmentProgress.downloading !== throttledProgress.downloading ||
      attachmentProgress.queued !== throttledProgress.queued ||
      attachmentProgress.hasActivity !== throttledProgress.hasActivity;

    if (!countsDifferent) return;

    // Update immediately if enough time has passed or activity state changed
    if (
      timeSinceLastUpdate > THROTTLE_MS ||
      attachmentProgress.hasActivity !== throttledProgress.hasActivity
    ) {
      setThrottledProgress(attachmentProgress);
      lastUpdateTimeRef.current = now;
    } else {
      // Schedule an update after throttle period
      const timeoutId = setTimeout(() => {
        setThrottledProgress(attachmentProgress);
        lastUpdateTimeRef.current = Date.now();
      }, THROTTLE_MS - timeSinceLastUpdate);

      return () => clearTimeout(timeoutId);
    }
  }, [drawerIsVisible, attachmentProgress, throttledProgress]);

  // Handle attachment progress visibility with grace period
  useEffect(() => {
    if (throttledProgress.hasActivity) {
      // Clear any existing timer
      if (gracePeriodTimer.current) {
        clearTimeout(gracePeriodTimer.current);
        gracePeriodTimer.current = null;
      }

      // Show the progress section if not already showing
      if (!showAttachmentProgress) {
        setShowAttachmentProgress(true);
        setIsInGracePeriod(false);

        // Animate in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false
        }).start();
      } else {
        // If we're in grace period and activity resumes, exit grace period
        setIsInGracePeriod(false);
      }
    } else if (showAttachmentProgress && !isInGracePeriod) {
      // Activity stopped, start grace period
      setIsInGracePeriod(true);

      gracePeriodTimer.current = setTimeout(() => {
        // Hide the progress section after grace period
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false
        }).start(() => {
          setShowAttachmentProgress(false);
          setIsInGracePeriod(false);
        });
      }, GRACE_PERIOD_MS);
    }

    // Cleanup timer on unmount
    return () => {
      if (gracePeriodTimer.current) {
        clearTimeout(gracePeriodTimer.current);
      }
    };
  }, [
    throttledProgress.hasActivity,
    showAttachmentProgress,
    isInGracePeriod,
    fadeAnim
  ]);

  // Use the notifications hook
  const { totalCount: notificationCount } = useNotifications();

  // Memoize formatted speed to prevent render loops
  const formattedDownloadSpeed = useMemo(() => {
    if (
      !attachmentSyncProgress.downloading ||
      attachmentSyncProgress.downloadSpeed <= 0
    ) {
      return null;
    }

    const speed = attachmentSyncProgress.downloadSpeed;
    const bytesPerSec = attachmentSyncProgress.downloadBytesPerSec;
    const filesPerSec = speed.toFixed(1);

    // Format bytes nicely
    if (bytesPerSec > 1024 * 1024) {
      return `${filesPerSec} files/s • ${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    } else if (bytesPerSec > 1024) {
      return `${filesPerSec} files/s • ${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    } else if (bytesPerSec > 0) {
      return `${filesPerSec} files/s`;
    }

    return `${filesPerSec} files/s`;
  }, [
    attachmentSyncProgress.downloading,
    attachmentSyncProgress.downloadSpeed,
    attachmentSyncProgress.downloadBytesPerSec
  ]);

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

  // Feature flag to toggle notifications visibility
  const SHOW_NOTIFICATIONS = true; // Set to true to enable notifications

  // Helper function to close drawer and execute action
  const closeDrawerAndExecute = (action: () => void) => {
    setDrawerIsVisible(false);
    action();
  };

  const handleProgress = (current: number, total: number) => {
    setSyncProgress(current);
    setSyncTotal(total);
  };

  const handleBackup = async () => {
    let finalAlertTitle = t('backupErrorTitle'); // Default to error
    let finalAlertMessage = '';
    let aborted = false;

    try {
      // 1. System & Queue Init Checks
      console.log('systemReady', systemReady);
      if (!systemReady) {
        throw new Error(t('databaseNotReady'));
      }

      // Check if attachment queues are ready (no manual init needed anymore)
      if (!system.areAttachmentQueuesReady()) {
        console.log(
          'Attachment queues not ready, waiting for system initialization...'
        );
        // Poll for attachment queues to be ready, with timeout
        const MAX_WAIT_TIME = 5000; // 5 seconds max wait
        const POLL_INTERVAL = 200; // Check every 200ms
        const startTime = Date.now();

        while (Date.now() - startTime < MAX_WAIT_TIME) {
          if (system.areAttachmentQueuesReady()) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        }

        if (!system.areAttachmentQueuesReady()) {
          throw new Error(
            'Attachment queues failed to initialize after timeout. Check if Supabase bucket is configured.'
          );
        }
      }

      // 2. Permissions
      console.log('[handleBackup] Requesting directory permissions...');
      const baseDirectoryUri = await requestBackupDirectory();
      if (!baseDirectoryUri) {
        // User cancelled or no directory – silently exit
        aborted = true;
        return;
      }
      console.log('[handleBackup] Permissions granted, preparing paths...');

      // 3. Prepare Paths
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      prepareBackupPaths(timestamp); // Call it but don't store result if unneeded
      console.log('[handleBackup] Paths prepared, attempting audio backup...');

      setIsBackingUp(true);
      setSyncOperation('backup');
      setSyncProgress(0);
      setSyncTotal(1); // Default to 1 to avoid division by zero

      // 4. Execute Backup (Audio Only) with progress callback
      const audioResult = await backupUnsyncedAudio(
        system,
        baseDirectoryUri,
        handleProgress
      );

      // 5. Construct Success Message
      finalAlertTitle = t('backupCompleteTitle');
      console.log('audioResult', audioResult);
      const copied = audioResult.count;
      const csvRows = audioResult.csvRows;
      // Build comprehensive message
      const msgParts = [
        `Audio files backed up: ${copied}`,
        csvRows > 0 ? `CSV export: ${csvRows} records` : ''
      ].filter(Boolean);
      const msg = msgParts.join('\n');
      finalAlertMessage = msg || `Backup completed: ${copied} files`;
    } catch (error: unknown) {
      // Handle errors from any awaited step above
      console.log('[handleBackup] Entered CATCH block.');
      console.error('Error during backup process:', error);
      const errorString =
        error instanceof Error ? error.message : String(error);
      finalAlertMessage = t('criticalBackupError', {
        error: errorString || 'Unknown error occurred'
      });
    } finally {
      // 6. Final Alert & State Reset
      console.log('[handleBackup] Entered FINALLY block.');
      if (aborted) {
        // do not alert on user-cancel; still reset state
        setIsBackingUp(false);
        setTimeout(() => setSyncOperation(null), 0);
      } else {
        setIsBackingUp(false);
        // Set operation to null after a delay to allow seeing the final progress
        setTimeout(() => {
          setSyncOperation(null);
        }, 1500);

        // Ensure message isn't empty if something went wrong before catch block assignment
        if (!finalAlertMessage) {
          finalAlertMessage = t('criticalBackupError', {
            error: 'Backup failed unexpectedly'
          });
        }
        Alert.alert(finalAlertTitle, finalAlertMessage);
      }
    }
  };

  const confirmAndStartBackup = () => {
    Alert.alert(t('startBackupTitle'), t('startBackupMessageAudioOnly'), [
      {
        text: t('cancel'),
        style: 'cancel'
      },
      {
        text: t('backupAudioAction'),
        onPress: () => void handleBackup()
      }
    ]);
  };

  // const handleRestore = () => {
  //   const onStart = () => {
  //     setIsRestoring(true);
  //     setSyncOperation('restore');
  //     setSyncProgress(0);
  //     setSyncTotal(1); // Default until we know the total
  //   };

  //   const onFinish = () => {
  //     setIsRestoring(false);
  //     // Set operation to null after a delay to allow seeing the final progress
  //     setTimeout(() => {
  //       setSyncOperation(null);
  //     }, 1500);
  //   };

  //   if (!currentUser?.id) {
  //     Alert.alert(t('error'), t('userNotLoggedIn'));
  //     return;
  //   }

  //   void selectAndInitiateRestore(
  //     system,
  //     currentUser.id,
  //     t,
  //     onStart,
  //     onFinish,
  //     handleProgress
  //   );
  // };

  // Calculate progress percentage for the progress bar

  const progressPercentage =
    syncTotal > 0 ? (syncProgress / syncTotal) * 100 : 0;
  const isOperationActive = isBackingUp || isRestoring;

  // Progress status text
  const getProgressText = () => {
    if (!syncOperation) return '';

    if (syncProgress === syncTotal && syncTotal > 0) {
      return t('syncComplete');
    }

    return t('syncProgress', { current: syncProgress, total: syncTotal });
  };

  // Debug function to log PowerSync status
  const logPowerSyncStatus = () => {
    console.log('=== PowerSync Status Debug ===');
    console.log('systemReady:', systemReady);
    console.log('powersyncStatus:', powersyncStatus);
    if (powersyncStatus) {
      console.log('connected:', powersyncStatus.connected);
      console.log('connecting:', powersyncStatus.connecting);
      console.log('dataFlowStatus:', powersyncStatus.dataFlowStatus);
      console.log('hasSynced:', powersyncStatus.hasSynced);
      console.log('lastSyncedAt:', powersyncStatus.lastSyncedAt);
    }
    console.log('==============================');
  };

  // Build drawer items based on auth status
  const drawerItems: DrawerItemType[] = [
    {
      name: t('projects'),
      view: 'projects',
      icon: HomeIcon,
      onPress: () => closeDrawerAndExecute(goToProjects)
    }
  ];

  // Only show authenticated-only items if user is logged in
  if (currentUser) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (SHOW_NOTIFICATIONS) {
      drawerItems.push({
        name: t('notifications'),
        view: 'notifications',
        icon: BellIcon,
        onPress: () => closeDrawerAndExecute(goToNotifications),
        notificationCount
      });
    }
    drawerItems.push(
      {
        name: t('profile'),
        view: 'profile',
        icon: UserIcon,
        onPress: () => closeDrawerAndExecute(goToProfile)
      },
      {
        name: t('settings'),
        view: 'settings',
        icon: SettingsIcon,
        onPress: () => closeDrawerAndExecute(goToSettings)
      }
    );
  } else {
    // Anonymous user - show Sign In button prominently
    const setAuthView = useLocalStore((state) => state.setAuthView);
    drawerItems.push({
      name: t('signIn') || 'Sign In',
      icon: UserIcon,
      onPress: () => {
        setDrawerIsVisible(false);
        setAuthView('sign-in');
      }
    });
  }

  // Add diagnostics menu item if there are corrupted attachments or in dev mode

  if (corruptedCount > 0 || __DEV__) {
    drawerItems.push({
      name: __DEV__ ? 'Diagnostics' : 'System Health',
      view: 'corrupted-attachments',
      icon: AlertTriangle,
      onPress: () => closeDrawerAndExecute(goToCorruptedAttachments),
      notificationCount: corruptedCount > 0 ? corruptedCount : undefined
    });
  }

  if (Platform.OS === 'android') {
    drawerItems.push({
      name: isBackingUp ? t('backingUp') : t('backup'),
      icon: SaveIcon,
      onPress: confirmAndStartBackup,
      disabled: !systemReady || isOperationActive
    });
    // Restore backup option temporarily hidden
    // drawerItems.push({
    //   name: isRestoring ? t('restoring') : t('restoreBackup'),
    //   icon: CloudUploadIcon,
    //   onPress: handleRestore,
    //   disabled: !systemReady || isOperationActive
    // });
  }

  // Add logout for development
  if (__DEV__) {
    drawerItems.push({
      name: t('logOut'),
      icon: LogOutIcon,
      onPress: () => closeDrawerAndExecute(() => void signOut()),
      disabled: !systemReady || isOperationActive
    });
  }

  // Use a ref to track if drawer has ever been opened to ensure proper initialization
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (drawerIsVisible) {
      hasOpenedRef.current = true;
    }
  }, [drawerIsVisible]);

  // Only render Drawer when it's been opened at least once or is currently visible
  // This prevents provider conflicts with other views
  if (!hasOpenedRef.current && !drawerIsVisible) {
    return null;
  }

  return (
    <Drawer
      open={drawerIsVisible}
      onOpenChange={setDrawerIsVisible}
      dismissible={!isOperationActive}
      snapPoints={['80%']}
      enableDynamicSizing={false}
    >
      <DrawerContent
      // className="p-2 pt-4"
      // style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <DrawerHeader className="hidden">
          <DrawerTitle>{t('menu')}</DrawerTitle>
        </DrawerHeader>
        <View className="flex flex-col gap-4">
          {/* System status and progress indicators */}
          {!systemReady && (
            <View className="flex-row items-center justify-center gap-2 rounded-md bg-muted p-3 opacity-70">
              {isConnected ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={getThemeColor('primary')}
                  />
                  <Text className="text-sm text-foreground">
                    {t('initializing')}...
                  </Text>
                </>
              ) : (
                <>
                  <Icon
                    as={CloudUploadIcon}
                    size={16}
                    className="text-foreground"
                  />
                  <Text className="text-sm text-foreground">
                    {t('offline')}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* File sync progress indicator */}
          {syncOperation && (
            <View className="rounded-md bg-muted p-3">
              <Text className="text-center text-sm font-medium text-foreground">
                {syncOperation === 'backup' ? t('backingUp') : t('restoring')}
              </Text>
              <View className="flex flex-col gap-2">
                <Progress value={progressPercentage} className="h-2" />
                <Text className="text-center text-sm text-foreground">
                  {getProgressText()}
                </Text>
              </View>
            </View>
          )}

          {/* PowerSync status section */}
          <Button
            variant="ghost"
            className="h-auto flex-col items-center justify-center rounded-md bg-muted p-3"
            onPress={logPowerSyncStatus}
          >
            {/* Database sync errors */}
            {(powersyncStatus?.dataFlowStatus.downloadError ||
              powersyncStatus?.dataFlowStatus.uploadError) && (
              <View className="mb-2 flex-row items-center gap-2 rounded-md bg-destructive/20 p-2">
                <Icon
                  as={AlertTriangle}
                  size={16}
                  className="text-destructive"
                />
                <Text className="flex-1 text-sm text-destructive">
                  {t('databaseSyncError')}
                </Text>
              </View>
            )}

            {/* Status text with icon */}
            <View className="flex-row items-center gap-2">
              {powersyncStatus?.dataFlowStatus.uploading && (
                <Icon as={CloudUpload} size={16} className="text-primary" />
              )}
              {powersyncStatus?.dataFlowStatus.downloading && (
                <Icon as={CloudDownload} size={16} className="text-primary" />
              )}
              <Text className="text-center text-sm font-medium text-foreground">
                {!isConnected
                  ? `${throttledProgress.synced} ${t('filesDownloaded')}`
                  : powersyncStatus?.dataFlowStatus.uploading
                    ? t('uploadingData')
                    : powersyncStatus?.dataFlowStatus.downloading
                      ? t('downloadingData')
                      : powersyncStatus?.connected
                        ? powersyncStatus.hasSynced
                          ? `${t('lastSync')}: ${powersyncStatus.lastSyncedAt?.toLocaleTimeString() || t('unknown')}`
                          : t('notSynced')
                        : powersyncStatus?.connecting
                          ? t('connecting')
                          : t('disconnected')}
              </Text>
            </View>

            {/* Indeterminate progress bar for database sync */}
            {(powersyncStatus?.dataFlowStatus.downloading ||
              powersyncStatus?.dataFlowStatus.uploading) && (
              <View className="mt-2 w-full">
                <IndeterminateProgressBar
                  isActive={
                    powersyncStatus.dataFlowStatus.downloading ||
                    powersyncStatus.dataFlowStatus.uploading
                  }
                />
              </View>
            )}
          </Button>

          {/* OTA Patch Version */}
          <View className="rounded-md bg-muted p-3">
            <Text className="text-center text-xs text-muted-foreground">
              {formattedPatchVersion}
            </Text>
          </View>

          {/* Attachment sync progress section */}
          {(showAttachmentProgress ||
            throttledProgress.hasActivity ||
            throttledProgress.total > 0) && (
            <Animated.View
              style={{
                opacity: showAttachmentProgress ? fadeAnim : 1
              }}
            >
              <View
                className={cn(
                  'rounded-md p-3',
                  throttledProgress.hasActivity ? 'bg-primary/20' : 'bg-muted'
                )}
              >
                <View className="flex flex-col gap-2">
                  <View className="flex flex-row items-start gap-2">
                    {throttledProgress.hasActivity && (
                      <Icon
                        as={Download}
                        size={14}
                        className="mt-1 text-primary"
                      />
                    )}
                    <View className="min-w-0 flex-1">
                      <Text
                        className={cn(
                          'flex-shrink flex-wrap text-sm text-foreground',
                          throttledProgress.hasActivity
                            ? 'font-semibold'
                            : 'font-medium'
                        )}
                        style={{ flexWrap: 'wrap' }}
                      >
                        {isInGracePeriod ? (
                          <>
                            <Text className="font-semibold text-primary">
                              {t('downloadComplete')}
                            </Text>
                            <Text className="text-sm text-foreground">
                              {' '}
                              ({throttledProgress.synced}/
                              {throttledProgress.total} {t('files')})
                            </Text>
                          </>
                        ) : attachmentSyncProgress.downloading ? (
                          <>
                            <Text className="text-sm font-semibold text-foreground">
                              {t('downloading')}:{' '}
                              {attachmentSyncProgress.downloadCurrent}/
                              {attachmentSyncProgress.downloadTotal}
                            </Text>
                          </>
                        ) : throttledProgress.downloading > 0 &&
                          throttledProgress.queued > 0 ? (
                          <>
                            <Text className="text-sm text-foreground">
                              {t('syncingAttachments')}:{' '}
                              {throttledProgress.downloading}
                            </Text>
                            <Text className="text-sm text-foreground">, </Text>
                            <Text className="text-sm text-foreground">
                              {t('queued')}: {throttledProgress.queued}
                            </Text>
                            <Text className="text-sm text-foreground">
                              {' '}
                              ({throttledProgress.synced}/
                              {throttledProgress.total} {t('complete')})
                            </Text>
                          </>
                        ) : throttledProgress.downloading > 0 ? (
                          <>
                            <Text className="text-sm text-foreground">
                              {t('syncingAttachments')}:{' '}
                              {throttledProgress.downloading} {t('files')}
                            </Text>
                            <Text className="text-sm text-foreground">
                              {' '}
                              ({throttledProgress.synced}/
                              {throttledProgress.total} {t('complete')})
                            </Text>
                          </>
                        ) : throttledProgress.queued > 0 ? (
                          <>
                            <Text className="text-sm text-foreground">
                              {t('queuedForDownload')}:{' '}
                              {throttledProgress.queued} {t('files')}
                            </Text>
                            <Text className="text-sm text-foreground">
                              {' '}
                              ({throttledProgress.synced}/
                              {throttledProgress.total} {t('complete')})
                            </Text>
                          </>
                        ) : (
                          <Text className="text-foreground">
                            {throttledProgress.synced}/{throttledProgress.total}{' '}
                            {t('filesDownloaded')}
                          </Text>
                        )}
                      </Text>
                    </View>
                    {formattedDownloadSpeed && (
                      <View className="ml-2">
                        <Badge className="rounded bg-muted px-2 py-1">
                          <Text className="text-xs font-medium text-muted-foreground">
                            {formattedDownloadSpeed}
                          </Text>
                        </Badge>
                      </View>
                    )}
                  </View>
                  <Progress
                    value={
                      isInGracePeriod
                        ? 100
                        : attachmentSyncProgress.downloading
                          ? animatedProgress
                          : throttledProgress.total > 0
                            ? (throttledProgress.synced /
                                throttledProgress.total) *
                              100
                            : 0
                    }
                    className="h-1"
                  />
                </View>
              </View>
            </Animated.View>
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
