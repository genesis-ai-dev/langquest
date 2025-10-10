import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { QuestSettingsModal } from '@/components/QuestSettingsModal';
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
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { asset, quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { sortAssets } from '@/utils/assetSorting';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { deduplicateByUuid } from '@/utils/uuidUtils';
import { LegendList } from '@legendapp/list';
import {
  FlagIcon,
  InfoIcon,
  Mic,
  SearchIcon,
  SettingsIcon,
  Share2
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import type { HybridDataSource } from './useHybridData';
import { useHybridData } from './useHybridData';

import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
// Recording UI moved into RecordingView component
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useChapterPublishing } from '@/hooks/useChapterPublishing';
import { useQuestPublishStatus } from '@/hooks/useQuestPublishStatus';
import { useHasUserReported } from '@/hooks/useReports';
import { AssetListItem } from './AssetListItem';
import RecordingView from './recording';

type Asset = typeof asset.$inferSelect;
type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
};

export default function NextGenAssetsView() {
  const { currentQuestId, currentProjectId } = useCurrentNavigation();
  const [debouncedSearchQuery, searchQuery, setSearchQuery] = useDebouncedState(
    '',
    300
  );
  const { t } = useLocalization();
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);

  type Quest = typeof questTable.$inferSelect;

  const { data: questData } = useHybridData<Quest>({
    dataType: 'quests',
    queryKeyParams: [currentQuestId],
    offlineQuery: currentQuestId
      ? `SELECT * FROM quest WHERE id = '${currentQuestId}'`
      : 'SELECT * FROM quest WHERE 1 = 0',
    enableOfflineQuery: Boolean(currentQuestId),
    cloudQueryFn: async (): Promise<Quest[]> => {
      if (!currentQuestId) return [] as Quest[];
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', currentQuestId)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data || [];
    },
    enableCloudQuery: !!currentQuestId,
    getItemId: (item) => item.id
  });
  const selectedQuest = questData[0];
  const [showRecording, setShowRecording] = React.useState(false);

  // Check if the quest is published (immutable if true)
  const { isPublished, hasLocalCopy } = useQuestPublishStatus(currentQuestId);

  // Publishing hook
  const { publishChapter, isPublishing } = useChapterPublishing(t);

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
    isFetching
  } = useAssetsByQuest(
    currentQuestId || '',
    debouncedSearchQuery,
    showInvisibleContent
  );

  // Flatten all pages into a single array
  const assets = React.useMemo(() => {
    const allAssets = data.pages.flatMap((page) => page.data);

    // Filter out invalid assets (e.g., cloud assets without proper data)
    const validAssets = allAssets.filter((asset) => {
      // Must have at least id and name to be valid
      return asset.id && asset.name;
    });

    // Deduplicate by UUID (handles dash formatting differences)
    // Priority: synced > local > cloud
    const dedupedAssets = deduplicateByUuid(validAssets);

    // Sort assets using unified sorting logic (order_index -> created_at -> name)
    return sortAssets(dedupedAssets);
  }, [data.pages]);

  // Watch attachment states for all assets
  const assetIds = React.useMemo(() => {
    return assets.map((asset) => asset.id);
  }, [assets]);

  const { attachmentStates, isLoading: isAttachmentStatesLoading } =
    useAttachmentStates(assetIds);

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

  // Handle publish button press
  const handlePublishPress = React.useCallback(() => {
    if (!currentQuestId) {
      console.error('No current quest id');
      return;
    }

    // Use quest name if available, otherwise generic message
    const questName = selectedQuest?.name || 'this chapter';

    Alert.alert(
      'Publish Chapter',
      `This will publish ${questName} and all its recordings to make them available to other users.\n\nIf the parent book or project haven't been published yet, they will be published automatically.\n\n⚠️ Publishing uploads your recordings to the cloud. This cannot be undone, but you can publish new versions in the future if you want to make changes.`,
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: 'Publish',
          style: 'default',
          onPress: () => {
            void (async () => {
              try {
                console.log(`📤 Publishing quest ${currentQuestId}...`);

                const result = await publishChapter(currentQuestId);

                if (result.success) {
                  // Show success message from publish service
                  Alert.alert(t('success'), result.message, [{ text: 'OK' }]);
                } else {
                  // Show errors
                  Alert.alert(
                    'Publishing Failed',
                    result.errors?.join('\n\n') || 'An unknown error occurred',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                console.error('Publish error:', error);
                Alert.alert(
                  t('error'),
                  error instanceof Error
                    ? error.message
                    : 'Failed to publish chapter',
                  [{ text: 'OK' }]
                );
              }
            })();
          }
        }
      ]
    );
  }, [currentQuestId, selectedQuest?.name, publishChapter, t]);

  if (!currentQuestId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>{t('noQuestSelected')}</Text>
      </View>
    );
  }

  // Recording mode UI
  if (showRecording) {
    return <RecordingView onBack={() => setShowRecording(false)} />;
  }

  return (
    <View className="flex flex-1 flex-col gap-6 p-6">
      <View className="flex flex-row items-center justify-between">
        <Text className="text-xl font-semibold">{t('assets')}</Text>
        <View className="flex flex-row items-center gap-2">
          {/* Show "Published" badge if quest is published */}
          {isPublished && (
            <View className="rounded-md bg-chart-5 px-3 py-1.5">
              <Text className="text-sm font-medium text-primary-foreground">
                {t('published')}
              </Text>
            </View>
          )}

          {/* Show Publish button if NOT published and has local copy */}
          {!isPublished && hasLocalCopy && (
            <Button
              variant="outline"
              size="icon"
              className="border-primary"
              onPress={handlePublishPress}
              disabled={assets.length === 0 || isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator size="small" className="text-primary" />
              ) : (
                <Icon as={Share2} className="text-muted-foreground" />
              )}
            </Button>
          )}

          {/* Show Record button only if NOT published */}
          {!isPublished && (
            <Button
              variant="outline"
              size="icon"
              className="border-primary"
              onPress={() => setShowRecording(true)}
            >
              <Icon as={Mic} className="text-muted-foreground" />
            </Button>
          )}
        </View>
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
            <ActivityIndicator size="small" className="text-primary" />
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

      {isLoading ? (
        searchQuery ? (
          <View className="flex-1 items-center justify-center pt-8">
            <ActivityIndicator size="large" className="text-primary" />
            <Text className="mt-4 text-muted-foreground">{t('searching')}</Text>
          </View>
        ) : (
          <ProjectListSkeleton />
        )
      ) : (
        <LegendList
          data={assets}
          key={assets.length}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderItem({ item })}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          estimatedItemSize={120}
          recycleItems
          contentContainerStyle={{ gap: 8 }}
          ListFooterComponent={() =>
            isFetchingNextPage ? (
              <View className="items-center py-4">
                <ActivityIndicator size="small" className="text-primary" />
              </View>
            ) : null
          }
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
                    <Text>{t('doRecord')}</Text>
                  </Button>
                )}
              </View>
            </View>
          )}
        />
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
              onPress={() => setShowDetailsModal(true)}
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
      {showDetailsModal && selectedQuest && (
        <ModalDetails
          isVisible={showDetailsModal}
          contentType="quest"
          content={selectedQuest}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
      {showReportModal && (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={currentQuestId}
          recordTable="quests"
          hasAlreadyReported={hasReported}
          creatorId={selectedQuest?.creator_id ?? undefined}
          onReportSubmitted={() => refetchReport()}
        />
      )}
    </View>
  );
}
