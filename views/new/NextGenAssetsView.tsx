/* eslint-disable @typescript-eslint/no-unnecessary-condition */
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
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { asset } from '@/db/drizzleSchema';
import { project, quest as questTable } from '@/db/drizzleSchema';
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
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import RNAlert from '@blazejkustra/react-native-alert';
import { LegendList } from '@legendapp/list';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HybridDataSource } from './useHybridData';
import { useHybridData } from './useHybridData';

import { AssetListSkeleton } from '@/components/AssetListSkeleton';
import { ExportButton } from '@/components/ExportButton';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { QuestOffloadVerificationDrawer } from '@/components/QuestOffloadVerificationDrawer';
import { AppConfig } from '@/db/supabase/AppConfig';
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useBlockedAssetsCount } from '@/hooks/useBlockedCount';
import { useQuestOffloadVerification } from '@/hooks/useQuestOffloadVerification';
import { useHasUserReported } from '@/hooks/useReports';
import { resolveTable } from '@/utils/dbUtils';
import { fileExists, getLocalAttachmentUriWithOPFS } from '@/utils/fileUtils';
import { publishQuest as publishQuestUtils } from '@/utils/publishUtils';
import { offloadQuest } from '@/utils/questOffloadUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { AssetListItem } from './AssetListItem';
import RecordingViewSimplified from './recording/components/RecordingViewSimplified';
import { useSelectionMode } from './recording/hooks/useSelectionMode';

type Asset = typeof asset.$inferSelect;
type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
  tag_ids?: string[] | undefined;
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
  const audioContext = useAudio();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // Selection mode for visual highlight (playAll start point)
  const { selectedAssetIds, enterSelection, cancelSelection } =
    useSelectionMode();

  const [debouncedSearchQuery, searchQuery, setSearchQuery] = useDebouncedState(
    '',
    300
  );
  const { t } = useLocalization();
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showOffloadDrawer, setShowOffloadDrawer] = React.useState(false);
  const [showPrivateAccessModal, setShowPrivateAccessModal] =
    React.useState(false);
  const [isOffloading, setIsOffloading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  // Track which asset is currently playing during play-all
  const [currentlyPlayingAssetId, setCurrentlyPlayingAssetId] = React.useState<
    string | null
  >(null);
  // const assetUriMapRef = React.useRef<Map<string, string>>(new Map()); // URI -> assetId
  // const assetOrderRef = React.useRef<string[]>([]); // Ordered list of asset IDs
  // const uriOrderRef = React.useRef<string[]>([]); // Ordered list of URIs matching assetOrderRef
  // const segmentDurationsRef = React.useRef<number[]>([]); // Duration of each URI segment in ms

  // New PlayAll state (starts from selected asset)
  const [isPlayAllRunning, setIsPlayAllRunning] = React.useState(false);
  const isPlayAllRunningRef = React.useRef(false);
  const currentPlayAllSoundRef = React.useRef<AudioPlayer | null>(null);
  const timeoutIdsRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );

  const currentPlayingAssetIdRef = React.useRef<string | null>(null);

  // Ref to hold latest audioContext for cleanup (avoids stale closure)
  const audioContextRef = React.useRef(audioContext);
  React.useEffect(() => {
    audioContextRef.current = audioContext;
  }, [audioContext]);

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
  const { data: queriedQuestData, refetch: refetchQuest } = useHybridData({
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

  // Prefer queried data (fresh) over navigation data (may be stale)
  // This ensures UI updates immediately after publishing without needing to navigate away
  const selectedQuest = React.useMemo(() => {
    // If we have queried data, prefer it (it's fresh from refetch)
    // Otherwise fall back to currentQuestData for instant initial rendering
    const questData =
      queriedQuestData && queriedQuestData.length > 0
        ? queriedQuestData
        : currentQuestData
          ? [currentQuestData as Quest]
          : undefined;
    return questData?.[0];
  }, [currentQuestData, queriedQuestData]);

  // Check if quest is published (source is 'synced') - computed early for use in callbacks
  const isPublished = selectedQuest?.source === 'synced';

  // Handle single selection (for playAll start point) - always single selection
  const handleToggleSelect = React.useCallback(
    (assetId: string) => {
      // Single selection: if already selected, deselect. Otherwise, select only this one.
      if (selectedAssetIds.has(assetId)) {
        cancelSelection();
      } else {
        // Select only this one (enterSelection clears previous and sets new)
        enterSelection(assetId);
      }
    },
    [selectedAssetIds, cancelSelection, enterSelection]
  );

  // Query project data to get privacy status if not passed
  const { data: queriedProjectData } = useHybridData({
    dataType: 'project-privacy-assets',
    queryKeyParams: [currentProjectId],
    offlineQuery: toCompilableQuery(
      system.db.query.project.findFirst({
        where: eq(project.id, currentProjectId!),
        columns: { id: true, private: true, creator_id: true }
      })
    ),
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('id, private, creator_id')
        .eq('id', currentProjectId);
      if (error) throw error;
      return data as Pick<
        typeof project.$inferSelect,
        'id' | 'private' | 'creator_id'
      >[];
    },
    enableCloudQuery: !!currentProjectId && !currentProjectData,
    enableOfflineQuery: !!currentProjectId && !currentProjectData,
    getItemId: (item) => item.id
  });

  // Prefer passed project data for instant rendering
  const projectPrivacyData = currentProjectData
    ? {
        private: currentProjectData.private,
        creator_id: currentProjectData.creator_id
      }
    : queriedProjectData?.[0];
  const isPrivateProject = projectPrivacyData?.private ?? false;

  const [showRecording, setShowRecording] = React.useState(false);

  const { membership } = useUserPermissions(
    currentProjectId || '',
    'open_project',
    !!isPrivateProject
  );

  const isOwner = membership === 'owner';
  const isMember = membership === 'member' || membership === 'owner';
  // Check if user is creator
  const isCreator = currentUser?.id === projectPrivacyData?.creator_id;
  // User can see published badge if they are creator, member, or owner
  const canSeePublishedBadge = isCreator || isMember;

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

  const assetIds = React.useMemo(() => {
    return assets.map((asset) => asset.id).filter((id): id is string => !!id);
  }, [assets]);

  const { attachmentStates, isLoading: isAttachmentStatesLoading } =
    useAttachmentStates(assetIds);

  const safeAttachmentStates = attachmentStates;

  const blockedCount = useBlockedAssetsCount(currentQuestId || '');

  const attachmentStateSummary = React.useMemo(() => {
    if (safeAttachmentStates.size === 0) {
      return {};
    }

    const states = Array.from(safeAttachmentStates.values());
    const summary = states.reduce(
      (acc, attachment) => {
        acc[attachment.state] = (acc[attachment.state] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );
    return summary;
    // Use memo key instead of Map reference for stable dependencies (always 1 string)
  }, [safeAttachmentStates]);

  const handleAssetUpdate = React.useCallback(async () => {
    // await queryClient.invalidateQueries({
    //   // queryKey: ['assets', 'by-quest', currentQuestId],
    //   queryKey: ['by-quest', currentQuestId],
    //   exact: false
    // });
    await queryClient.invalidateQueries({
      queryKey: ['assets']
    });
  }, [queryClient]);

  const renderItem = React.useCallback(
    ({
      item,
      isPublished
    }: {
      item: AssetQuestLink & { source?: HybridDataSource };
      isPublished: boolean;
    }) => {
      // Check if this asset is currently playing in PlayAll mode
      const isPlaying = isPlayAllRunning && currentlyPlayingAssetId === item.id;

      // Debug logging for highlighting
      if (isPlaying && __DEV__) {
        console.log(`🎨 Rendering highlighted asset: ${item.id.slice(0, 8)}`);
      }

      const isSelected = selectedAssetIds.has(item.id);

      return (
        <>
          <AssetListItem
            key={item.id}
            asset={item}
            attachmentState={safeAttachmentStates.get(item.id)}
            questId={currentQuestId || ''}
            isCurrentlyPlaying={isPlaying}
            onUpdate={handleAssetUpdate}
            isPublished={isPublished}
            isSelected={isSelected}
            onToggleSelect={handleToggleSelect}
          />
        </>
      );
    },
    [
      currentQuestId,
      safeAttachmentStates,
      isPlayAllRunning,
      currentlyPlayingAssetId,
      handleAssetUpdate,
      selectedAssetIds,
      handleToggleSelect
    ]
  );

  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // footer handled inline in ListFooterComponent

  const statusText = React.useMemo(() => {
    const cloudCount = assets.filter((a) => a.source === 'cloud').length;
    const offlineCount = assets.length - cloudCount;
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

  // Special audio ID for "play all" mode
  // const PLAY_ALL_AUDIO_ID = 'play-all-assets';

  // Fetch audio URIs for an asset (similar to RecordingViewSimplified)
  // Includes fallback logic for local-only files when server records are removed
  const getAssetAudioUris = React.useCallback(
    async (assetId: string): Promise<string[]> => {
      try {
        // Get content links from both synced and local tables
        const assetContentLinkSynced = resolveTable('asset_content_link', {
          localOverride: false
        });
        const contentLinksSynced = await system.db
          .select()
          .from(assetContentLinkSynced)
          .where(eq(assetContentLinkSynced.asset_id, assetId));

        const assetContentLinkLocal = resolveTable('asset_content_link', {
          localOverride: true
        });
        const contentLinksLocal = await system.db
          .select()
          .from(assetContentLinkLocal)
          .where(eq(assetContentLinkLocal.asset_id, assetId));

        // Prefer synced links, but merge with local for fallback
        const allContentLinks = [...contentLinksSynced, ...contentLinksLocal];

        // Deduplicate by ID (prefer synced over local)
        const seenIds = new Set<string>();
        const uniqueLinks = allContentLinks.filter((link) => {
          if (seenIds.has(link.id)) {
            return false;
          }
          seenIds.add(link.id);
          return true;
        });

        if (uniqueLinks.length === 0) {
          return [];
        }

        // Get audio values from content links (can be URIs or attachment IDs)
        const audioValues = uniqueLinks
          .flatMap((link) => {
            const audioArray = link.audio ?? [];
            return audioArray;
          })
          .filter((value): value is string => !!value);

        if (audioValues.length === 0) {
          return [];
        }

        // Process each audio value - can be either a local URI or an attachment ID
        const uris: string[] = [];
        for (const audioValue of audioValues) {
          // Check if this is already a local URI (starts with 'local/' or 'file://')
          if (audioValue.startsWith('local/')) {
            // It's a direct local URI from saveAudioLocally()
            const constructedUri =
              await getLocalAttachmentUriWithOPFS(audioValue);
            // Check if file exists at constructed path
            if (await fileExists(constructedUri)) {
              uris.push(constructedUri);
            } else {
              // File doesn't exist at expected path - try to find it in attachment queue
              console.log(
                `⚠️ Local URI ${audioValue} not found at ${constructedUri}, searching attachment queue...`
              );

              if (system.permAttachmentQueue) {
                // Extract filename from local path (e.g., "local/uuid.wav" -> "uuid.wav")
                const filename = audioValue.replace(/^local\//, '');
                // Extract UUID part (without extension) for more flexible matching
                const uuidPart = filename.split('.')[0];

                // Search attachment queue by filename or UUID
                let attachment = await system.powersync.getOptional<{
                  id: string;
                  filename: string | null;
                  local_uri: string | null;
                }>(
                  `SELECT * FROM ${system.permAttachmentQueue.table} WHERE filename = ? OR filename LIKE ? OR id = ? OR id LIKE ? LIMIT 1`,
                  [filename, `%${uuidPart}%`, filename, `%${uuidPart}%`]
                );

                // If not found, try searching all attachments for this asset's content links
                if (!attachment && uniqueLinks.length > 0) {
                  const allAttachmentIds = uniqueLinks
                    .flatMap((link) => link.audio ?? [])
                    .filter(
                      (av): av is string =>
                        typeof av === 'string' &&
                        !av.startsWith('local/') &&
                        !av.startsWith('file://')
                    );
                  if (allAttachmentIds.length > 0) {
                    const placeholders = allAttachmentIds
                      .map(() => '?')
                      .join(',');
                    attachment = await system.powersync.getOptional<{
                      id: string;
                      filename: string | null;
                      local_uri: string | null;
                    }>(
                      `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id IN (${placeholders}) LIMIT 1`,
                      allAttachmentIds
                    );
                  }
                }

                if (attachment?.local_uri) {
                  const foundUri = system.permAttachmentQueue.getLocalUri(
                    attachment.local_uri
                  );
                  // Verify the found file actually exists
                  if (await fileExists(foundUri)) {
                    uris.push(foundUri);
                    console.log(
                      `✅ Found attachment in queue for local URI ${audioValue.slice(0, 20)}`
                    );
                  } else {
                    console.warn(
                      `⚠️ Attachment found in queue but file doesn't exist: ${foundUri}`
                    );
                  }
                } else {
                  // Try fallback to local table for alternative audio values
                  const fallbackLink = contentLinksLocal.find(
                    (link) => link.asset_id === assetId
                  );
                  if (fallbackLink?.audio) {
                    for (const fallbackAudioValue of fallbackLink.audio) {
                      if (fallbackAudioValue.startsWith('file://')) {
                        if (await fileExists(fallbackAudioValue)) {
                          uris.push(fallbackAudioValue);
                          console.log(`✅ Found fallback file URI`);
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          } else if (audioValue.startsWith('file://')) {
            // Already a full file URI - verify it exists
            if (await fileExists(audioValue)) {
              uris.push(audioValue);
            } else {
              console.warn(`File URI does not exist: ${audioValue}`);
              // Try to find in attachment queue by extracting filename from path
              if (system.permAttachmentQueue) {
                const filename = audioValue.split('/').pop();
                if (filename) {
                  const attachment = await system.powersync.getOptional<{
                    id: string;
                    filename: string | null;
                    local_uri: string | null;
                  }>(
                    `SELECT * FROM ${system.permAttachmentQueue.table} WHERE filename = ? OR id = ? LIMIT 1`,
                    [filename, filename]
                  );

                  if (attachment?.local_uri) {
                    const foundUri = system.permAttachmentQueue.getLocalUri(
                      attachment.local_uri
                    );
                    if (await fileExists(foundUri)) {
                      uris.push(foundUri);
                      console.log(`✅ Found attachment in queue for file URI`);
                    }
                  }
                }
              }
            }
          } else {
            // It's an attachment ID - look it up in the attachment queue
            if (!system.permAttachmentQueue) {
              // No attachment queue - try fallback to local table
              const fallbackLink = contentLinksLocal.find(
                (link) => link.asset_id === assetId
              );
              if (fallbackLink?.audio) {
                for (const fallbackAudioValue of fallbackLink.audio) {
                  if (fallbackAudioValue.startsWith('local/')) {
                    const fallbackUri =
                      await getLocalAttachmentUriWithOPFS(fallbackAudioValue);
                    if (await fileExists(fallbackUri)) {
                      uris.push(fallbackUri);
                      break;
                    }
                  } else if (fallbackAudioValue.startsWith('file://')) {
                    if (await fileExists(fallbackAudioValue)) {
                      uris.push(fallbackAudioValue);
                      break;
                    }
                  }
                }
              }
              continue;
            }

            const attachment = await system.powersync.getOptional<{
              id: string;
              local_uri: string | null;
            }>(
              `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`,
              [audioValue]
            );

            if (attachment?.local_uri) {
              const localUri = system.permAttachmentQueue.getLocalUri(
                attachment.local_uri
              );
              if (await fileExists(localUri)) {
                uris.push(localUri);
              }
            } else {
              // Attachment ID not found in queue - try fallback to local table
              console.log(
                `⚠️ Attachment ID ${audioValue.slice(0, 8)} not found in queue, checking local table fallback...`
              );

              const fallbackLink = contentLinksLocal.find(
                (link) => link.asset_id === assetId
              );
              if (fallbackLink?.audio) {
                for (const fallbackAudioValue of fallbackLink.audio) {
                  if (fallbackAudioValue.startsWith('local/')) {
                    const fallbackUri =
                      await getLocalAttachmentUriWithOPFS(fallbackAudioValue);
                    if (await fileExists(fallbackUri)) {
                      uris.push(fallbackUri);
                      console.log(
                        `✅ Found fallback local URI for attachment ${audioValue.slice(0, 8)}`
                      );
                      break;
                    }
                  } else if (fallbackAudioValue.startsWith('file://')) {
                    if (await fileExists(fallbackAudioValue)) {
                      uris.push(fallbackAudioValue);
                      console.log(
                        `✅ Found fallback file URI for attachment ${audioValue.slice(0, 8)}`
                      );
                      break;
                    }
                  }
                }
              } else {
                // Try to get cloud URL if local not available
                try {
                  if (!AppConfig.supabaseBucket) {
                    continue;
                  }
                  const { data } = system.supabaseConnector.client.storage
                    .from(AppConfig.supabaseBucket)
                    .getPublicUrl(audioValue);
                  if (data.publicUrl) {
                    uris.push(data.publicUrl);
                  }
                } catch (error) {
                  console.error('Failed to get cloud audio URL:', error);
                }
              }
            }
          }
        }

        return uris;
      } catch (error) {
        console.error('Failed to fetch audio URIs:', error);
        return [];
      }
    },
    []
  );

  // Track currently playing asset based on audio position
  // React.useEffect(() => {
  //   if (
  //     !audioContext.isPlaying ||
  //     audioContext.currentAudioId !== PLAY_ALL_AUDIO_ID
  //   ) {
  //     setCurrentlyPlayingAssetId(null);
  //     return;
  //   }

  //   // Calculate which asset is playing based on cumulative position
  //   const checkCurrentAsset = () => {
  //     const uris = uriOrderRef.current;
  //     const durations = segmentDurationsRef.current;

  //     if (uris.length === 0) return;

  //     const position = audioContext.position; // Position in milliseconds

  //     // If we don't have durations yet, use simple percentage-based approach
  //     if (durations.length === 0 || durations.every((d) => d === 0)) {
  //       const duration = audioContext.duration;
  //       if (duration === 0) {
  //         console.log(
  //           `⏸️ No duration available yet (position: ${position}ms, duration: ${duration}ms)`
  //         );
  //         return;
  //       }

  //       // Fallback: use percentage-based calculation
  //       const positionPercent = position / duration;
  //       const uriIndex = Math.min(
  //         Math.floor(positionPercent * uris.length),
  //         uris.length - 1
  //       );

  //       const currentUri = uris[uriIndex];
  //       if (currentUri) {
  //         const assetId = assetUriMapRef.current.get(currentUri);
  //         if (assetId) {
  //           if (assetId !== currentlyPlayingAssetId) {
  //             console.log(
  //               `🎵 [Fallback] Highlighting asset ${assetId.slice(0, 8)} (segment ${uriIndex + 1}/${uris.length}, ${Math.round(positionPercent * 100)}%)`
  //             );
  //             setCurrentlyPlayingAssetId(assetId);
  //           }
  //         } else {
  //           console.warn(`⚠️ No asset ID found for URI at index ${uriIndex}`);
  //         }
  //       }
  //       return;
  //     }

  //     // Calculate which segment we're in based on cumulative durations
  //     let cumulativeDuration = 0;
  //     for (let i = 0; i < uris.length; i++) {
  //       const segmentDuration = durations[i] || 0;
  //       const segmentStart = cumulativeDuration;
  //       cumulativeDuration += segmentDuration;

  //       // If position is within this segment's range
  //       // Use <= for the last segment to catch it even if position is slightly off
  //       if (
  //         (position >= segmentStart && position <= cumulativeDuration) ||
  //         (i === uris.length - 1 && position >= segmentStart)
  //       ) {
  //         const currentUri = uris[i];
  //         if (currentUri) {
  //           const assetId = assetUriMapRef.current.get(currentUri);
  //           if (assetId) {
  //             if (assetId !== currentlyPlayingAssetId) {
  //               console.log(
  //                 `🎵 Highlighting asset ${assetId.slice(0, 8)} (segment ${i + 1}/${uris.length}, position: ${Math.round(position)}ms in range [${Math.round(segmentStart)}-${Math.round(cumulativeDuration)}]ms)`
  //               );
  //               setCurrentlyPlayingAssetId(assetId);
  //             }
  //           } else {
  //             console.warn(`⚠️ No asset ID found for URI at index ${i}`);
  //           }
  //         }
  //         break;
  //       }
  //     }
  //   };

  //   // Check immediately and then periodically while playing
  //   checkCurrentAsset();
  //   const interval = setInterval(checkCurrentAsset, 200); // Check every 200ms
  //   return () => clearInterval(interval);
  // }, [
  //   audioContext.isPlaying,
  //   audioContext.currentAudioId,
  //   audioContext.position,
  //   audioContext.duration,
  //   currentlyPlayingAssetId
  // ]);

  // Handle play all - plays all assets sequentially starting from selected asset
  const handlePlayAll = React.useCallback(async () => {
    currentPlayingAssetIdRef.current = null;
    try {
      // Check if already playing - toggle to stop
      if (isPlayAllRunningRef.current) {
        isPlayAllRunningRef.current = false;
        setIsPlayAllRunning(false);

        // Stop current sound immediately
        if (currentPlayAllSoundRef.current) {
          try {
            currentPlayAllSoundRef.current.pause();
            currentPlayAllSoundRef.current.release();
            currentPlayAllSoundRef.current = null;
          } catch (error) {
            console.error('Error stopping sound:', error);
          }
        }
        currentPlayingAssetIdRef.current = null;
        setCurrentlyPlayingAssetId(null);
        console.log('⏸️ Stopped play all');
        return;
      }

      // Determine which assets to process based on selection state
      let assetsToProcess: AssetQuestLink[];

      // If there's a selected asset, start from it
      if (selectedAssetIds.size > 0) {
        const firstSelectedIndex = assets.findIndex((a) =>
          selectedAssetIds.has(a.id)
        );
        if (firstSelectedIndex >= 0) {
          assetsToProcess = assets.slice(firstSelectedIndex);
          console.log(
            `🎵 Starting from first selected asset at index ${firstSelectedIndex}`
          );
        } else {
          assetsToProcess = assets;
        }
      } else {
        // No selection, play all
        assetsToProcess = assets;
      }

      if (assetsToProcess.length === 0) {
        console.warn('⚠️ No assets to play');
        return;
      }

      console.log(
        `🎵 Starting play all from ${assetsToProcess.length} assets...`
      );

      // Mark as running
      isPlayAllRunningRef.current = true;
      setIsPlayAllRunning(true);

      // Build playlist: Array<{assetId, uris}>
      const playlist: { assetId: string; uris: string[] }[] = [];

      for (const asset of assetsToProcess) {
        // Check if cancelled
        if (!isPlayAllRunningRef.current) {
          console.log('⏸️ Play all cancelled during playlist build');
          return;
        }

        // Get URIs for this asset
        const uris = await getAssetAudioUris(asset.id);
        if (uris.length > 0) {
          playlist.push({ assetId: asset.id, uris });
        }
      }

      if (playlist.length === 0) {
        console.error('❌ No audio URIs found for any assets');
        isPlayAllRunningRef.current = false;
        setIsPlayAllRunning(false);
        return;
      }

      console.log(
        `▶️ Playing ${playlist.reduce((sum, p) => sum + p.uris.length, 0)} audio segments from ${playlist.length} assets`
      );

      // Play each asset sequentially with direct linking
      for (let i = 0; i < playlist.length; i++) {
        // Check if cancelled
        if (!isPlayAllRunningRef.current) {
          console.log('⏸️ Play all cancelled');
          currentPlayingAssetIdRef.current = null;
          setCurrentlyPlayingAssetId(null);
          return;
        }

        const item = playlist[i]!;

        // HIGHLIGHT THIS ASSET - direct link!
        currentPlayingAssetIdRef.current = item.assetId;
        setCurrentlyPlayingAssetId(item.assetId);
        console.log(
          `▶️ [${i + 1}/${playlist.length}] Playing asset ${item.assetId.slice(0, 8)} (assetId: ${currentPlayingAssetIdRef.current}, ${item.uris.length} segments)`
        );

        // Play all URIs for this asset sequentially
        for (const uri of item.uris) {
          // Check if cancelled
          if (!isPlayAllRunningRef.current) {
            currentPlayingAssetIdRef.current = null;
            setCurrentlyPlayingAssetId(null);
            return;
          }

          // Play this URI and wait for it to finish
          await new Promise<void>((resolve) => {
            try {
              const player = createAudioPlayer(uri);
              currentPlayAllSoundRef.current = player;
              player.play();

              player.addListener('playbackStatusUpdate', (status) => {
                if (!status.didJustFinish) return;
                currentPlayAllSoundRef.current = null;
                player.release();
                resolve();
              });
            } catch (error) {
              console.error('Failed to play audio:', error);
              currentPlayAllSoundRef.current = null;
              resolve(); // Continue to next even on error
            }
          });
        }
      }

      // Finished playing all
      console.log('✅ Finished playing all assets');
      currentPlayingAssetIdRef.current = null;
      setCurrentlyPlayingAssetId(null);
      isPlayAllRunningRef.current = false;
      setIsPlayAllRunning(false);
      currentPlayAllSoundRef.current = null;
    } catch (error) {
      console.error('❌ Error playing all assets:', error);
      setCurrentlyPlayingAssetId(null);
      isPlayAllRunningRef.current = false;
      setIsPlayAllRunning(false);
      currentPlayAllSoundRef.current = null;
    }
  }, [assets, getAssetAudioUris, selectedAssetIds]);

  // Handle publish button press with useMutation
  const { mutate: publishQuest, isPending: isPublishing } = useMutation({
    mutationFn: async () => {
      if (!currentQuestId || !currentProjectId) {
        throw new Error('Missing quest or project ID');
      }
      console.log(`📤 Publishing quest ${currentQuestId}...`);
      const result = await publishQuestUtils(currentQuestId, currentProjectId);
      return result;
    },
    onSuccess: async (result) => {
      if (result.success) {
        // Wait for PowerSync to sync the published quest before invalidating
        await new Promise((resolve) => setTimeout(resolve, 1500));

        console.log('📥 [Publish Quest] Invalidating queries...');

        // Invalidate the quest query used by this component
        await queryClient.invalidateQueries({
          queryKey: ['current-quest', 'offline', currentQuestId]
        });
        await queryClient.invalidateQueries({
          queryKey: ['current-quest', 'cloud', currentQuestId]
        });

        // Invalidate general quest queries
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
        await queryClient.invalidateQueries({
          queryKey: ['quests']
        });

        // Invalidate assets queries to refresh the assets list
        await queryClient.invalidateQueries({
          queryKey: ['assets']
        });

        // Refetch quest data to update the selectedQuest immediately
        void refetchQuest();

        // Refetch assets to update download indicators
        void refetch();

        console.log('✅ [Publish Quest] All queries invalidated');

        RNAlert.alert(t('success'), result.message, [{ text: t('ok') }]);
      } else {
        RNAlert.alert(t('error'), result.message || t('error'), [
          { text: t('ok') }
        ]);
      }
    },
    onError: (error) => {
      console.error('Publish error:', error);
      RNAlert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedCreateTranslation'),
        [{ text: t('ok') }]
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

      RNAlert.alert(t('success'), t('offloadComplete'));
      setShowOffloadDrawer(false);

      // Navigate back to project directory view (quests view)
      goBack();
    } catch (error) {
      console.error('Failed to offload quest:', error);
      RNAlert.alert(t('error'), t('offloadError'));
    } finally {
      setIsOffloading(false);
    }
  };

  // Handle going to recording - stops any playing audio first
  const handleGoToRecording = React.useCallback(async () => {
    // Stop PlayAll if running
    if (isPlayAllRunningRef.current) {
      isPlayAllRunningRef.current = false;
      setIsPlayAllRunning(false);

      // Stop current sound immediately
      if (currentPlayAllSoundRef.current) {
        try {
          currentPlayAllSoundRef.current.pause();
          currentPlayAllSoundRef.current.release();
          currentPlayAllSoundRef.current = null;
        } catch (error) {
          console.error('Error stopping sound:', error);
        }
      }

      currentPlayingAssetIdRef.current = null;
      setCurrentlyPlayingAssetId(null);
    }

    // Stop any other audio from audioContext
    if (audioContext.isPlaying) {
      await audioContext.stopCurrentSound();
    }

    // Now show recording
    setShowRecording(true);
  }, [audioContext]);

  // Cleanup effect: Clear all refs and stop audio when component unmounts
  // This prevents memory leaks when navigating away from the assets view
  React.useEffect(() => {
    // Capture refs in variables to avoid stale closure warnings
    const timeoutIds = timeoutIdsRef.current;

    return () => {
      // Stop audio playback if playing (access via ref for latest state)
      if (audioContextRef.current.isPlaying) {
        void audioContextRef.current.stopCurrentSound();
      }

      // Stop PlayAll if running
      if (isPlayAllRunningRef.current) {
        isPlayAllRunningRef.current = false;

        // Stop current sound immediately
        if (currentPlayAllSoundRef.current) {
          try {
            currentPlayAllSoundRef.current.pause();
            currentPlayAllSoundRef.current.release();
          } catch {
            // Ignore errors during cleanup
          }
          currentPlayAllSoundRef.current = null;
        }
      }

      // Clear all pending timeouts
      timeoutIds.forEach((id) => clearTimeout(id));
      timeoutIds.clear();

      // Reset state
      currentPlayingAssetIdRef.current = null;
      setCurrentlyPlayingAssetId(null);
      setIsPlayAllRunning(false);

      console.log('🧹 Cleaned up NextGenAssetsView on unmount');
    };
  }, []);

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

  // Get project name for PrivateAccessGate
  // Note: queriedProjectData doesn't include name, so we only use currentProjectData
  const projectName = currentProjectData?.name || '';

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
              const timeoutId = setTimeout(() => {
                timeoutIdsRef.current.delete(timeoutId);
                setIsRefreshing(false);
              }, 500);
              timeoutIdsRef.current.add(timeoutId);
            }}
          >
            <Animated.View style={spinStyle}>
              <Icon name="refresh-cw" size={18} className="text-primary" />
            </Animated.View>
          </Button>
          {assets.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onPress={handlePlayAll}
                className="h-10 w-10"
              >
                <Icon
                  name={isPlayAllRunning ? 'pause' : 'list-video'}
                  size={20}
                  className="text-primary"
                />
              </Button>
            </>
          )}
        </View>
        <View className="flex flex-row items-center gap-2">
          {isPublished ? (
            // Only show cloud-check icon if user is creator, member, or owner
            canSeePublishedBadge ? (
              <>
                <Button
                  variant="outline"
                  className="h-10 px-4 py-0"
                  onPress={() => {
                    RNAlert.alert(t('questSyncedToCloud'));
                  }}
                >
                  <View className="flex-row items-center gap-0.5">
                    <Icon name="cloud-upload" size={18} />
                    <Icon name="check-check" size={14} />
                  </View>
                </Button>
                {currentQuestId && currentProjectId && (
                  <ExportButton
                    questId={currentQuestId}
                    projectId={currentProjectId}
                    questName={selectedQuest?.name}
                    disabled={isPublishing || !isOnline}
                    membership={membership}
                  />
                )}
              </>
            ) : (
              // Show membership request button for non-members viewing published quest
              isPrivateProject && (
                <Button
                  variant="default"
                  size="sm"
                  onPress={() => setShowPrivateAccessModal(true)}
                >
                  <Icon name="user-plus" size={16} />
                  <Icon name="lock" size={16} />
                </Button>
              )
            )
          ) : (
            // Only show publish/record buttons for authenticated users
            currentUser && (
              <View className="flex flex-row items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isPublishing || !isOnline || !isMember}
                  onPress={() => {
                    if (!isOnline) {
                      RNAlert.alert(t('error'), t('cannotPublishWhileOffline'));
                      return;
                    }

                    if (!isMember) {
                      RNAlert.alert(t('error'), t('membersOnlyPublish'));
                      return;
                    }

                    if (!currentQuestId) {
                      console.error('No current quest id');
                      return;
                    }

                    // Use quest name if available, otherwise generic message
                    const questName = selectedQuest?.name || 'this chapter';

                    RNAlert.alert(
                      t('publishChapter'),
                      t('publishChapterMessage').replace(
                        '{questName}',
                        questName
                      ),
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
                    <Icon name="cloud-upload" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-[1.5px] border-primary"
                  onPress={() => void handleGoToRecording()}
                >
                  <Icon name="pencil" className="text-primary" />
                </Button>
                {currentQuestId && currentProjectId && (
                  <ExportButton
                    questId={currentQuestId}
                    projectId={currentProjectId || ''}
                    questName={selectedQuest?.name}
                    disabled={isPublishing || !isOnline}
                    membership={membership}
                  />
                )}
              </View>
            )
          )}
        </View>
      </View>

      <Input
        placeholder={t('searchAssets')}
        value={searchQuery}
        onChangeText={setSearchQuery}
        prefix="search"
        prefixStyling={false}
        size="sm"
        returnKeyType="search"
        suffix={
          isFetching && searchQuery ? (
            <ActivityIndicator size="small" color={getThemeColor('primary')} />
          ) : undefined
        }
        suffixStyling={false}
        hitSlop={12}
      />

      {SHOW_DEV_ELEMENTS && (
        <Text className="text-sm text-muted-foreground">{statusText}</Text>
      )}

      {SHOW_DEV_ELEMENTS &&
        !isAttachmentStatesLoading &&
        safeAttachmentStates.size > 0 && (
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
          extraData={[currentlyPlayingAssetId, selectedAssetIds]}
          recycleItems
          renderItem={({ item }) => renderItem({ item, isPublished })}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          estimatedItemSize={120}
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
                    name="shield-off"
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
                  {isPublished ? t('noAssetsFound') : t('nothingHereYet')}
                </Text>
                {!isPublished && (
                  <Icon
                    name="arrow-big-down-dash"
                    size={48}
                    className="text-muted-foreground"
                  />
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Sticky Record Button Footer - only show for authenticated users */}
      {!isPublished && currentUser && (
        <View
          style={{
            paddingBottom: insets.bottom,
            paddingRight: 75 // Leave space for SpeedDial on the right (24 margin + ~56 width + padding)
          }}
        >
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            onPress={() => void handleGoToRecording()}
          >
            <Icon
              name="mic"
              size={24}
              className="text-destructive-foreground"
            />
            <Text className="ml-2 text-lg font-semibold text-destructive-foreground">
              {t('doRecord')}
            </Text>
          </Button>
        </View>
      )}

      <View
        style={{
          bottom: insets.bottom + 24,
          right: 24
        }}
        className="absolute z-[100]"
      >
        <SpeedDial>
          <SpeedDialItems>
            {/* For anonymous users, only show info button */}
            {currentUser ? (
              <>
                {allowSettings && isOwner ? (
                  <SpeedDialItem
                    icon="settings"
                    variant="outline"
                    onPress={() => setShowSettingsModal(true)}
                  />
                ) : !hasReported ? (
                  <SpeedDialItem
                    icon="flag"
                    variant="outline"
                    onPress={() => setShowReportModal(true)}
                  />
                ) : null}
              </>
            ) : null}
            {/* Info button always visible */}
            <SpeedDialItem
              icon="info"
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
        isOffloading={isOffloading}
      />

      {/* Private Access Gate Modal for Membership Requests */}
      {isPrivateProject && (
        <PrivateAccessGate
          projectId={currentProjectId || ''}
          projectName={projectName as string}
          isPrivate={isPrivateProject as boolean}
          action="contribute"
          modal={true}
          isVisible={showPrivateAccessModal}
          onClose={() => setShowPrivateAccessModal(false)}
        />
      )}
    </View>
  );
}
