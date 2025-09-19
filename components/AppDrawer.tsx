import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocalStore } from '@/store/localStore';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import {
  backupUnsyncedAudio,
  prepareBackupPaths,
  requestBackupDirectory
} from '@/utils/backupUtils';
import { useRenderCounter } from '@/utils/performanceUtils';
import { selectAndInitiateRestore } from '@/utils/restoreUtils';
import { Ionicons } from '@expo/vector-icons';
import { AttachmentState } from '@powersync/attachments';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DimensionValue, ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface DrawerItemType {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  notificationCount?: number;
  disabled?: boolean;
}

// Custom progress bar component to replace ProgressBarAndroid
interface CustomProgressBarProps {
  progress?: number;
  indeterminate?: boolean;
  color?: string;
  style?: ViewStyle;
}

const CustomProgressBar: React.FC<CustomProgressBarProps> = ({
  progress = 0,
  indeterminate = false,
  color = colors.primary,
  style
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (indeterminate) {
      // Create an indeterminate animation
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false
          })
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      // Animate to the progress value
      Animated.timing(animatedValue, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false
      }).start();
    }
  }, [progress, indeterminate, animatedValue]);

  const progressWidth = indeterminate
    ? animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['20%', '80%']
      })
    : animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%']
      });

  const translateX = indeterminate
    ? animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-50, 50]
      })
    : 0;

  return (
    <View style={[customProgressBarStyles.container, style]}>
      <View style={customProgressBarStyles.track}>
        <Animated.View
          style={[
            customProgressBarStyles.fill,
            {
              width: progressWidth,
              backgroundColor: color,
              transform: indeterminate ? [{ translateX }] : []
            }
          ]}
        />
      </View>
    </View>
  );
};

const customProgressBarStyles = StyleSheet.create({
  container: {
    height: 4,
    width: '100%'
  },
  track: {
    flex: 1,
    backgroundColor: colors.disabled,
    borderRadius: 2,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 2
  }
});

// Shimmer component for grace period
const ShimmerBar: React.FC<{ width?: DimensionValue }> = ({
  width = '100%'
}) => {
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(100); // Default width

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
      style={[styles.shimmerContainer, { width }]}
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      <Animated.View
        style={[
          styles.shimmerBar,
          {
            transform: [{ translateX: shimmerTranslate }]
          }
        ]}
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
      let msg = t('restoreCompleteBase', {
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
  const progressPercentage = syncTotal > 0 ? syncProgress / syncTotal : 0;
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
      icon: 'home',
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
            icon: 'notifications' as keyof typeof Ionicons.glyphMap,
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
      icon: 'person',
      onPress: () => {
        goToProfile();
        setDrawerIsVisible(false);
      }
    },
    {
      name: t('settings'),
      icon: 'settings',
      onPress: () => {
        goToSettings();
        setDrawerIsVisible(false);
      }
    }
  ] as const;

  if (Platform.OS !== 'web') {
    drawerItems.push({
      name: isBackingUp ? t('backingUp') : t('backup'),
      icon: isBackingUp ? 'hourglass-outline' : 'save',
      onPress: confirmAndStartBackup,
      disabled: !systemReady || isOperationActive
    });
    drawerItems.push({
      name: isRestoring ? t('restoring') : t('restoreBackup'),
      icon: isRestoring ? 'hourglass-outline' : 'cloud-upload-outline',
      onPress: handleRestore,
      disabled: !systemReady || isOperationActive
    });
  }

  // Add logout for development
  if (process.env.EXPO_PUBLIC_APP_VARIANT === 'development' || __DEV__) {
    drawerItems.push({
      name: t('logOut'),
      icon: 'log-out',
      onPress: () => {
        void signOut();
        closeDrawer();
      },
      disabled: !systemReady || isOperationActive
    });
  }

  const closeDrawer = () => {
    setDrawerIsVisible(false);
  };

  return (
    <>
      {/* Drawer Modal */}
      <Modal
        visible={drawerIsVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDrawer}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={closeDrawer}
          />

          <View
            style={[
              styles.drawerContainer,
              { backgroundColor: colors.background }
            ]}
          >
            <View
              style={[
                styles.drawerHeader,
                { backgroundColor: colors.background }
              ]}
            >
              <Text style={styles.drawerTitle}>{t('menu')}</Text>
              <TouchableOpacity
                onPress={closeDrawer}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={[
                styles.drawerContent,
                { backgroundColor: colors.background }
              ]}
            >
              {/* System status and progress indicators */}
              {!systemReady && (
                <View
                  style={[
                    styles.initializingIndicator,
                    { backgroundColor: colors.background }
                  ]}
                >
                  {isConnected ? (
                    <>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={styles.initializingText}>
                        {t('initializing')}...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="cloud-offline-outline"
                        size={16}
                        color={colors.text}
                      />
                      <Text style={styles.initializingText}>
                        {t('offline')}
                      </Text>
                    </>
                  )}
                </View>
              )}
              {/* File sync progress indicator */}
              {syncOperation && (
                <View style={styles.syncProgressContainer}>
                  <Text style={styles.syncProgressText}>
                    {syncOperation === 'backup'
                      ? t('backingUp')
                      : t('restoring')}
                  </Text>
                  <CustomProgressBar
                    indeterminate={syncTotal === 0}
                    progress={progressPercentage}
                    color={colors.primary}
                    style={styles.progressBar}
                  />
                  <Text style={styles.syncProgressText}>
                    {getProgressText()}
                  </Text>
                </View>
              )}

              {/* PowerSync status section */}
              <TouchableOpacity
                style={styles.stalePercentageContainer}
                onPress={logPowerSyncStatus}
              >
                <Text style={styles.stalePercentageText}>
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
                  <CustomProgressBar
                    indeterminate={
                      powersyncStatus?.downloadProgress ? true : false
                    }
                    progress={
                      attachmentProgress.hasActivity
                        ? attachmentProgress.total > 0
                          ? attachmentProgress.synced / attachmentProgress.total
                          : 0
                        : 0
                    }
                    color={colors.primary}
                    style={styles.syncStatusProgressBar}
                  />
                )}
              </TouchableOpacity>

              {/* Attachment sync progress section - always show when there are attachments */}
              {(showAttachmentProgress ||
                attachmentProgress.hasActivity ||
                attachmentProgress.total > 0) && (
                <Animated.View
                  style={[
                    styles.attachmentSyncContainer,
                    {
                      opacity: showAttachmentProgress ? fadeAnim : 1,
                      backgroundColor: attachmentProgress.hasActivity
                        ? colors.primaryLight + '20'
                        : colors.backgroundSecondary
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.attachmentSyncText,
                      {
                        fontWeight: attachmentProgress.hasActivity
                          ? '600'
                          : '500'
                      }
                    ]}
                  >
                    {isInGracePeriod ? (
                      <>
                        <Text style={styles.completedText}>
                          {t('downloadComplete')}
                        </Text>
                        <Text style={styles.progressText}>
                          {' '}
                          ({attachmentProgress.synced}/
                          {attachmentProgress.total} {t('files')})
                        </Text>
                      </>
                    ) : attachmentProgress.downloading > 0 &&
                      attachmentProgress.queued > 0 ? (
                      <>
                        <Text style={styles.downloadingText}>
                          {t('downloading')}: {attachmentProgress.downloading}
                        </Text>
                        <Text style={styles.separatorText}>, </Text>
                        <Text style={styles.queuedText}>
                          {t('queued')}: {attachmentProgress.queued}
                        </Text>
                        <Text style={styles.progressText}>
                          {' '}
                          ({attachmentProgress.synced}/
                          {attachmentProgress.total} {t('complete')})
                        </Text>
                      </>
                    ) : attachmentProgress.downloading > 0 ? (
                      <>
                        <Text style={styles.downloadingText}>
                          {t('downloading')}: {attachmentProgress.downloading}{' '}
                          {t('files')}
                        </Text>
                        <Text style={styles.progressText}>
                          {' '}
                          ({attachmentProgress.synced}/
                          {attachmentProgress.total} {t('complete')})
                        </Text>
                      </>
                    ) : attachmentProgress.queued > 0 ? (
                      <>
                        <Text style={styles.queuedText}>
                          {t('queuedForDownload')}: {attachmentProgress.queued}{' '}
                          {t('files')}
                        </Text>
                        <Text style={styles.progressText}>
                          {' '}
                          ({attachmentProgress.synced}/
                          {attachmentProgress.total} {t('complete')})
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.progressText}>
                          {attachmentProgress.synced}/{attachmentProgress.total}{' '}
                          {t('filesDownloaded')}
                        </Text>
                      </>
                    )}
                  </Text>
                  {isInGracePeriod ? (
                    <ShimmerBar />
                  ) : (
                    <CustomProgressBar
                      indeterminate={
                        attachmentProgress.hasActivity &&
                        attachmentProgress.total === 0
                      }
                      progress={
                        attachmentProgress.total > 0
                          ? attachmentProgress.synced / attachmentProgress.total
                          : 0
                      }
                      color={
                        attachmentProgress.hasActivity
                          ? colors.primary
                          : colors.primaryLight
                      }
                      style={styles.attachmentProgressBar}
                    />
                  )}
                </Animated.View>
              )}
              {/* Main drawer items */}
              <View style={styles.drawerItems}>
                {drawerItems.map((item, index) => {
                  const isActive =
                    currentView === 'projects' &&
                    item.name.toLowerCase() === t('projects').toLowerCase();

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.drawerItem,
                        isActive && styles.drawerItemActive,
                        item.disabled && styles.drawerItemDisabled
                      ]}
                      onPress={item.onPress}
                      disabled={item.disabled}
                    >
                      <View style={styles.drawerItemContent}>
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={colors.text}
                        />
                        <Text style={styles.drawerItemText}>{item.name}</Text>
                        {item.notificationCount
                          ? item.notificationCount > 0 && (
                              <View style={styles.notificationBadge}>
                                <Text style={styles.notificationText}>
                                  {item.notificationCount > 99
                                    ? '99+'
                                    : item.notificationCount}
                                </Text>
                              </View>
                            )
                          : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  drawerToggle: {
    position: 'absolute',
    top: spacing.medium,
    left: spacing.medium,
    zIndex: 1000,
    padding: spacing.small,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  overlayTouchable: {
    flex: 1
  },
  drawerContainer: {
    backgroundColor: colors.inputBackground,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    maxHeight: '90%'
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.textSecondary
  },
  drawerTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text
  },
  drawerContent: {
    padding: spacing.medium
  },
  drawerCategory: {
    padding: spacing.small,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    color: colors.text,
    marginVertical: spacing.small,
    overflow: 'hidden'
  },
  drawerCategoryTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '500',
    color: colors.text
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xsmall
  },
  categoryContent: {
    overflow: 'hidden'
  },
  categoryItem: {
    paddingVertical: 5
  },
  categoryItemText: {
    color: colors.text
  },
  drawerItems: {
    gap: spacing.small,
    marginTop: spacing.medium
  },
  drawerItem: {
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.medium,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.small,
    backgroundColor: colors.backgroundSecondary
  },
  drawerItemActive: {
    backgroundColor: colors.primary + '20' // 20% opacity
  },
  drawerItemDisabled: {
    opacity: 0.5
  },
  drawerItemContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  drawerItemText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginLeft: spacing.medium,
    flex: 1
  },
  notificationBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6
  },
  notificationText: {
    fontSize: fontSizes.xsmall,
    color: '#FFFFFF',
    fontWeight: '600'
  },
  initializingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.medium,
    gap: spacing.small,
    opacity: 0.7
  },
  initializingText: {
    color: colors.text,
    fontSize: fontSizes.small
  },
  // New styles for progress indicator
  syncProgressContainer: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.small,
    borderRadius: borderRadius.small,
    marginBottom: spacing.small
  },
  progressBar: {
    height: 8,
    width: '100%',
    marginVertical: spacing.xsmall
  },
  syncProgressText: {
    fontSize: fontSizes.small,
    color: colors.text,
    textAlign: 'center'
  },
  stalePercentageContainer: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.small,
    borderRadius: borderRadius.small,
    alignItems: 'center',
    marginBottom: spacing.small
  },
  stalePercentageText: {
    fontSize: fontSizes.small,
    color: colors.text,
    fontWeight: '500'
  },
  syncStatusProgressBar: {
    height: 4,
    width: '100%',
    marginTop: spacing.xsmall
  },
  attachmentSyncContainer: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.small,
    borderRadius: borderRadius.small,
    marginBottom: spacing.small
  },
  attachmentSyncText: {
    fontSize: fontSizes.small,
    color: colors.text,
    fontWeight: '500',
    marginBottom: spacing.xsmall
  },
  attachmentProgressBar: {
    height: 4,
    width: '100%',
    marginTop: spacing.xsmall
  },
  downloadingText: {
    color: colors.text,
    fontSize: fontSizes.small
  },
  separatorText: {
    color: colors.text,
    fontSize: fontSizes.small
  },
  queuedText: {
    color: colors.text,
    fontSize: fontSizes.small
  },
  progressText: {
    color: colors.text,
    fontSize: fontSizes.small
  },
  completedText: {
    color: colors.primary,
    fontSize: fontSizes.small,
    fontWeight: '600'
  },
  // Shimmer effect styles
  shimmerContainer: {
    height: 4,
    backgroundColor: colors.disabled,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.xsmall
  },
  shimmerBar: {
    height: '100%',
    width: '50%',
    backgroundColor: colors.primaryLight,
    borderRadius: 2,
    opacity: 0.6
  }
});
