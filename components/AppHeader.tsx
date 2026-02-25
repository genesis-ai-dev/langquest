import { Icon } from '@/components/ui/icon';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNotifications } from '@/hooks/useNotifications';
import { useSyncState } from '@/hooks/useSyncState';
import { cn, useThemeToken } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { AttachmentState } from '@powersync/attachments';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useSegments } from 'expo-router';
import {
  AlertTriangle,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudOff,
  HelpCircleIcon,
  MenuIcon,
  RefreshCw
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { Button, OpacityPressable } from './ui/button';
import { Text } from './ui/text';

export default function AppHeader({
  drawerToggleCallback,
  isCloudLoading = false,
  onOnboardingPress
}: {
  drawerToggleCallback: () => void;
  isCloudLoading?: boolean;
  onOnboardingPress?: () => void;
}) {
  const router = useRouter();
  const segments = useSegments();
  const { goBack, breadcrumbs, currentView } = useAppNavigation();

  // Get background HSL from generated-tokens.ts (format: "240 100% 98.04%")
  const backgroundHsl = useThemeToken('background');

  // Convert HSL format to hsla() with opacity
  // Input: "240 100% 98.04%" -> Output: "hsla(240, 100%, 98.04%, opacity)"
  const createHsla = (opacity: number): string => {
    return `hsla(${backgroundHsl.replace(/\s+/g, ', ')}, ${opacity})`;
  };

  // Create opacity gradient from 0% to 100%
  const opacityGradientColors: [string, string] = [
    createHsla(0), // 0% opacity
    createHsla(1) // 100% opacity
  ];

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
  const rawIsSyncing =
    !hasSyncError &&
    (isDownloadOperationInProgress ||
      isUpdateInProgress ||
      isConnecting ||
      hasDownloadsInProgress);
  const isConnected = useNetworkStatus();

  // Debounce sync status to prevent flickering and allow animations to complete
  const [isSyncing, setIsSyncing] = useState(rawIsSyncing);

  useEffect(() => {
    if (rawIsSyncing) {
      // Immediately show syncing when it starts
      setIsSyncing(true);
    } else {
      // Delay hiding sync indicator to allow animation to complete smoothly
      const timeout = setTimeout(() => {
        setIsSyncing(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [rawIsSyncing]);

  // Handler for sync error tap
  const handleSyncErrorTap = () => {
    const errorMessage =
      downloadError?.message || uploadError?.message || t('syncError');
    RNAlert.alert(t('syncError'), errorMessage);
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
  }, [isSyncing, spinValue]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value * 360}deg` }]
  }));

  // Animation for cloud loading bar
  const loadingProgress = useSharedValue(0);
  const loadingOpacity = useSharedValue(0);

  useEffect(() => {
    if (isCloudLoading) {
      // Start loading animation
      loadingOpacity.value = withTiming(1, { duration: 200 });
      loadingProgress.value = withTiming(0.9, {
        duration: 1500,
        easing: Easing.bezier(0.4, 0, 0.2, 1)
      });
    } else {
      // Complete and fade out
      if (loadingProgress.value > 0) {
        loadingProgress.value = withTiming(1, { duration: 200 });
        loadingOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
          if (finished) {
            loadingProgress.value = 0;
          }
        });
      }
    }
  }, [isCloudLoading, loadingOpacity, loadingProgress]);

  const loadingBarStyle = useAnimatedStyle(() => ({
    width: `${loadingProgress.value * 100}%`,
    opacity: loadingOpacity.value
  }));

  return (
    <View className="relative bg-transparent p-4">
      {/* Cloud Loading Bar */}
      <Animated.View
        style={loadingBarStyle}
        className="absolute left-0 right-0 top-0 h-[2px] bg-primary shadow-sm"
      />

      <View className="flex-row items-center">
        {/* Back Button */}

        <View className="flex-1 flex-row gap-2 overflow-hidden">
          {router.canGoBack() && currentView !== 'projects' && (
            <Button variant="ghost" size="icon" onPress={goBack}>
              <Icon as={ChevronLeftIcon} className="size-6" />
            </Button>
          )}
          <View className="relative h-11 flex-1">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-col justify-center"
            >
              <Text
                className={cn(
                  'max-w-[250px] text-ellipsis font-semibold text-foreground',
                  breadcrumbs.length === 1 && 'text-lg'
                )}
                numberOfLines={1}
                // ellipsizeMode="tail"
              >
                {breadcrumbs.at(breadcrumbs.length - 1)?.label}
              </Text>
              {breadcrumbs.length > 1 && (
                <View className="flex-row items-center">
                  {breadcrumbs.slice(0, -1).map((crumb, index) => (
                    <View key={index} className="flex-row items-center">
                      {index > 0 && (
                        <View
                          className="flex items-center justify-center"
                          style={{ height: 20, width: 20 }}
                        >
                          <Icon
                            as={ChevronRightIcon}
                            className="size-4 text-muted-foreground"
                          />
                        </View>
                      )}
                      <OpacityPressable onPress={crumb.onPress} hitSlop={5}>
                        <Text className="text-sm leading-5 text-muted-foreground">
                          {crumb.label}
                        </Text>
                      </OpacityPressable>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            {/* Opacity fade overlay fixed at the right edge, overtop the ScrollView */}
            {breadcrumbs.length > 1 && (
              <LinearGradient
                colors={opacityGradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 40,
                  zIndex: 10,
                  elevation: 10
                }}
              />
            )}
          </View>
        </View>
        {/* Breadcrumbs */}
        {/* <View className="flex-1 flex-row items-center overflow-hidden">
          {Array.isArray(breadcrumbs) && breadcrumbs.length > 0
            ? breadcrumbs.slice(-3).map((crumb, index, slicedBreadcrumbs) => {
                const isLast = index === slicedBreadcrumbs.length - 1;
                const isFirst = index === 0;

                return (
                  <View
                    key={index}
                    className="flex-shrink flex-row items-center"
                  >
                    {!isFirst && (
                      <Icon
                        as={ChevronRightIcon}
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
                          hitSlop={5}
                          className="flex-shrink rounded p-1"
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
              })
            : null}
        </View> */}

        {/* Help/Onboarding Button */}
        {onOnboardingPress && (
          <Button
            variant="ghost"
            size="icon"
            onPress={onOnboardingPress}
            className="relative mr-2 size-8"
            hitSlop={10}
          >
            <Icon
              as={HelpCircleIcon}
              className="size-6 text-muted-foreground"
            />
          </Button>
        )}

        {/* Menu Button with Indicators */}
        <View className="relative">
          <Button
            variant="ghost"
            size="icon"
            onPress={drawerToggleCallback}
            className="relative"
            testID="app-drawer-menu-button"
          >
            <Icon as={MenuIcon} className="size-6 text-foreground" />

            {/* Network Status Indicator - Bottom Right Corner */}
            {!isConnected ? (
              <View className="absolute bottom-0 right-0 h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 shadow-sm">
                <Icon as={CloudOff} size={10} className="text-white" />
              </View>
            ) : hasSyncError ? (
              <Pressable onPress={handleSyncErrorTap} hitSlop={10}>
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
