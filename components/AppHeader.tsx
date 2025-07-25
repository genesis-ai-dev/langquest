import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNotifications } from '@/hooks/useNotifications';
import { useSyncState } from '@/hooks/useSyncState';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { AttachmentState } from '@powersync/attachments';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppHeader({
  drawerToggleCallback
}: {
  drawerToggleCallback: () => void;
}) {
  const insets = useSafeAreaInsets();
  const {
    breadcrumbs,
    canGoBack: _canGoBack,
    goBack: _goBack
  } = useAppNavigation();

  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  const { totalCount: notificationCount } = useNotifications();
  const { isDownloadOperationInProgress, isUpdateInProgress, isConnecting } =
    useSyncState();

  // Get attachment states to monitor download queue
  const { attachmentStates } = useAttachmentStates([]);

  // Calculate if there are downloads in progress
  const hasDownloadsInProgress = useMemo(() => {
    if (attachmentStates.size === 0) return false;

    for (const record of attachmentStates.values()) {
      if (
        record.state === AttachmentState.QUEUED_DOWNLOAD ||
        record.state === AttachmentState.QUEUED_SYNC
      ) {
        return true;
      }
    }
    return false;
  }, [attachmentStates]);

  const isSyncing =
    isDownloadOperationInProgress ||
    isUpdateInProgress ||
    isConnecting ||
    hasDownloadsInProgress;
  const isConnected = useNetworkStatus();

  // Animation for sync indicator
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      // Start spinning animation
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true
        })
      );
      spinAnimation.start();

      return () => {
        spinAnimation.stop();
        spinValue.setValue(0);
      };
    }
  }, [isSyncing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + spacing.small }]}
    >
      <View style={styles.header}>
        {/* Back Button */}
        {/* {canGoBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )} */}

        {/* Breadcrumbs */}
        <View style={styles.breadcrumbContainer}>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isFirst = index === 0;

            return (
              <View key={index} style={styles.breadcrumbItem}>
                {!isFirst && (
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textSecondary}
                    style={styles.breadcrumbSeparator}
                  />
                )}

                <View
                  style={
                    isLast
                      ? styles.currentBreadcrumbTextContainer
                      : styles.breadcrumbTextContainer
                  }
                >
                  {crumb.onPress ? (
                    <Pressable
                      onPress={crumb.onPress}
                      onPressIn={() => setPressedIndex(index)}
                      onPressOut={() => setPressedIndex(null)}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      style={({ pressed }) => [
                        styles.breadcrumbTouchable,
                        pressed && styles.breadcrumbPressed
                      ]}
                    >
                      <Text
                        style={[
                          styles.breadcrumbLink,
                          pressedIndex === index && styles.breadcrumbTextPressed
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {crumb.label}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text
                      style={styles.breadcrumbCurrent}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {crumb.label}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Menu Button with Indicators */}
        <View style={styles.menuButtonContainer}>
          <Pressable
            onPress={drawerToggleCallback}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.menuButtonPressed
            ]}
          >
            <Ionicons name="menu" size={24} color={colors.text} />

            {/* Network Status Indicator - Bottom Right Corner */}
            {!isConnected ? (
              <View style={styles.offlineIndicator}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={10}
                  color="white"
                />
              </View>
            ) : isSyncing ? (
              <Animated.View
                style={[
                  styles.syncIndicator,
                  { transform: [{ rotate: spin }] }
                ]}
              >
                <Ionicons name="sync-outline" size={10} color="white" />
              </Animated.View>
            ) : null}

            {/* Notification Badge - Top Right Corner */}
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <View style={styles.notificationDot} />
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54 // Standard touch target
  },
  backButton: {
    marginRight: spacing.small,
    padding: spacing.xsmall
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden' // Prevent overflow
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1 // Allow items to shrink
  },
  breadcrumbTextContainer: {
    maxWidth: 80, // Short max width for previous breadcrumbs
    flexShrink: 1
  },
  currentBreadcrumbTextContainer: {
    maxWidth: 150, // Longer max width for current breadcrumb
    flexShrink: 1
  },
  breadcrumbTouchable: {
    flexShrink: 1,
    padding: 4,
    borderRadius: 4
  },
  breadcrumbPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Subtle white overlay
    transform: [{ scale: 0.98 }] // Slight scale down for tactile feedback
  },
  breadcrumbTextPressed: {
    opacity: 0.8 // Less opacity reduction
  },
  menuButtonContainer: {
    position: 'relative'
  },
  menuButton: {
    padding: spacing.xsmall,
    borderRadius: 4,
    position: 'relative'
  },
  menuButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Match breadcrumb style
    transform: [{ scale: 0.98 }]
  },
  syncIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  offlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF6B6B', // Orange-red for offline
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF4444', // Red color for notifications
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  notificationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white'
  },
  breadcrumbSeparator: {
    marginHorizontal: spacing.xsmall,
    flexShrink: 0 // Don't shrink separators
  },
  breadcrumbLink: {
    fontSize: fontSizes.medium,
    color: colors.primary,
    fontWeight: '500'
  },
  breadcrumbCurrent: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: '600'
  },
  spacer: {
    width: 32 // Balance the back button
  }
});
