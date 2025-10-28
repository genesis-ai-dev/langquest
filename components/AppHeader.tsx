import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNotifications } from '@/hooks/useNotifications';
import { useSyncState } from '@/hooks/useSyncState';
import { AttachmentState } from '@powersync/attachments';
import {
    AlertTriangle,
    ChevronRight,
    CloudOff,
    Menu,
    RefreshCw
} from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { Button } from './ui/button';

export default function AppHeader({
  drawerToggleCallback
}: {
  drawerToggleCallback: () => void;
}) {
  const {
    breadcrumbs,
    canGoBack: _canGoBack,
    goBack: _goBack
  } = useAppNavigation();

  // const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  const { t } = useLocalization();
  const { totalCount: notificationCount } = useNotifications();
  const {
    isDownloadOperationInProgress,
    isUpdateInProgress,
    isConnecting,
    downloadError,
    uploadError
  } = useSyncState();

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

  const hasSyncError = !!(downloadError || uploadError);
  // Don't show syncing state if there's an error - prevents eternal syncing loop
  const isSyncing = !hasSyncError && (
    isDownloadOperationInProgress ||
    isUpdateInProgress ||
    isConnecting ||
    hasDownloadsInProgress
  );
  const isConnected = useNetworkStatus();

  // Handler for sync error tap
  const handleSyncErrorTap = () => {
    const errorMessage =
      downloadError?.message || uploadError?.message || t('syncError');
    Alert.alert(t('syncError'), errorMessage);
  };

  // Animation for sync indicator
  const spinValue = useSharedValue(0);

  useEffect(() => {
    if (isSyncing) {
      spinValue.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.linear }),
        -1
      );
    } else {
      cancelAnimation(spinValue);
      spinValue.value = 0;
    }
  }, [isSyncing]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value * 360}deg` }]
  }));

  return (
    <View className="bg-transparent p-4">
      <View className="flex-row items-center">
        {/* Breadcrumbs */}
        <View className="flex-1 flex-row items-center overflow-hidden">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isFirst = index === 0;

            return (
              <View key={index} className="flex-shrink flex-row items-center">
                {!isFirst && (
                  <Icon
                    as={ChevronRight}
                    className="mx-1 flex-shrink-0 text-muted-foreground"
                    size={16}
                  />
                )}

                <View
                  className={`flex-shrink ${
                    isLast ? 'max-w-[150px]' : 'max-w-[80px]'
                  }`}
                >
                  {crumb.onPress ? (
                    <Pressable
                      onPress={crumb.onPress}
                      // onPressIn={() => setPressedIndex(index)}
                      // onPressOut={() => setPressedIndex(null)}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      className={`flex-shrink rounded p-1`}
                      style={({ pressed }) => [
                        {
                          backgroundColor: pressed
                            ? 'rgba(255, 255, 255, 0.15)'
                            : '',
                          opacity: pressed ? 0.8 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }]
                        }
                      ]}
                    >
                      <Text
                        className="font-medium text-primary"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {crumb.label}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text
                      className="font-semibold text-foreground"
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
        <View className="relative">
          <Button
            variant="ghost"
            size="icon"
            onPress={drawerToggleCallback}
            className="relative size-8"
          >
            <Icon as={Menu} size={24} />

            {/* Network Status Indicator - Bottom Right Corner */}
            {!isConnected ? (
              <View className="absolute bottom-0 right-0 h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 shadow-sm">
                <Icon as={CloudOff} size={10} className="text-white" />
              </View>
            ) : hasSyncError ? (
              <Pressable
                onPress={handleSyncErrorTap}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View className="absolute bottom-0 right-0 h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive shadow-sm">
                  <Icon as={AlertTriangle} size={10} className="text-white" />
                </View>
              </Pressable>
            ) : isSyncing ? (
              <Animated.View
                style={spinStyle}
                className="absolute bottom-0 right-0 h-3.5 w-3.5 items-center justify-center rounded-full bg-primary shadow-sm"
              >
                <Icon as={RefreshCw} size={10} className="text-white" />
              </Animated.View>
            ) : null}

            {/* Notification Badge - Top Right Corner */}
            {notificationCount > 0 && (
              <View className="absolute -right-0.5 -top-0.5 h-3 w-3 items-center justify-center rounded-full bg-red-500 shadow-sm">
                <View className="h-1.5 w-1.5 rounded-full bg-white" />
              </View>
            )}
          </Button>
        </View>
      </View>
    </View>
  );
}
