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
import {
  CheckCheck,
  CloudUpload,
  FlagIcon,
  GripVerticalIcon,
  InfoIcon,
  LockIcon,
  MicIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  UserPlusIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHybridData } from './useHybridData';

import { AddVerseLabelButton } from '@/components/AddVerseLabelButton';
import { AssetListSkeleton } from '@/components/AssetListSkeleton';
import { ExportButton } from '@/components/ExportButton';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { QuestOffloadVerificationDrawer } from '@/components/QuestOffloadVerificationDrawer';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { VerseRangeSelector } from '@/components/VerseRangeSelector';
import { VerseSeparator } from '@/components/VerseSeparator';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import { batchUpdateAssetMetadata } from '@/database_services/assetService';
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
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Sortable from 'react-native-sortables';
import { BibleAssetListItem } from './BibleAssetListItem';
import RecordingViewSimplified from './recording/components/RecordingViewSimplified';

type Asset = typeof asset.$inferSelect;

interface AssetMetadata {
  verse?: {
    from: number;
    to: number;
  };
}

type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
  tag_ids?: string[] | undefined;
  metadata?: AssetMetadata | null;
};

// List item types for rendering
interface ListItemAsset {
  type: 'asset';
  content: AssetQuestLink;
  key: string;
}

interface ListItemSeparator {
  type: 'separator';
  from?: number;
  to?: number;
  key: string;
}

type ListItem = ListItemAsset | ListItemSeparator;

export default function BibleAssetsView() {
  const {
    currentQuestId,
    currentProjectId,
    currentProjectData,
    currentQuestData,
    currentBookId
  } = useCurrentNavigation();
  const { goBack } = useAppNavigation();
  const { currentUser } = useAuth();
  const audioContext = useAudio();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [debouncedSearchQuery, searchQuery, setSearchQuery] = useDebouncedState(
    '',
    300
  );
  const { t } = useLocalization();
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showOffloadDrawer, setShowOffloadDrawer] = React.useState(false);
  const [verseSelectorState, setVerseSelectorState] = React.useState<{
    isOpen: boolean;
    key: string | null;
    from?: number;
    to?: number;
  }>({ isOpen: false, key: null });

  // Manual verse separators created by the user
  const [manualSeparators, setManualSeparators] = React.useState<
    { from: number; to: number; key: string }[]
  >([]);

  // Function to add a new verse separator
  const addVerseSeparator = React.useCallback((from: number, to: number) => {
    const newSeparator = {
      from,
      to,
      key: `manual-sep-${from}-${to}-${Date.now()}`
    };
    setManualSeparators((prev) => [...prev, newSeparator]);
  }, []);
  const [showPrivateAccessModal, setShowPrivateAccessModal] =
    React.useState(false);
  const [isOffloading, setIsOffloading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  // Track which asset is currently playing during play-all
  const [currentlyPlayingAssetId, setCurrentlyPlayingAssetId] = React.useState<
    string | null
  >(null);
  const assetUriMapRef = React.useRef<Map<string, string>>(new Map()); // URI -> assetId
  const assetOrderRef = React.useRef<string[]>([]); // Ordered list of asset IDs
  const uriOrderRef = React.useRef<string[]>([]); // Ordered list of URIs matching assetOrderRef
  const segmentDurationsRef = React.useRef<number[]>([]); // Duration of each URI segment in ms
  const fixedItemsIndexesRef = React.useRef<number[]>([0]);

  // Get verse count for current chapter
  const verseCount = React.useMemo(() => {
    if (!currentQuestData || !currentBookId) return 0;
    const chapterNum = (currentQuestData as { chapterNumber?: number })
      ?.chapterNumber;
    if (typeof chapterNum !== 'number') return 0;
    const book = BIBLE_BOOKS.find((b) => b.id === currentBookId);
    return book?.verses[chapterNum - 1] ?? 0;
  }, [currentQuestData, currentBookId]);

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

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

  const listItems = React.useMemo((): ListItem[] => {
    // Separate assets with and without metadata
    const assetsWithMeta = assets.filter(
      (a) => a.metadata?.verse?.from != null
    );
    const assetsWithoutMeta = assets.filter(
      (a) => a.metadata?.verse?.from == null
    );

    // Sort assets with metadata by verse.from
    assetsWithMeta.sort((a, b) => {
      const aFrom = a.metadata?.verse?.from ?? 0;
      const bFrom = b.metadata?.verse?.from ?? 0;
      return aFrom - bFrom;
    });

    // First build the list with auto separators + assets
    const result: ListItem[] = [];
    let currentFrom: number | undefined;
    let currentTo: number | undefined;

    // Process assets with metadata
    for (const asset of assetsWithMeta) {
      const from = asset.metadata?.verse?.from;
      const to = asset.metadata?.verse?.to;

      // If different from current group, add separator
      if (from !== currentFrom || to !== currentTo) {
        result.push({
          type: 'separator',
          from,
          to,
          key: `sep-${from}-${to}`
        });
        currentFrom = from;
        currentTo = to;
      }

      result.push({
        type: 'asset',
        content: asset,
        key: asset.id
      });
    }

    // Prepare unassigned block (append later)
    const unassignedBlock: ListItem[] = [];
    if (assetsWithoutMeta.length > 0) {
      unassignedBlock.push({
        type: 'separator',
        key: 'sep-unassigned'
      });

      for (const asset of assetsWithoutMeta) {
        unassignedBlock.push({
          type: 'asset',
          content: asset,
          key: asset.id
        });
      }
    }

    // Insert manual separators in-order before the unassigned block
    const sortedManualSeps = [...manualSeparators].sort(
      (a, b) => a.from - b.from
    );

    for (const sep of sortedManualSeps) {
      const sepItem: ListItemSeparator = {
        type: 'separator',
        from: sep.from,
        to: sep.to,
        key: sep.key
      };

      // Find the first separator with 'from' greater than this sep.from
      let insertIdx = result.findIndex(
        (item) =>
          item.type === 'separator' &&
          item.from !== undefined &&
          sep.from < item.from
      );
      if (insertIdx === -1) {
        insertIdx = result.length;
      }
      result.splice(insertIdx, 0, sepItem);
    }

    // Final assembly: result (with manual seps inserted) + unassigned block
    const combined: ListItem[] = [...result, ...unassignedBlock];

    // Deduplicate separators with the same range to avoid duplicates after drag/drop
    const seenSeparators = new Set<string>();
    const deduped: ListItem[] = [];
    for (const item of combined) {
      if (item.type === 'separator') {
        const sepKey = `${item.from ?? 'none'}-${item.to ?? 'none'}`;
        if (seenSeparators.has(sepKey)) {
          continue;
        }
        seenSeparators.add(sepKey);
      }
      deduped.push(item);
    }

    return deduped;
  }, [assets, manualSeparators]);

  // Compute the allowed range for a new separator based on existing separators
  // The AddVerseLabelButton is above the current separator, so:
  // - rangeFrom = previous separator's "to" + 1 (or 1 if no previous)
  // - rangeTo = CURRENT separator's "from" - 1 (or verseCount if current has no "from")
  const computeAllowedRange = React.useCallback(
    (separatorKey: string) => {
      const currentIdx = listItems.findIndex((i) => i.key === separatorKey);
      if (currentIdx === -1) {
        return { from: 1, to: verseCount || 1 };
      }

      const currentSep = listItems[currentIdx];

      // Get the CURRENT separator's "from" value (this is the ceiling for new range)
      let currentFrom: number | undefined;
      if (currentSep && currentSep.type === 'separator') {
        currentFrom = currentSep.from;
      }

      // Look backward for the PREVIOUS separator to get its "to" value
      let prevTo: number | undefined;
      for (let i = currentIdx - 1; i >= 0; i--) {
        const item = listItems[i];
        if (item && item.type === 'separator' && item.to !== undefined) {
          prevTo = item.to;
          break;
        }
      }

      // Calculate range:
      // - From: previous separator's "to" + 1, or 1 if no previous
      // - To: CURRENT separator's "from" - 1, or verseCount if current has no "from"
      const rangeFrom = prevTo !== undefined ? prevTo + 1 : 1;
      const rangeTo =
        currentFrom !== undefined ? currentFrom - 1 : verseCount || 1;

      // Ensure valid range (from <= to)
      const finalFrom = Math.max(1, rangeFrom);
      const finalTo = Math.max(finalFrom, Math.min(rangeTo, verseCount || 1));

      console.log(
        `computeAllowedRange for ${separatorKey}: prevTo=${prevTo}, currentFrom=${currentFrom} => from=${finalFrom}, to=${finalTo}`
      );

      return { from: finalFrom, to: finalTo };
    },
    [listItems, verseCount]
  );

  const assetIds = React.useMemo(() => {
    return assets.map((asset) => asset.id).filter((id): id is string => !!id);
  }, [assets]);

  const { attachmentStates, isLoading: isAttachmentStatesLoading } =
    useAttachmentStates(assetIds);

  const safeAttachmentStates = attachmentStates;

  const _blockedCount = useBlockedAssetsCount(currentQuestId || '');

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
      isPublished,
      index
    }: {
      item: ListItem;
      isPublished: boolean;
      index: number;
    }) => {
      // Handle separator items
      const dragHandle = !isPublished ? (
        <Sortable.Handle
          mode={
            fixedItemsIndexesRef.current.includes(index)
              ? 'fixed-order'
              : 'draggable'
          }
        >
          <Icon
            as={GripVerticalIcon}
            size={24}
            className="text-muted-foreground"
          />
        </Sortable.Handle>
      ) : null;

      if (item.type === 'separator') {
        return (
          <View>
            <AddVerseLabelButton
              onPress={() => {
                // Calculate the allowed range based on neighboring separators
                const allowedRange = computeAllowedRange(item.key);
                setVerseSelectorState({
                  isOpen: true,
                  key: item.key,
                  from: allowedRange.from,
                  to: allowedRange.to
                });
              }}
            />
            <VerseSeparator
              editable={!isPublished}
              from={item.from}
              to={item.to}
              label="Verse"
              dragHandle={dragHandle}
            />
          </View>
        );
      }

      // Handle asset items
      const asset = item.content;
      const isPlaying =
        audioContext.isPlaying &&
        audioContext.currentAudioId === PLAY_ALL_AUDIO_ID &&
        currentlyPlayingAssetId === asset.id;

      return (
        <BibleAssetListItem
          key={asset.id}
          asset={asset}
          attachmentState={safeAttachmentStates.get(asset.id)}
          questId={currentQuestId || ''}
          isCurrentlyPlaying={isPlaying}
          onUpdate={handleAssetUpdate}
          isPublished={isPublished}
          dragHandle={dragHandle}
        />
      );
    },
    [
      currentQuestId,
      safeAttachmentStates,
      audioContext.isPlaying,
      audioContext.currentAudioId,
      currentlyPlayingAssetId,
      handleAssetUpdate,
      computeAllowedRange
    ]
  );

  const _onEndReached = React.useCallback(() => {
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
  const PLAY_ALL_AUDIO_ID = 'play-all-assets';

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
  React.useEffect(() => {
    if (
      !audioContext.isPlaying ||
      audioContext.currentAudioId !== PLAY_ALL_AUDIO_ID
    ) {
      setCurrentlyPlayingAssetId(null);
      return;
    }

    // Calculate which asset is playing based on cumulative position
    const checkCurrentAsset = () => {
      const uris = uriOrderRef.current;
      const durations = segmentDurationsRef.current;

      if (uris.length === 0) return;

      const position = audioContext.position; // Position in milliseconds

      // If we don't have durations yet, use simple percentage-based approach
      if (durations.length === 0 || durations.every((d) => d === 0)) {
        const duration = audioContext.duration;
        if (duration === 0) {
          console.log(
            `⏸️ No duration available yet (position: ${position}ms, duration: ${duration}ms)`
          );
          return;
        }

        // Fallback: use percentage-based calculation
        const positionPercent = position / duration;
        const uriIndex = Math.min(
          Math.floor(positionPercent * uris.length),
          uris.length - 1
        );

        const currentUri = uris[uriIndex];
        if (currentUri) {
          const assetId = assetUriMapRef.current.get(currentUri);
          if (assetId) {
            if (assetId !== currentlyPlayingAssetId) {
              console.log(
                `🎵 [Fallback] Highlighting asset ${assetId.slice(0, 8)} (segment ${uriIndex + 1}/${uris.length}, ${Math.round(positionPercent * 100)}%)`
              );
              setCurrentlyPlayingAssetId(assetId);
            }
          } else {
            console.warn(`⚠️ No asset ID found for URI at index ${uriIndex}`);
          }
        }
        return;
      }

      // Calculate which segment we're in based on cumulative durations
      let cumulativeDuration = 0;
      for (let i = 0; i < uris.length; i++) {
        const segmentDuration = durations[i] || 0;
        const segmentStart = cumulativeDuration;
        cumulativeDuration += segmentDuration;

        // If position is within this segment's range
        // Use <= for the last segment to catch it even if position is slightly off
        if (
          (position >= segmentStart && position <= cumulativeDuration) ||
          (i === uris.length - 1 && position >= segmentStart)
        ) {
          const currentUri = uris[i];
          if (currentUri) {
            const assetId = assetUriMapRef.current.get(currentUri);
            if (assetId) {
              if (assetId !== currentlyPlayingAssetId) {
                console.log(
                  `🎵 Highlighting asset ${assetId.slice(0, 8)} (segment ${i + 1}/${uris.length}, position: ${Math.round(position)}ms in range [${Math.round(segmentStart)}-${Math.round(cumulativeDuration)}]ms)`
                );
                setCurrentlyPlayingAssetId(assetId);
              }
            } else {
              console.warn(`⚠️ No asset ID found for URI at index ${i}`);
            }
          }
          break;
        }
      }
    };

    // Check immediately and then periodically while playing
    checkCurrentAsset();
    const interval = setInterval(checkCurrentAsset, 200); // Check every 200ms
    return () => clearInterval(interval);
  }, [
    audioContext.isPlaying,
    audioContext.currentAudioId,
    audioContext.position,
    audioContext.duration,
    currentlyPlayingAssetId
  ]);

  // Handle play all assets
  const handlePlayAllAssets = React.useCallback(async () => {
    try {
      const isPlayingAll =
        audioContext.isPlaying &&
        audioContext.currentAudioId === PLAY_ALL_AUDIO_ID;

      if (isPlayingAll) {
        await audioContext.stopCurrentSound();
        setCurrentlyPlayingAssetId(null);
        assetUriMapRef.current.clear();
        assetOrderRef.current = [];
        uriOrderRef.current = [];
        segmentDurationsRef.current = [];
      } else {
        if (assets.length === 0) {
          console.warn('⚠️ No assets to play');
          return;
        }

        // Collect all URIs from all assets in order, tracking which asset each URI belongs to
        const allUris: string[] = [];
        assetUriMapRef.current.clear();
        assetOrderRef.current = [];
        uriOrderRef.current = [];
        segmentDurationsRef.current = [];

        for (const asset of assets) {
          const uris = await getAssetAudioUris(asset.id);
          if (uris.length > 0) {
            assetOrderRef.current.push(asset.id);
            for (const uri of uris) {
              allUris.push(uri);
              uriOrderRef.current.push(uri);
              // Map each URI to its asset ID
              assetUriMapRef.current.set(uri, asset.id);
            }
          }
        }

        if (allUris.length === 0) {
          console.error('❌ No audio URIs found for any assets');
          return;
        }

        console.log(
          `▶️ Playing ${allUris.length} audio segments from ${assets.length} assets`
        );

        // Set the first asset as currently playing
        // Note: Duration preloading is handled by AudioContext.playSoundSequence
        if (assetOrderRef.current.length > 0) {
          setCurrentlyPlayingAssetId(assetOrderRef.current[0] || null);
        }

        await audioContext.playSoundSequence(allUris, PLAY_ALL_AUDIO_ID);
      }
    } catch (error) {
      console.error('❌ Failed to play all assets:', error);
      setCurrentlyPlayingAssetId(null);
      assetUriMapRef.current.clear();
      assetOrderRef.current = [];
      uriOrderRef.current = [];
      segmentDurationsRef.current = [];
    }
  }, [audioContext, getAssetAudioUris, assets]);

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

  // Get project name for PrivateAccessGate
  // Note: queriedProjectData doesn't include name, so we only use currentProjectData
  const projectName = currentProjectData?.name || '';

  async function _handleSorting(params: {
    indexToKey: string[];
    data: ListItem[];
  }) {
    console.log('🔄 Sorting complete!');
    console.log('🔄 New order (keys):', params.indexToKey);

    // Build a map of key -> item for quick lookup
    const keyToItem = new Map(params.data.map((item) => [item.key, item]));

    // Iterate through the new order and update asset metadata
    // based on the preceding separator
    let currentSeparator: ListItemSeparator | null = null;
    const updates: { assetId: string; metadata: AssetMetadata | null }[] = [];

    for (const key of params.indexToKey) {
      const item = keyToItem.get(key);
      if (!item) continue;

      if (item.type === 'separator') {
        currentSeparator = item;
      } else if (item.type === 'asset') {
        // Determine the metadata based on the current separator
        const newMetadata: AssetMetadata | null = currentSeparator?.from
          ? {
              verse: {
                from: currentSeparator.from,
                to: currentSeparator.to ?? currentSeparator.from
              }
            }
          : null;

        // Check if metadata has changed
        const currentMetadata = item.content.metadata;
        const hasChanged =
          JSON.stringify(newMetadata) !== JSON.stringify(currentMetadata);

        if (hasChanged) {
          updates.push({
            assetId: item.content.id,
            metadata: newMetadata
          });
        }
      }
    }

    // Batch update all changed assets
    if (updates.length > 0) {
      try {
        await batchUpdateAssetMetadata(updates);
        console.log(`✅ Updated ${updates.length} asset(s) metadata`);

        // Invalidate queries to refresh the UI
        void queryClient.invalidateQueries({ queryKey: ['assets'] });
        void refetch(); // Refresh current assets to remove stale separators
      } catch (err: unknown) {
        console.error('Failed to update asset metadata:', err);
      }
    }
  }

  return (
    <View className="flex flex-1 flex-col gap-6 p-6">
      <View className="flex flex-row items-center justify-between">
        <View className="flex flex-row items-center gap-2">
          <Text className="text-xl font-semibold">
            {/* Title */}
            {t('assets')}
          </Text>
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
          {assets.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onPress={handlePlayAllAssets}
              className="h-10 w-10"
            >
              <Icon
                as={
                  audioContext.isPlaying &&
                  audioContext.currentAudioId === PLAY_ALL_AUDIO_ID
                    ? PauseIcon
                    : PlayIcon
                }
                size={20}
              />
            </Button>
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
                    <Icon as={CloudUpload} size={18} />
                    <Icon as={CheckCheck} size={14} />
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
                  <Icon as={UserPlusIcon} size={16} />
                  <Icon as={LockIcon} size={16} />
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
                    <Icon as={CloudUpload} />
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
        prefix={SearchIcon}
        prefixStyling={false}
        size="sm"
        returnKeyType="search"
        suffix={
          isFetching && searchQuery ? (
            <ActivityIndicator size="small" color={getThemeColor('primary')} />
          ) : undefined
        }
        suffixStyling={false}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
        <Animated.ScrollView
          // contentContainerStyle={styles.contentContainer}
          ref={scrollableRef}
        >
          <Sortable.Grid
            autoScrollEnabled={true}
            columnGap={1}
            columns={1}
            data={listItems}
            renderItem={({ item, index }) =>
              renderItem({ item, isPublished, index })
            }
            rowGap={3}
            scrollableRef={scrollableRef} // required for auto scroll
            overDrag="vertical"
            onDragStart={(params) => {
              console.log('🔄 Drag start:', params);
            }}
            onDragEnd={(params) => void _handleSorting(params)}
            customHandle
            // autoScrollActivationOffset={75}
            // autoScrollSpeed={1}
            // autoScrollEnabled={true}
          />
        </Animated.ScrollView>
        // <LegendList
        //   data={assets}
        //   keyExtractor={(item) => item.id}
        //   extraData={currentlyPlayingAssetId}
        //   renderItem={({ item }) => renderItem({ item, isPublished })}
        //   onEndReached={onEndReached}
        //   onEndReachedThreshold={0.5}
        //   estimatedItemSize={120}
        //   recycleItems
        //   contentContainerStyle={{
        //     gap: 8,
        //     paddingBottom: !isPublished ? 100 : 24
        //   }}
        //   maintainVisibleContentPosition
        //   ListFooterComponent={() => (
        //     <View className="gap-2">
        //       {isFetchingNextPage && (
        //         <View className="items-center py-4">
        //           <ActivityIndicator
        //             size="small"
        //             color={getThemeColor('primary')}
        //           />
        //         </View>
        //       )}
        //       {blockedCount > 0 && (
        //         <View className="flex-row items-center justify-center gap-2 py-4">
        //           <Icon
        //             as={ShieldOffIcon}
        //             size={16}
        //             className="text-muted-foreground"
        //           />
        //           <Text className="text-sm text-muted-foreground">
        //             {blockedCount}{' '}
        //             {blockedCount === 1 ? 'blocked item' : 'blocked items'}
        //           </Text>
        //         </View>
        //       )}
        //     </View>
        //   )}
        //   ListEmptyComponent={() => (
        //     <View className="flex-1 items-center justify-center py-16">
        //       <View className="flex-col items-center gap-2">
        //         <Text className="text-muted-foreground">
        //           {isPublished ? t('noAssetsFound') : t('nothingHereYet')}
        //         </Text>
        //         {!isPublished && (
        //           <Icon
        //             as={ArrowBigDownDashIcon}
        //             size={48}
        //             className="text-muted-foreground"
        //           />
        //         )}
        //       </View>
        //     </View>
        //   )}
        // />
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
        </View>
      )}

      <View
        style={{
          bottom: insets.bottom + 24,
          right: 24
        }}
        className="absolute z-50"
      >
        <SpeedDial>
          <SpeedDialItems>
            {/* For anonymous users, only show info button */}
            {currentUser ? (
              <>
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
              </>
            ) : null}
            {/* Info button always visible */}
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

      {/* Verse Range Selector Drawer */}
      <Drawer
        open={verseSelectorState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setVerseSelectorState({ isOpen: false, key: null });
          }
        }}
        snapPoints={['40%']}
        enableDynamicSizing={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Select Verse Range</DrawerTitle>
          </DrawerHeader>
          <View className="p-4">
            <VerseRangeSelector
              from={verseSelectorState.from ?? 1}
              to={verseSelectorState.to ?? verseCount}
              ScrollViewComponent={GHScrollView}
              onApply={(from, to) => {
                addVerseSeparator(from, to);
                setVerseSelectorState({ isOpen: false, key: null });
              }}
              onCancel={() =>
                setVerseSelectorState({ isOpen: false, key: null })
              }
            />
          </View>
        </DrawerContent>
      </Drawer>
    </View>
  );
}
