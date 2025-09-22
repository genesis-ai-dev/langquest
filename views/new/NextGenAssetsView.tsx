import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { QuestSettingsModal } from '@/components/QuestSettingsModal';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import type { asset } from '@/db/drizzleSchema';
import { quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useHybridData, type HybridDataSource } from './useHybridData';

import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  SpeedDial,
  SpeedDialItem,
  SpeedDialItems,
  SpeedDialTrigger
} from '@/components/ui/speed-dial';
// Recording UI moved into RecordingView component
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useHasUserReported } from '@/hooks/useReports';
import { mergeSQL, resolveTable } from '@/utils/dbUtils';
import { eq } from 'drizzle-orm';
import { FlagIcon, InfoIcon, Mic, SettingsIcon } from 'lucide-react-native';
import uuid from 'react-native-uuid';
import { AssetListItem } from './AssetListItem';
import RecordingView from './RecordingView';

type Asset = typeof asset.$inferSelect;
type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
};

// Audio segment type for templated project creation
interface AudioSegment {
  id: string;
  uri: string;
  duration: number;
  waveformData: number[];
  name: string;
}

export default function NextGenAssetsView() {
  const { currentQuestId, currentProjectId } = useCurrentNavigation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const { t } = useLocalization();
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);

  // State for templated project creation mode
  const [audioSegments, setAudioSegments] = React.useState<AudioSegment[]>([]);
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  const [isRecording, setIsRecording] = React.useState(false);
  const [currentWaveformData, setCurrentWaveformData] = React.useState<
    number[]
  >([]);
  const [playingSegmentId, setPlayingSegmentId] = React.useState<string | null>(
    null
  );

  type Quest = typeof questTable.$inferSelect;

  const offlineSQL = React.useMemo(() => {
    if (!currentQuestId) return null;
    return mergeSQL(
      system.db.query.quest.findMany({
        where: eq(questTable.id, currentQuestId)
      })
    );
  }, [currentQuestId]);

  const { data: questData, isLoading: isQuestLoading } = useHybridData<Quest>({
    dataType: 'quests',
    queryKeyParams: [currentQuestId ?? 'none'],
    offlineQuery:
      offlineSQL ??
      mergeSQL(
        system.db.query.quest.findMany({
          where: eq(questTable.id, '__nil__')
        })
      ),
    enableOfflineQuery: Boolean(currentQuestId),
    cloudQueryFn: async (): Promise<Quest[]> => {
      if (!currentQuestId) return [] as Quest[];
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', currentQuestId)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data ?? [];
    },
    enableCloudQuery: Boolean(currentQuestId),
    getItemId: (item) => item.id
  });
  const selectedQuest = React.useMemo(() => questData?.[0], [questData]);
  const { playSound, stopCurrentSound, isPlaying, currentAudioId } = useAudio();
  const { currentUser } = useAuth();

  // Get project data to check if it's templated
  const { project: currentProject } = useProjectById(currentProjectId);
  console.log('currentProjectId', currentProjectId);
  const [showRecording, setShowRecording] = React.useState(false);

  // Handlers for templated project creation
  const handleRecordingStart = React.useCallback(() => {
    setIsRecording(true);
    // Initialize with full set of bars at 0 volume for side-scrolling
    setCurrentWaveformData(new Array(60).fill(0.01));
  }, []);

  const handleRecordingStop = React.useCallback(() => {
    setIsRecording(false);
    // Reset to full set of bars at 0 volume
    setCurrentWaveformData(new Array(60).fill(0.01));
  }, []);

  const handleWaveformUpdate = React.useCallback((waveformData: number[]) => {
    setCurrentWaveformData(waveformData);
  }, []);

  const handleRecordingComplete = React.useCallback(
    async (uri: string, duration: number, waveformData: number[]) => {
      // Fixed number of bars for visual consistency - stretch/compress recorded data to fit
      const DISPLAY_BARS = 48;

      const interpolateToFixedBars = (
        samples: number[],
        targetBars: number
      ): number[] => {
        if (samples.length === 0) {
          return new Array<number>(targetBars).fill(0.01);
        }

        const result: number[] = [];

        if (samples.length === targetBars) {
          // Perfect match, just clamp values
          return samples.map((v) => Math.max(0.01, Math.min(0.99, v)));
        } else if (samples.length < targetBars) {
          // Expand: linear interpolation to stretch recorded data across fixed bars
          for (let i = 0; i < targetBars; i++) {
            const sourceIndex = (i / (targetBars - 1)) * (samples.length - 1);
            const lowerIndex = Math.floor(sourceIndex);
            const upperIndex = Math.min(
              samples.length - 1,
              Math.ceil(sourceIndex)
            );
            const fraction = sourceIndex - lowerIndex;

            const lowerValue = samples[lowerIndex] ?? 0.01;
            const upperValue = samples[upperIndex] ?? 0.01;
            const interpolatedValue =
              lowerValue + (upperValue - lowerValue) * fraction;
            result.push(Math.max(0.01, Math.min(0.99, interpolatedValue)));
          }
        } else {
          // Compress: average bins to fit recorded data into fixed bars
          const binSize = samples.length / targetBars;
          for (let i = 0; i < targetBars; i++) {
            const start = Math.floor(i * binSize);
            const end = Math.floor((i + 1) * binSize);
            let sum = 0;
            let count = 0;
            for (let j = start; j < end && j < samples.length; j++) {
              sum += samples[j] ?? 0;
              count++;
            }
            const avgValue = count > 0 ? sum / count : 0.01;
            result.push(Math.max(0.01, Math.min(0.99, avgValue)));
          }
        }

        // Apply light smoothing for better visual appearance
        const smoothed: number[] = [...result];
        for (let i = 1; i < smoothed.length - 1; i++) {
          const prev = result[i - 1] ?? 0.01;
          const curr = result[i] ?? 0.01;
          const next = result[i + 1] ?? 0.01;
          // Light 3-point smoothing (80% original, 20% neighbors)
          smoothed[i] = curr * 0.8 + (prev + next) * 0.1;
        }

        return smoothed;
      };

      const interpolatedWaveform = interpolateToFixedBars(
        waveformData,
        DISPLAY_BARS
      );
      const newSegment: AudioSegment = {
        id: uuid.v4(),
        uri,
        duration,
        waveformData: interpolatedWaveform,
        name: `Segment ${audioSegments.length + 1}`
      };

      if (!currentProject) {
        throw new Error('Current project is required');
      }

      if (!currentQuestId) {
        throw new Error('Current quest ID is required');
      }

      // TODO: create a record in the asset_local table for local-only temp storage
      await system.db.transaction(async (tx) => {
        const [newAsset] = await tx
          .insert(resolveTable('asset', { localOverride: true }))
          .values({
            name: newSegment.name,
            id: newSegment.id,
            source_language_id: currentProject.target_language_id, // the target language is the source language for the asset
            creator_id: currentUser!.id,
            download_profiles: [currentUser!.id]
          })
          .returning();

        if (!newAsset) {
          throw new Error('Failed to insert asset');
        }

        await tx
          .insert(resolveTable('quest_asset_link', { localOverride: true }))
          .values({
            id: `${currentQuestId}_${newAsset.id}`,
            quest_id: currentQuestId,
            asset_id: newAsset.id,
            download_profiles: [currentUser!.id]
          });

        // TODO: only publish the audio to the supabase storage bucket once the user hits publish (store locally only right now)
        // await system.permAttachmentQueue?.saveAudio(uri);

        await tx
          .insert(resolveTable('asset_content_link', { localOverride: true }))
          .values({
            asset_id: newAsset.id,
            source_language_id: currentProject.target_language_id,
            text: newSegment.name,
            audio_id: newSegment.id,
            download_profiles: [currentUser!.id]
          });
      });

      // TODO: save the audio file to the device, then add to attachment queue, etc. like in a regular translation creation

      setAudioSegments((prev) => {
        const newSegments = [...prev];
        newSegments.splice(insertionIndex, 0, newSegment);
        return newSegments;
      });

      // Move insertion cursor to after the new segment
      setInsertionIndex((prev) => prev + 1);
    },
    [audioSegments.length, insertionIndex]
  );

  const handleDeleteSegment = React.useCallback(
    async (segmentId: string) => {
      setAudioSegments((prev) => {
        const newSegments = prev.filter((segment) => segment.id !== segmentId);
        // Adjust insertion index if needed
        const deletedIndex = prev.findIndex(
          (segment) => segment.id === segmentId
        );
        if (deletedIndex < insertionIndex) {
          setInsertionIndex((prev) => Math.max(0, prev - 1));
        }
        return newSegments;
      });

      await audioSegmentService.deleteAudioSegment(segmentId);
    },
    [insertionIndex]
  );

  const handleMoveSegmentUp = React.useCallback((segmentId: string) => {
    setAudioSegments((prev) => {
      const newSegments = [...prev];
      const currentIndex = newSegments.findIndex(
        (segment) => segment.id === segmentId
      );
      if (currentIndex > 0) {
        const currentSegment = newSegments[currentIndex];
        const previousSegment = newSegments[currentIndex - 1];
        if (currentSegment && previousSegment) {
          newSegments[currentIndex] = previousSegment;
          newSegments[currentIndex - 1] = currentSegment;
        }
      }
      return newSegments;
    });
  }, []);

  const handleMoveSegmentDown = React.useCallback((segmentId: string) => {
    setAudioSegments((prev) => {
      const newSegments = [...prev];
      const currentIndex = newSegments.findIndex(
        (segment) => segment.id === segmentId
      );
      if (currentIndex < newSegments.length - 1) {
        const currentSegment = newSegments[currentIndex];
        const nextSegment = newSegments[currentIndex + 1];
        if (currentSegment && nextSegment) {
          newSegments[currentIndex] = nextSegment;
          newSegments[currentIndex + 1] = currentSegment;
        }
      }
      return newSegments;
    });
  }, []);

  const handlePlaySegment = React.useCallback(
    async (uri: string, segmentId: string) => {
      try {
        const isThisSegmentPlaying = isPlaying && currentAudioId === segmentId;

        if (isThisSegmentPlaying) {
          await stopCurrentSound();
          setPlayingSegmentId(null);
        } else {
          await playSound(uri, segmentId);
          setPlayingSegmentId(segmentId);
        }
      } catch (error) {
        console.error('Failed to play audio segment:', error);
      }
    },
    [isPlaying, currentAudioId, playSound, stopCurrentSound]
  );

  const handleSaveSegments = React.useCallback(async () => {
    if (
      !currentUser ||
      !currentQuestId ||
      !currentProject?.target_language_id ||
      audioSegments.length === 0
    ) {
      console.warn('Cannot save segments: missing required data');
      return;
    }

    try {
      console.log('Saving audio segments to device and creating assets...');

      const result = await audioSegmentService.saveAudioSegments(
        audioSegments,
        currentQuestId,
        currentProject.target_language_id,
        currentUser.id
      );

      console.log(
        `Successfully saved ${result.assetIds.length} audio segments as assets`
      );

      // Clear the segments from memory after successful save
      setAudioSegments([]);
      setInsertionIndex(0);

      // TODO: Show success message to user
      // TODO: Refresh the assets list to show the new assets
    } catch (error) {
      console.error('Failed to save audio segments:', error);
      // TODO: Show error message to user
    }
  }, [currentUser, currentQuestId, currentProject, audioSegments]);

  // Update insertion index based on scroll position
  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const scrollY = contentOffset.y;
      const itemHeight = 100; // Approximate height of each audio segment item
      const headerHeight = 60; // Height of the segments title

      // Calculate which item the scroll position is closest to
      const adjustedScrollY = Math.max(0, scrollY - headerHeight);
      const itemIndex = Math.floor(adjustedScrollY / itemHeight);

      // Clamp the insertion index to valid range
      const newInsertionIndex = Math.max(
        0,
        Math.min(audioSegments.length, itemIndex)
      );
      setInsertionIndex(newInsertionIndex);
    },
    [audioSegments.length]
  );

  // Clear playing segment when audio stops
  React.useEffect(() => {
    if (!isPlaying) {
      setPlayingSegmentId(null);
    }
  }, [isPlaying]);

  // Debounce the search query
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const { membership } = useUserPermissions(
    currentProjectId || '',
    'open_project',
    false
  );

  const isOwner = membership === 'owner';

  // Clean deeper layers
  const currentStatus = useStatusContext();
  currentStatus.layerStatus(LayerType.QUEST);
  const { showInvisibleContent } = currentStatus;

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

    // Sort assets by name in natural alphanumerical order
    return validAssets.sort((a, b) => {
      // Use localeCompare with numeric option for natural sorting
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
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
        asset={item}
        attachmentState={attachmentStates.get(item.id)}
        questId={currentQuestId || ''}
      />
    ),
    [attachmentStates]
  );

  const keyExtractor = React.useCallback(
    (item: Asset & { source?: HybridDataSource }) => item.id,
    []
  );

  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = React.useCallback(() => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

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

  // Speed dial items are composed inline below

  if (isLoading && !searchQuery) {
    return <ProjectListSkeleton />;
  }

  if (!currentQuestId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>{t('noQuestSelected')}</Text>
      </View>
    );
  }

  // Recording mode UI
  if (showRecording) {
    return <RecordingView onBack={() => setShowRecording(false)} />;
  }

  return (
    <View style={sharedStyles.container}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Text style={sharedStyles.title}>{t('assets')}</Text>
        <Button
          variant="outline"
          size="icon"
          className="border-primary"
          onPress={() => setShowRecording(true)}
        >
          <Icon as={Mic} className="muted" />
        </Button>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchAssets')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textSecondary}
        />
        <View style={styles.searchIconContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
        </View>
        {/* Show loading indicator in search bar when searching */}
        {isFetching && searchQuery && (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>

      {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
      {SHOW_DEV_ELEMENTS && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSizes.small,
            marginBottom: spacing.small
          }}
        >
          {statusText}
        </Text>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
      {SHOW_DEV_ELEMENTS &&
        !isAttachmentStatesLoading &&
        attachmentStates.size > 0 && (
          <View style={styles.attachmentSummary}>
            <Text style={styles.attachmentSummaryTitle}>
              📎 {t('liveAttachmentStates')}:
            </Text>
            <Text style={styles.attachmentSummaryText}>
              {attachmentSummaryText}
            </Text>
          </View>
        )}

      {/* Show skeleton only on initial load, not during search */}
      {isLoading && searchQuery ? (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.searchingText}>{t('searching')}</Text>
        </View>
      ) : (
        <View style={[{ flex: 1, marginBottom: spacing.xlarge }]}>
          <FlashList
            data={assets}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No assets found' : 'No assets available'}
                </Text>
              </View>
            }
          />
        </View>
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

export const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: spacing.small
  },
  listItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    marginBottom: spacing.small,
    gap: spacing.xsmall
  },
  assetName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  assetInfo: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  attachmentSummary: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.small,
    marginTop: spacing.small,
    marginBottom: spacing.small
  },
  attachmentSummaryTitle: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.xsmall
  },
  attachmentSummaryText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  loadingFooter: {
    paddingVertical: spacing.medium,
    alignItems: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
    position: 'relative'
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    paddingLeft: 40, // Make room for search icon
    color: colors.text,
    fontSize: fontSizes.medium
  },
  searchIconContainer: {
    position: 'absolute',
    left: spacing.small,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30
  },
  searchLoadingContainer: {
    position: 'absolute',
    right: spacing.small,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30
  },
  searchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xlarge
  },
  searchingText: {
    marginTop: spacing.medium,
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xlarge
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  // Templated project creation styles
  recordingContainer: {
    alignItems: 'center',
    marginVertical: spacing.medium,
    padding: spacing.medium,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginHorizontal: spacing.small
  },
  recordingLabel: {
    fontSize: fontSizes.medium,
    color: colors.error,
    fontWeight: 'bold',
    marginBottom: spacing.small
  },
  segmentsContainer: {
    flex: 1,
    marginTop: spacing.medium,
    paddingBottom: 120 // Space for the fixed recorder at bottom
  },
  segmentsTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium,
    paddingHorizontal: spacing.small
  },
  segmentsList: {
    flex: 1
  },
  todoContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    margin: spacing.small,
    borderWidth: 1,
    borderColor: colors.error,
    borderStyle: 'dashed'
  },
  todoText: {
    fontSize: fontSizes.small,
    color: colors.error,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  recorderContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.inputBorder,
    paddingTop: spacing.medium,
    paddingBottom: spacing.large,
    paddingHorizontal: spacing.medium
  },
  saveContainer: {
    padding: spacing.medium,
    backgroundColor: colors.inputBackground,
    margin: spacing.small,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary
  },
  saveButton: {
    // Button component handles most styling
  },
  saveButtonText: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.background
  }
  // floatingButton: {
  //   backgroundColor: colors.primary,
  //   borderRadius: 28,
  //   width: 56,
  //   height: 56,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.25,
  //   shadowRadius: 3.84,
  //   elevation: 5
  // },
  // floatingButtonContainer: {
  //   width: '100%',
  //   position: 'absolute',
  //   bottom: spacing.large,
  //   right: spacing.large,
  //   gap: spacing.small,
  //   display: 'flex',
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center'
  // },
  // floatingButtonRow: {
  //   flexDirection: 'row',
  //   gap: spacing.small
  // },
  // secondaryFloatingButton: {
  //   backgroundColor: colors.inputBackground
  // },
  // settingsFloatingButton: {
  //   backgroundColor: colors.backgroundSecondary,
  //   borderWidth: 1,
  //   borderColor: colors.inputBorder
  // }
});
