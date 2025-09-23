import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocalStore } from '@/store/localStore';
import {
  backupUnsyncedAudio,
  prepareBackupPaths,
  requestBackupDirectory
} from '@/utils/backupUtils';
import { useRenderCounter } from '@/utils/performanceUtils';
import { selectAndInitiateRestore } from '@/utils/restoreUtils';
import { cn } from '@/utils/styleUtils';
import { AttachmentState } from '@powersync/attachments';
import type { LucideIcon } from 'lucide-react-native';
import {
  BellIcon,
  CloudUploadIcon,
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
import { ScrollView } from 'react-native-gesture-handler';
import { Badge } from './ui/badge';

interface DrawerItemType {
  name: string;
  view?: string;
  icon: LucideIcon;
  onPress: () => void;
  notificationCount?: number;
  disabled?: boolean;
}

// Shimmer component for grace period
const ShimmerBar: React.FC<{ className?: string }> = ({ className }) => {
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(100);

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false
        })
      ])
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
    };
  }, [shimmerValue]);

  const shimmerTranslate = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-containerWidth, containerWidth]
  });

  return (
    <View
      className={cn('h-1 overflow-hidden rounded-full bg-muted', className)}
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      <Animated.View
        className="h-full w-1/2 rounded-full bg-primary/60"
        style={{
          transform: [{ translateX: shimmerTranslate }]
        }}
      />
    </View>
  );
};

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
    currentView
  } = useAppNavigation();

  // Add performance tracking
  useRenderCounter('AppDrawer');

  const systemReady = system.isInitialized();
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

  // Get attachment sync progress from store
  const _attachmentSyncProgress = useLocalStore(
    (state) => state.attachmentSyncProgress
  );

  // Get all attachment states for accurate progress tracking
  const { attachmentStates, isLoading: attachmentStatesLoading } =
    useAttachmentStates([]);

  // Calculate attachment progress stats
  const attachmentProgress = useMemo(() => {
    if (attachmentStatesLoading || attachmentStates.size === 0) {
      return {
        total: 0,
        synced: 0,
        downloading: 0,
        queued: 0,
        hasActivity: false
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

    // Debug logging when there's activity
    if (hasActivity || total > 0) {
      console.log(`📊 [AppDrawer] Attachment states:`, {
        total,
        synced,
        downloading,
        queued,
        hasActivity,
        statesCounts: Object.fromEntries(statesCounts)
      });
    }

    return {
      total,
      synced,
      downloading,
      queued,
      hasActivity,
      unsynced: total - synced
    };
  }, [attachmentStates, attachmentStatesLoading]);

  // Handle attachment progress visibility with grace period
  useEffect(() => {
    if (attachmentProgress.hasActivity) {
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
    attachmentProgress.hasActivity,
    showAttachmentProgress,
    isInGracePeriod,
    fadeAnim
  ]);

  // Use the notifications hook
  const { totalCount: notificationCount } = useNotifications();

  // Feature flag to toggle notifications visibility
  const SHOW_NOTIFICATIONS = true; // Set to true to enable notifications

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

      // 5. Construct Success Message (Audio Only)
      finalAlertTitle = t('backupCompleteTitle');
      console.log('audioResult', audioResult);
      // Reuse restore-style message structure if available
      const copied = audioResult.count;
      const skippedErrors = audioResult.errors.length;
      const msg = t('restoreCompleteBase', {
        audioCopied: String(copied),
        audioSkippedDueToError: String(skippedErrors)
      });
      finalAlertMessage = msg;
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

  const handleRestore = () => {
    const onStart = () => {
      setIsRestoring(true);
      setSyncOperation('restore');
      setSyncProgress(0);
      setSyncTotal(1); // Default until we know the total
    };

    const onFinish = () => {
      setIsRestoring(false);
      // Set operation to null after a delay to allow seeing the final progress
      setTimeout(() => {
        setSyncOperation(null);
      }, 1500);
    };

    if (!currentUser?.id) {
      Alert.alert(t('error'), t('userNotLoggedIn'));
      return;
    }

    void selectAndInitiateRestore(
      system,
      currentUser.id,
      t,
      onStart,
      onFinish,
      handleProgress
    );
  };

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

  const drawerItems: DrawerItemType[] = [
    {
      name: t('projects'),
      view: 'projects',
      icon: HomeIcon,
      onPress: () => {
        goToProjects();
        setDrawerIsVisible(false);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ...(SHOW_NOTIFICATIONS
      ? [
          {
            name: t('notifications'),
            view: 'notifications',
            icon: BellIcon,
            onPress: () => {
              goToNotifications();
              setDrawerIsVisible(false);
            },
            notificationCount
          }
        ]
      : []),
    {
      name: t('profile'),
      view: 'profile',
      icon: UserIcon,
      onPress: () => {
        goToProfile();
        setDrawerIsVisible(false);
      }
    },
    {
      name: t('settings'),
      view: 'settings',
      icon: SettingsIcon,
      onPress: () => {
        goToSettings();
        setDrawerIsVisible(false);
      }
    }
  ] as const;

  if (Platform.OS !== 'web') {
    drawerItems.push({
      name: isBackingUp ? t('backingUp') : t('backup'),
      icon: SaveIcon,
      onPress: confirmAndStartBackup,
      disabled: !systemReady || isOperationActive
    });
    drawerItems.push({
      name: isRestoring ? t('restoring') : t('restoreBackup'),
      icon: CloudUploadIcon,
      onPress: handleRestore,
      disabled: !systemReady || isOperationActive
    });
  }

  // Add logout for development
  if (process.env.EXPO_PUBLIC_APP_VARIANT === 'development' || __DEV__) {
    drawerItems.push({
      name: t('logOut'),
      icon: LogOutIcon,
      onPress: () => {
        void signOut();
        setDrawerIsVisible(false);
      },
      disabled: !systemReady || isOperationActive
    });
  }

  return (
    <Drawer
      open={drawerIsVisible}
      onOpenChange={setDrawerIsVisible}
      dismissible={!isOperationActive}
    >
      <DrawerContent className="max-h-[90%]">
        <ScrollView className="flex-1 p-4 py-6">
          <View className="flex flex-col gap-4">
            {/* System status and progress indicators */}
            {!systemReady && (
              <View className="flex-row items-center justify-center gap-2 rounded-md bg-muted p-3 opacity-70">
                {isConnected ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      className="text-foreground"
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
              <Text className="text-center text-sm font-medium text-foreground">
                {!isConnected
                  ? `${attachmentProgress.synced} ${t('filesDownloaded')}`
                  : attachmentProgress.hasActivity
                    ? `${t('downloading')} ${attachmentProgress.downloading + attachmentProgress.queued} ${t('files')}...`
                    : powersyncStatus?.connected
                      ? powersyncStatus.dataFlowStatus.downloading
                        ? t('syncingDatabase')
                        : powersyncStatus.hasSynced
                          ? `${t('lastSync')}: ${powersyncStatus.lastSyncedAt?.toLocaleTimeString() || t('unknown')}`
                          : t('notSynced')
                      : powersyncStatus?.connecting
                        ? t('connecting')
                        : t('disconnected')}
              </Text>

              {/* Progress bar for download progress */}
              {(powersyncStatus?.downloadProgress ||
                attachmentProgress.hasActivity) && (
                <View className="flex flex-col gap-2">
                  <Progress
                    value={
                      attachmentProgress.hasActivity
                        ? attachmentProgress.total > 0
                          ? (attachmentProgress.synced /
                              attachmentProgress.total) *
                            100
                          : 0
                        : undefined
                    }
                    className="h-1 w-full"
                  />
                </View>
              )}
            </Button>

            {/* Attachment sync progress section */}
            {(showAttachmentProgress ||
              attachmentProgress.hasActivity ||
              attachmentProgress.total > 0) && (
              <Animated.View
                style={{
                  opacity: showAttachmentProgress ? fadeAnim : 1
                }}
              >
                <View
                  className={cn(
                    'rounded-md p-3',
                    attachmentProgress.hasActivity
                      ? 'bg-primary/20'
                      : 'bg-muted'
                  )}
                >
                  <View className="flex flex-col gap-2">
                    <Text
                      className={cn(
                        'text-sm text-foreground',
                        attachmentProgress.hasActivity
                          ? 'font-semibold'
                          : 'font-medium'
                      )}
                    >
                      {isInGracePeriod ? (
                        <>
                          <Text className="font-semibold text-primary">
                            {t('downloadComplete')}
                          </Text>
                          <Text className="text-sm text-foreground">
                            {' '}
                            ({attachmentProgress.synced}/
                            {attachmentProgress.total} {t('files')})
                          </Text>
                        </>
                      ) : attachmentProgress.downloading > 0 &&
                        attachmentProgress.queued > 0 ? (
                        <>
                          <Text className="text-sm text-foreground">
                            {t('downloading')}: {attachmentProgress.downloading}
                          </Text>
                          <Text className="text-sm text-foreground">, </Text>
                          <Text className="text-sm text-foreground">
                            {t('queued')}: {attachmentProgress.queued}
                          </Text>
                          <Text className="text-sm text-foreground">
                            {' '}
                            ({attachmentProgress.synced}/
                            {attachmentProgress.total} {t('complete')})
                          </Text>
                        </>
                      ) : attachmentProgress.downloading > 0 ? (
                        <>
                          <Text className="text-sm text-foreground">
                            {t('downloading')}: {attachmentProgress.downloading}{' '}
                            {t('files')}
                          </Text>
                          <Text className="text-sm text-foreground">
                            {' '}
                            ({attachmentProgress.synced}/
                            {attachmentProgress.total} {t('complete')})
                          </Text>
                        </>
                      ) : attachmentProgress.queued > 0 ? (
                        <>
                          <Text className="text-sm text-foreground">
                            {t('queuedForDownload')}:{' '}
                            {attachmentProgress.queued} {t('files')}
                          </Text>
                          <Text className="text-sm text-foreground">
                            {' '}
                            ({attachmentProgress.synced}/
                            {attachmentProgress.total} {t('complete')})
                          </Text>
                        </>
                      ) : (
                        <Text className="text-foreground">
                          {attachmentProgress.synced}/{attachmentProgress.total}{' '}
                          {t('filesDownloaded')}
                        </Text>
                      )}
                    </Text>
                    {isInGracePeriod ? (
                      <ShimmerBar />
                    ) : (
                      <Progress
                        value={
                          attachmentProgress.total > 0
                            ? (attachmentProgress.synced /
                                attachmentProgress.total) *
                              100
                            : 0
                        }
                        className="h-1"
                      />
                    )}
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
                      <Text className="flex-1 text-foreground">
                        {item.name}
                      </Text>
                      {!!item.notificationCount &&
                        item.notificationCount > 0 && (
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
        </ScrollView>
      </DrawerContent>
    </Drawer>
  );
}
