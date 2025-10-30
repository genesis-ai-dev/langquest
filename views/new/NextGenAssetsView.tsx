/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { QuestSettingsModal } from '@/components/QuestSettingsModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  SpeedDial,
  SpeedDialItem,
  SpeedDialItems,
  SpeedDialTrigger
} from '@/components/ui/speed-dial';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { asset } from '@/db/drizzleSchema';
import { quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import {
  useAppNavigation,
  useCurrentNavigation
} from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { LegendList } from '@legendapp/list';
import {
  CheckIcon,
  FlagIcon,
  InfoIcon,
  MicIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  Share2Icon,
  ShieldOffIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import type { HybridDataSource } from './useHybridData';
import { useHybridData } from './useHybridData';

import { AssetListSkeleton } from '@/components/AssetListSkeleton';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { QuestOffloadVerificationDrawer } from '@/components/QuestOffloadVerificationDrawer';
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useBlockedAssetsCount } from '@/hooks/useBlockedCount';
import { useQuestOffloadVerification } from '@/hooks/useQuestOffloadVerification';
import { useHasUserReported } from '@/hooks/useReports';
import { publishQuest as publishQuestUtils } from '@/utils/publishUtils';
import { offloadQuest } from '@/utils/questOffloadUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { AssetListItem } from './AssetListItem';
import RecordingViewSimplified from './recording/components/RecordingViewSimplified';

type Asset = typeof asset.$inferSelect;
type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
};

export default function NextGenAssetsView() {
  const {
    currentQuestId,
    currentProjectId,
    currentProjectData,
    currentQuestData
  } = useCurrentNavigation();
  const { goBack } = useAppNavigation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [debouncedSearchQuery, searchQuery, setSearchQuery] = useDebouncedState(
    '',
    300
  );
  const { t } = useLocalization();
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showOffloadDrawer, setShowOffloadDrawer] = React.useState(false);
  const [isOffloading, setIsOffloading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Animation for refresh button
  const spinValue = useSharedValue(0);

  React.useEffect(() => {
    if (isRefreshing) {
      spinValue.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.linear }),
        -1
      );
    } else {
      cancelAnimation(spinValue);
      spinValue.value = 0;
    }
  }, [isRefreshing, spinValue]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value * 360}deg` }]
  }));

  type Quest = typeof questTable.$inferSelect;

  // Use passed quest data if available (instant!), otherwise query
  const { data: queriedQuestData } = useHybridData({
    dataType: 'current-quest',
    queryKeyParams: [currentQuestId],
    offlineQuery: toCompilableQuery(
      system.db.query.quest.findFirst({
        where: eq(questTable.id, currentQuestId!)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', currentQuestId)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!currentQuestId,
    enableOfflineQuery: !!currentQuestId,
    getItemId: (item) => item.id
  });

  // Prefer passed data for instant rendering!
  const selectedQuest = React.useMemo(() => {
    const questData = currentQuestData
      ? [currentQuestData as Quest]
      : queriedQuestData;
    return questData?.[0];
  }, [currentQuestData, queriedQuestData]);

  const [showRecording, setShowRecording] = React.useState(false);

  // const handleRecordingComplete = React.useCallback(
  //   async (uri: string, duration: number, waveformData: number[]) => {
  //     // Fixed number of bars for visual consistency - stretch/compress recorded data to fit
  //     const DISPLAY_BARS = 48;

  //     const interpolateToFixedBars = (
  //       samples: number[],
  //       targetBars: number
  //     ): number[] => {
  //       if (samples.length === 0) {
  //         return new Array<number>(targetBars).fill(0.01);
  //       }

  //       const result: number[] = [];

  //       if (samples.length === targetBars) {
  //         // Perfect match, just clamp values
  //         return samples.map((v) => Math.max(0.01, Math.min(0.99, v)));
  //       } else if (samples.length < targetBars) {
  //         // Expand: linear interpolation to stretch recorded data across fixed bars
  //         for (let i = 0; i < targetBars; i++) {
  //           const sourceIndex = (i / (targetBars - 1)) * (samples.length - 1);
  //           const lowerIndex = Math.floor(sourceIndex);
  //           const upperIndex = Math.min(
  //             samples.length - 1,
  //             Math.ceil(sourceIndex)
  //           );
  //           const fraction = sourceIndex - lowerIndex;

  //           const lowerValue = samples[lowerIndex] ?? 0.01;
  //           const upperValue = samples[upperIndex] ?? 0.01;
  //           const interpolatedValue =
  //             lowerValue + (upperValue - lowerValue) * fraction;
  //           result.push(Math.max(0.01, Math.min(0.99, interpolatedValue)));
  //         }
  //       } else {
  //         // Compress: average bins to fit recorded data into fixed bars
  //         const binSize = samples.length / targetBars;
  //         for (let i = 0; i < targetBars; i++) {
  //           const start = Math.floor(i * binSize);
  //           const end = Math.floor((i + 1) * binSize);
  //           let sum = 0;
  //           let count = 0;
  //           for (let j = start; j < end && j < samples.length; j++) {
  //             sum += samples[j] ?? 0;
  //             count++;
  //           }
  //           const avgValue = count > 0 ? sum / count : 0.01;
  //           result.push(Math.max(0.01, Math.min(0.99, avgValue)));
  //         }
  //       }

  //       // Apply light smoothing for better visual appearance
  //       const smoothed: number[] = [...result];
  //       for (let i = 1; i < smoothed.length - 1; i++) {
  //         const prev = result[i - 1] ?? 0.01;
  //         const curr = result[i] ?? 0.01;
  //         const next = result[i + 1] ?? 0.01;
  //         // Light 3-point smoothing (80% original, 20% neighbors)
  //         smoothed[i] = curr * 0.8 + (prev + next) * 0.1;
  //       }

  //       return smoothed;
  //     };

  //     const interpolatedWaveform = interpolateToFixedBars(
  //       waveformData,
  //       DISPLAY_BARS
  //     );
  //     const newSegment: AudioSegment = {
  //       id: uuid.v4(),
  //       uri,
  //       duration,
  //       waveformData: interpolatedWaveform,
  //       name: generateAssetName(audioSegments.length + 1)
  //     };

  //     if (!currentProject) {
  //       throw new Error('Current project is required');
  //     }

  //     if (!currentQuestId) {
  //       throw new Error('Current quest ID is required');
  //     }

  //     // TODO: create a record in the asset_local table for local-only temp storage
  //     await system.db.transaction(async (tx) => {
  //       const [newAsset] = await tx
  //         .insert(resolveTable('asset', { localOverride: true }))
  //         .values({
  //           name: newSegment.name,
  //           id: newSegment.id,
  //           source_language_id: currentProject.target_language_id, // the target language is the source language for the asset
  //           creator_id: currentUser!.id,
  //           download_profiles: [currentUser!.id]
  //         })
  //         .returning();

  //       if (!newAsset) {
  //         throw new Error('Failed to insert asset');
  //       }

  //       await tx
  //         .insert(resolveTable('quest_asset_link', { localOverride: true }))
  //         .values({
  //           id: `${currentQuestId}_${newAsset.id}`,
  //           quest_id: currentQuestId,
  //           asset_id: newAsset.id,
  //           download_profiles: [currentUser!.id]
  //         });

  //       // TODO: only publish the audio to the supabase storage bucket once the user hits publish (store locally only right now)
  //       // await system.permAttachmentQueue?.saveAudio(uri);

  //       await tx
  //         .insert(resolveTable('asset_content_link', { localOverride: true }))
  //         .values({
  //           asset_id: newAsset.id,
  //           source_language_id: currentProject.target_language_id,
  //           text: newSegment.name,
  //           audio_id: newSegment.id,
  //           download_profiles: [currentUser!.id]
  //         });
  //     });

  //     // TODO: save the audio file to the device, then add to attachment queue, etc. like in a regular translation creation

  //     setAudioSegments((prev) => {
  //       const newSegments = [...prev];
  //       newSegments.splice(insertionIndex, 0, newSegment);
  //       return newSegments;
  //     });

  //     // Move insertion cursor to after the new segment
  //     setInsertionIndex((prev) => prev + 1);
  //   },
  //   [audioSegments.length, insertionIndex]
  // );

  // debounced search handled by useDebouncedState

  const { membership } = useUserPermissions(
    currentProjectId || '',
    'open_project',
    false
  );

  const isOwner = membership === 'owner';
  const isMember = membership === 'member' || membership === 'owner';

  // Initialize offload verification hook
  const verificationState = useQuestOffloadVerification(currentQuestId || '');

  // Query SQLite directly - single source of truth, no cache, no race conditions
  const isQuestDownloaded = useQuestDownloadStatusLive(currentQuestId || null);

  // Clean deeper layers
  const currentStatus = useStatusContext();
  currentStatus.layerStatus(LayerType.QUEST, currentQuestId || '');
  const showInvisibleContent = useLocalStore((s) => s.showHiddenContent);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching,
    refetch
  } = useAssetsByQuest(
    currentQuestId || '',
    debouncedSearchQuery,
    showInvisibleContent
  );

  // Flatten all pages into a single array and deduplicate
  // Prefer synced over local when the same asset ID appears in both
  const assets = React.useMemo(() => {
    const allAssets = data.pages.flatMap((page) => page.data);
    const assetMap = new Map<string, AssetQuestLink>();

    // First pass: collect all assets, preferring synced over local
    for (const asset of allAssets) {
      const existing = assetMap.get(asset.id);
      if (!existing) {
        assetMap.set(asset.id, asset);
      } else {
        // Prefer synced over local
        if (asset.source === 'synced' && existing.source !== 'synced') {
          assetMap.set(asset.id, asset);
        }
      }
    }

    return Array.from(assetMap.values());
  }, [data.pages]);

  // Watch attachment states for all assets
  const assetIds = React.useMemo(() => {
    return assets.map((asset) => asset.id);
  }, [assets]);

  const { attachmentStates, isLoading: isAttachmentStatesLoading } =
    useAttachmentStates(assetIds);

  // Count blocked assets
  const blockedCount = useBlockedAssetsCount(currentQuestId || '');

  // Get attachment state summary
  const attachmentStateSummary = React.useMemo(() => {
    if (attachmentStates.size === 0) {
      return {};
    }

    const states = Array.from(attachmentStates.values());
    const summary = states.reduce(
      (acc, attachment) => {
        acc[attachment.state] = (acc[attachment.state] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );
    return summary;
  }, [attachmentStates]);

  const renderItem = React.useCallback(
    ({ item }: { item: AssetQuestLink & { source?: HybridDataSource } }) => (
      <AssetListItem
        key={item.id}
        asset={item}
        attachmentState={attachmentStates.get(item.id)}
        questId={currentQuestId || ''}
      />
    ),
    [attachmentStates, currentQuestId]
  );

  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // footer handled inline in ListFooterComponent

  const statusText = React.useMemo(() => {
    const offlineCount = assets.filter((a) => a.source !== 'cloud').length;
    const cloudCount = assets.filter((a) => a.source === 'cloud').length;
    return `${isOnline ? '🟢' : '🔴'} Offline: ${offlineCount} | Cloud: ${isOnline ? cloudCount : 'N/A'} | Total: ${assets.length}`;
  }, [isOnline, assets]);

  const attachmentSummaryText = React.useMemo(() => {
    return Object.entries(attachmentStateSummary)
      .map(([state, count]) => {
        const stateNames = {
          '0': `⏳ ${t('queued')}`,
          '1': `🔄 ${t('syncing')}`,
          '2': `✅ ${t('synced')}`,
          '3': `❌ ${t('failed')}`,
          '4': `📥 ${t('downloading')}`
        };
        return `${stateNames[state as keyof typeof stateNames] || `${t('state')} ${state}`}: ${count}`;
      })
      .join(' | ');
  }, [attachmentStateSummary, t]);

  const {
    hasReported,
    // isLoading: isReportLoading,
    refetch: refetchReport
  } = useHasUserReported(currentQuestId || '', 'quests');

  const statusContext = useStatusContext();
  const { allowSettings } = statusContext.getStatusParams(
    LayerType.QUEST,
    currentQuestId
  );

  // Handle publish button press with useMutation
  const { mutate: publishQuest, isPending: isPublishing } = useMutation({
    mutationFn: async () => {
      if (!currentQuestId || !currentProjectId) {
        throw new Error('Missing quest or project ID');
      }
      console.log(`📤 Publishing quest ${currentQuestId}...`);
      const result = await publishQuestUtils(currentQuestId, currentProjectId);
      void refetch();
      return result;
    },
    onSuccess: (result) => {
      if (result.success) {
        Alert.alert(t('success'), result.message, [{ text: 'OK' }]);
      } else {
        Alert.alert(
          'Publishing Failed',
          result.message || 'An unknown error occurred',
          [{ text: 'OK' }]
        );
      }
    },
    onError: (error) => {
      console.error('Publish error:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : 'Failed to publish chapter',
        [{ text: 'OK' }]
      );
    }
  });

  // Handle offload button click - start verification
  const handleOffloadClick = () => {
    console.log('🗑️ [Offload] Opening verification drawer');
    setShowOffloadDrawer(true);
    verificationState.startVerification();
  };

  // Handle offload confirmation - execute offload
  const handleOffloadConfirm = async () => {
    console.log('🗑️ [Offload] User confirmed, executing offload');
    setIsOffloading(true);
    try {
      await offloadQuest({
        questId: currentQuestId || '',
        verifiedIds: verificationState.verifiedIds,
        onProgress: (progress, message) => {
          console.log(`🗑️ [Offload Progress] ${progress}%: ${message}`);
        }
      });

      console.log('🗑️ [Offload] Complete - waiting for PowerSync to sync...');
      // Wait for PowerSync to sync the removal before invalidating
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log('🗑️ [Offload] Invalidating all queries...');

      // Invalidate download status queries
      await queryClient.invalidateQueries({
        queryKey: ['download-status', 'quest', currentQuestId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['download-status', 'project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quest-download-status', currentQuestId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['project-download-status', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['download-status']
      });

      // Invalidate ALL quest queries (comprehensive like create quest)
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'infinite', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'offline', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'cloud', 'for-project', currentProjectId]
      });
      // Also invalidate generic quest queries
      await queryClient.invalidateQueries({
        queryKey: ['quests']
      });

      // Invalidate project queries
      await queryClient.invalidateQueries({
        queryKey: ['projects']
      });

      // Invalidate assets queries to refresh the assets list
      await queryClient.invalidateQueries({
        queryKey: ['assets']
      });

      // Invalidate quest closure data
      await queryClient.invalidateQueries({
        queryKey: ['quest-closure', currentQuestId]
      });

      console.log('✅ [Offload] All queries invalidated');

      Alert.alert(
        t('success'),
        t('offloadComplete') || 'Quest offloaded successfully'
      );
      setShowOffloadDrawer(false);

      // Navigate back to project directory view (quests view)
      goBack();
    } catch (error) {
      console.error('Failed to offload quest:', error);
      Alert.alert(t('error'), t('offloadError') || 'Failed to offload quest');
    } finally {
      setIsOffloading(false);
    }
  };

  if (!currentQuestId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>{t('noQuestSelected')}</Text>
      </View>
    );
  }

  // Recording mode UI
  if (showRecording) {
    // Pass existing assets as initial data for instant rendering
    return (
      <RecordingViewSimplified
        onBack={() => {
          setShowRecording(false);
          // Refetch to show newly recorded assets
          void refetch();
        }}
        initialAssets={assets}
      />
    );
  }

  // Check if quest is published (source is 'synced')
  const isPublished = selectedQuest?.source === 'synced';

  return (
    <View className="flex flex-1 flex-col gap-6 p-6">
      <View className="flex flex-row items-center justify-between">
        <View className="flex flex-row items-center gap-2">
          <Text className="text-xl font-semibold">{t('assets')}</Text>
          <Button
            variant="ghost"
            size="icon"
            disabled={isRefreshing}
            onPress={async () => {
              setIsRefreshing(true);
              console.log('🔄 Manually refreshing assets queries...');
              await queryClient.invalidateQueries({
                queryKey: ['assets']
              });
              void refetch();
              console.log('🔄 Assets queries invalidated');
              // Stop animation after a brief delay
              setTimeout(() => {
                setIsRefreshing(false);
              }, 500);
            }}
          >
            <Animated.View style={spinStyle}>
              <Icon as={RefreshCwIcon} size={18} className="text-primary" />
            </Animated.View>
          </Button>
        </View>
        {isPublished ? (
          <Badge
            variant="default"
            className="flex flex-row items-center gap-1 bg-chart-5/80"
          >
            <Icon as={CheckIcon} size={14} className="text-white" />
            <Text className="font-medium text-white">{t('published')}</Text>
          </Badge>
        ) : (
          <View className="flex flex-row items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={isPublishing || !isOnline || !isMember}
              onPress={() => {
                if (!isOnline) {
                  Alert.alert(t('error'), t('cannotPublishWhileOffline'));
                  return;
                }

                if (!isMember) {
                  Alert.alert(t('error'), t('membersOnlyPublish'));
                  return;
                }

                if (!currentQuestId) {
                  console.error('No current quest id');
                  return;
                }

                // Use quest name if available, otherwise generic message
                const questName = selectedQuest?.name || 'this chapter';

                Alert.alert(
                  t('publishChapter'),
                  t('publishChapterMessage').replace('{questName}', questName),
                  [
                    {
                      text: t('cancel'),
                      style: 'cancel'
                    },
                    {
                      text: t('publish'),
                      style: 'default',
                      onPress: () => {
                        publishQuest();
                      }
                    }
                  ]
                );
              }}
            >
              {isPublishing ? (
                <ActivityIndicator
                  size="small"
                  color={getThemeColor('primary')}
                />
              ) : (
                <Icon as={Share2Icon} />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-[1.5px] border-primary"
              onPress={() => setShowRecording(true)}
            >
              <Icon as={PencilIcon} className="text-primary" />
            </Button>
          </View>
        )}
      </View>

      <Input
        placeholder={t('searchAssets')}
        value={searchQuery}
        onChangeText={setSearchQuery}
        prefix={SearchIcon}
        prefixStyling={false}
        size="sm"
        suffix={
          isFetching && searchQuery ? (
            <ActivityIndicator size="small" color={getThemeColor('primary')} />
          ) : undefined
        }
        suffixStyling={false}
      />

      {SHOW_DEV_ELEMENTS && (
        <Text className="text-sm text-muted-foreground">{statusText}</Text>
      )}

      {SHOW_DEV_ELEMENTS &&
        !isAttachmentStatesLoading &&
        attachmentStates.size > 0 && (
          <View className="rounded-md bg-muted p-3">
            <Text className="mb-1 font-semibold">
              📎 {t('liveAttachmentStates')}:
            </Text>
            <Text className="text-muted-foreground">
              {attachmentSummaryText}
            </Text>
          </View>
        )}

      {isLoading || (isFetching && assets.length === 0) ? (
        searchQuery.trim().length > 0 ? (
          <View className="flex-1 items-center justify-center pt-8">
            <ActivityIndicator size="large" color={getThemeColor('primary')} />
            <Text className="mt-4 text-muted-foreground">{t('searching')}</Text>
          </View>
        ) : (
          <AssetListSkeleton />
        )
      ) : (
        <LegendList
          data={assets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderItem({ item })}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          estimatedItemSize={120}
          recycleItems
          contentContainerStyle={{
            gap: 8,
            paddingBottom: !isPublished ? 100 : 24
          }}
          maintainVisibleContentPosition
          ListFooterComponent={() => (
            <View className="gap-2">
              {isFetchingNextPage && (
                <View className="items-center py-4">
                  <ActivityIndicator
                    size="small"
                    color={getThemeColor('primary')}
                  />
                </View>
              )}
              {blockedCount > 0 && (
                <View className="flex-row items-center justify-center gap-2 py-4">
                  <Icon
                    as={ShieldOffIcon}
                    size={16}
                    className="text-muted-foreground"
                  />
                  <Text className="text-sm text-muted-foreground">
                    {blockedCount}{' '}
                    {blockedCount === 1 ? 'blocked item' : 'blocked items'}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-16">
              <View className="flex-col items-center gap-2">
                <Text className="text-muted-foreground">
                  {searchQuery ? 'No assets found' : 'No assets available'}
                </Text>
                {!isPublished && (
                  <Button
                    variant="default"
                    onPress={() => setShowRecording(true)}
                  >
                    <Icon as={MicIcon} className="text-secondary" />
                    <Text>{t('doRecord')}</Text>
                  </Button>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Sticky Record Button Footer */}
      {!isPublished && (
        // <View className="absolute bottom-0 left-0 right-0 z-40 border-t border-border bg-background p-6 shadow-lg">
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          onPress={() => setShowRecording(true)}
        >
          <Icon
            as={MicIcon}
            size={24}
            className="text-destructive-foreground"
          />
          <Text className="ml-2 text-lg font-semibold text-destructive-foreground">
            {t('doRecord')}
          </Text>
        </Button>
        // </View>
      )}

      <View style={{ bottom: 24, right: 24 }} className="absolute z-50">
        <SpeedDial>
          <SpeedDialItems>
            {allowSettings && isOwner ? (
              <SpeedDialItem
                icon={SettingsIcon}
                variant="outline"
                onPress={() => setShowSettingsModal(true)}
              />
            ) : !hasReported ? (
              <SpeedDialItem
                icon={FlagIcon}
                variant="outline"
                onPress={() => setShowReportModal(true)}
              />
            ) : null}
            <SpeedDialItem
              icon={InfoIcon}
              variant="outline"
              onPress={() => {
                console.log('📋 [Info] Opening details modal', {
                  selectedQuest: selectedQuest?.id,
                  isDownloaded: isQuestDownloaded,
                  storageBytes: verificationState.estimatedStorageBytes
                });
                setShowDetailsModal(true);
                // Start verification to get storage estimate if quest is downloaded
                if (isQuestDownloaded && !verificationState.isVerifying) {
                  verificationState.startVerification();
                }
              }}
            />
          </SpeedDialItems>
          <SpeedDialTrigger />
        </SpeedDial>
      </View>

      {allowSettings && isOwner && (
        <QuestSettingsModal
          isVisible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          questId={currentQuestId}
          projectId={currentProjectId || ''}
        />
      )}
      {selectedQuest && (
        <ModalDetails
          isVisible={showDetailsModal}
          contentType="quest"
          content={selectedQuest}
          onClose={() => setShowDetailsModal(false)}
          isDownloaded={isQuestDownloaded}
          estimatedStorageBytes={verificationState.estimatedStorageBytes}
          onOffloadClick={handleOffloadClick}
        />
      )}
      {showReportModal && (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={currentQuestId}
          recordTable="quest"
          hasAlreadyReported={hasReported}
          creatorId={selectedQuest?.creator_id ?? undefined}
          onReportSubmitted={() => refetchReport()}
        />
      )}

      {/* Offload Verification Drawer */}
      <QuestOffloadVerificationDrawer
        isOpen={showOffloadDrawer}
        onOpenChange={(open) => {
          if (!open && !isOffloading) {
            setShowOffloadDrawer(false);
            verificationState.cancel();
          }
        }}
        onContinue={handleOffloadConfirm}
        verificationState={verificationState}
      />
    </View>
  );
}
