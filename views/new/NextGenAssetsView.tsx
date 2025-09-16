import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { QuestSettingsModal } from '@/components/QuestSettingsModal';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { asset } from '@/db/drizzleSchema';
import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { FlashList } from '@shopify/flash-list';
import { eq } from 'drizzle-orm';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useHybridData } from './useHybridData';

import AudioSegmentItem from '@/components/AudioSegmentItem';
import InsertionCursor from '@/components/InsertionCursor';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import {
  SpeedDial,
  SpeedDialItem,
  SpeedDialItems,
  SpeedDialTrigger
} from '@/components/ui/speed-dial';
import WalkieTalkieRecorder from '@/components/WalkieTalkieRecorder';
import WaveformVisualizer from '@/components/WaveformVisualizer';
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useQuestById } from '@/hooks/db/useQuests';
import { useHasUserReported } from '@/hooks/useReports';
import { FlagIcon, InfoIcon, SettingsIcon } from 'lucide-react-native';
import { AssetListItem } from './AssetListItem';

type Asset = typeof asset.$inferSelect;
type Project = typeof project.$inferSelect;
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

  const { quest } = useQuestById(currentQuestId);

  // Get project data to check if it's templated
  const { data: projectData } = useHybridData<Project>({
    dataType: 'project',
    queryKeyParams: [currentProjectId || ''],
    offlineQuery: toCompilableQuery(
      system.db.query.project.findMany({
        where: eq(project.id, currentProjectId || ''),
        limit: 1
      })
    ),
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', currentProjectId)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!currentProjectId
  });
  const currentProject = projectData[0];
  const isTemplatedProject = currentProject?.template;

  // Handlers for templated project creation
  const handleRecordingStart = React.useCallback(() => {
    setIsRecording(true);
    setCurrentWaveformData([]);
  }, []);

  const handleRecordingStop = React.useCallback(() => {
    setIsRecording(false);
    setCurrentWaveformData([]);
  }, []);

  const handleRecordingComplete = React.useCallback(
    (uri: string, duration: number, waveformData: number[]) => {
      const newSegment: AudioSegment = {
        id: `segment_${Date.now()}`,
        uri,
        duration,
        waveformData,
        name: `Segment ${audioSegments.length + 1}`
      };

      // TODO: create a record in the asset_local table for local-only temp storage
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
    (segmentId: string) => {
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

  const handlePlaySegment = React.useCallback((uri: string) => {
    // TODO: Implement audio playback
    console.log('Playing segment:', uri);
  }, []);

  // Update insertion index based on scroll position
  const handleScroll = React.useCallback(
    (event: any) => {
      // TODO: Calculate insertion index based on scroll position
      // For now, just keep it at the end
      setInsertionIndex(audioSegments.length);
    },
    [audioSegments.length]
  );

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
    ({ item }: { item: AssetQuestLink & { source?: string } }) => (
      <AssetListItem
        asset={item}
        attachmentState={attachmentStates.get(item.id)}
        questId={currentQuestId || ''}
      />
    ),
    [attachmentStates]
  );

  const keyExtractor = React.useCallback(
    (item: Asset & { source?: string }) => item.id,
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
    const offlineCount = assets.filter(
      (a) => a.source === 'localSqlite'
    ).length;
    const cloudCount = assets.filter(
      (a) => a.source === 'cloudSupabase'
    ).length;
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

  // Show templated project creation mode
  if (isTemplatedProject) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>
          Create Audio Content - {currentProject?.template}
        </Text>

        {/* Walkie Talkie Recorder */}
        <WalkieTalkieRecorder
          onRecordingComplete={handleRecordingComplete}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          isRecording={isRecording}
        />

        {/* Current recording waveform */}
        {isRecording && (
          <View style={styles.recordingContainer}>
            <Text style={styles.recordingLabel}>Recording...</Text>
            <WaveformVisualizer
              waveformData={currentWaveformData}
              isRecording={true}
              width={300}
              height={60}
            />
          </View>
        )}

        {/* Audio Segments List */}
        <View style={styles.segmentsContainer}>
          <Text style={styles.segmentsTitle}>
            Audio Segments ({audioSegments.length})
          </Text>

          <View style={styles.segmentsList}>
            {audioSegments.map((segment, index) => (
              <React.Fragment key={segment.id}>
                {/* Insertion cursor */}
                {index === insertionIndex && (
                  <InsertionCursor visible={true} position={index} />
                )}

                {/* Audio segment */}
                <AudioSegmentItem
                  segment={segment}
                  onDelete={handleDeleteSegment}
                  onMoveUp={handleMoveSegmentUp}
                  onMoveDown={handleMoveSegmentDown}
                  canMoveUp={index > 0}
                  canMoveDown={index < audioSegments.length - 1}
                  onPlay={handlePlaySegment}
                  isPlaying={playingSegmentId === segment.id}
                />
              </React.Fragment>
            ))}

            {/* Insertion cursor at the end */}
            {audioSegments.length === 0 ||
            insertionIndex === audioSegments.length ? (
              <InsertionCursor visible={true} position={audioSegments.length} />
            ) : null}
          </View>
        </View>

        {/* TODO: Add save/export functionality */}
        <View style={styles.todoContainer}>
          <Text style={styles.todoText}>
            TODO: Save audio segments to device and create assets
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={sharedStyles.container}>
      <Text style={sharedStyles.title}>{t('assets')}</Text>

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
      {showDetailsModal && quest && (
        <ModalDetails
          isVisible={showDetailsModal}
          contentType="quest"
          content={quest}
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
          creatorId={quest?.creator_id ?? undefined}
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
    marginTop: spacing.medium
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
