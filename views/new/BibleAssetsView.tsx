/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AssetsDeletionDrawer } from '@/components/AssetsDeletionDrawer';
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
import {
  asset_content_link,
  project,
  quest as questTable
} from '@/db/drizzleSchema';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BookmarkPlusIcon,
  BrushCleaning,
  CheckCheck,
  ChevronRight,
  CloudUpload,
  FlagIcon,
  InfoIcon,
  LockIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  UserPlusIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHybridData } from './useHybridData';

import { AssetListSkeleton } from '@/components/AssetListSkeleton';
import { ExportButton } from '@/components/ExportButton';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { QuestOffloadVerificationDrawer } from '@/components/QuestOffloadVerificationDrawer';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerScrollView,
  DrawerTitle
} from '@/components/ui/drawer';
import { VerseAssigner } from '@/components/VerseAssigner';
import { VerseRangeSelector } from '@/components/VerseRangeSelector';
import { VerseSeparator } from '@/components/VerseSeparator';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import type { AssetUpdatePayload } from '@/database_services/assetService';
import {
  batchUpdateAssetMetadata,
  renameAsset
} from '@/database_services/assetService';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import { AppConfig } from '@/db/supabase/AppConfig';
import { useAssetsByQuest, useLocalAssetsByQuest } from '@/hooks/db/useAssets';
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
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Sortable from 'react-native-sortables';
import { BibleAssetListItem } from './BibleAssetListItem';
import BibleRecordingView from './recording/components/BibleRecordingView';
import { BibleSelectionControls } from './recording/components/BibleSelectionControls';
import { RenameAssetDrawer } from './recording/components/RenameAssetDrawer';
import { useSelectionMode } from './recording/hooks/useSelectionMode';
// import RecordingViewSimplified from './recording/components/RecordingViewSimplified';

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

// Manual separator type used for verse grouping
interface ManualSeparator {
  from: number;
  to: number;
  key: string;
  assetId?: string;
}

const RecordingPlaceIndicator = () => (
  <View className="flex flex-row items-center justify-center gap-1 py-2">
    {/* <Icon as={CassetteTapeIcon} size={16} className="text-destructive" /> */}
    <View className="h-2 w-2 rounded-full bg-destructive" />
    <Text className="text-xs text-destructive">REC</Text>
  </View>
);

// ============================================================================
// HELPER FUNCTIONS (moved outside component for better performance)
// ============================================================================

/**
 * Builds the final list of items (assets + separators) for rendering.
 * This is extracted as a pure function to avoid recreation on each render.
 */
function buildFinalList(
  assetsWithMeta: AssetQuestLink[],
  assetsWithoutMeta: AssetQuestLink[],
  separatorsWithAssetId: ManualSeparator[],
  sortedSeparatorsWithoutAssetId: ManualSeparator[],
  allManualSeparators: ManualSeparator[]
): ListItem[] {
  // Build list with auto-generated separators + assets with metadata
  const result: ListItem[] = [];
  let currentFrom: number | undefined;
  let currentTo: number | undefined;

  for (const asset of assetsWithMeta) {
    const from = asset.metadata?.verse?.from;
    const to = asset.metadata?.verse?.to;

    // Add separator when verse range changes
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

  // Build unassigned block (assets without verse metadata)
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

  // Insert separators that target a specific asset
  for (const sep of separatorsWithAssetId) {
    if (!sep.assetId) continue;

    const assetIndex = result.findIndex(
      (item) => item.type === 'asset' && item.content.id === sep.assetId
    );

    const sepItem: ListItemSeparator = {
      type: 'separator',
      from: sep.from,
      to: sep.to,
      key: sep.key
    };

    if (assetIndex !== -1) {
      result.splice(assetIndex, 0, sepItem);
    } else {
      // Asset is in unassignedBlock, insert at end of result
      result.push(sepItem);
    }
  }

  // Insert separators without assetId by verse order
  for (const sep of sortedSeparatorsWithoutAssetId) {
    const sepItem: ListItemSeparator = {
      type: 'separator',
      from: sep.from,
      to: sep.to,
      key: sep.key
    };

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

  // Combine: result + unassigned block
  const combined: ListItem[] = [...result, ...unassignedBlock];

  // Build set of manual separator ranges for deduplication
  const manualSeparatorRanges = new Set<string>();
  const manualSeparatorKeys = new Set<string>();
  for (const sep of allManualSeparators) {
    manualSeparatorRanges.add(`${sep.from ?? 'none'}-${sep.to ?? 'none'}`);
    manualSeparatorKeys.add(sep.key);
  }

  // Deduplicate separators (prefer manual over auto-generated)
  const seenSeparatorRanges = new Set<string>();
  const deduped: ListItem[] = [];

  for (const item of combined) {
    if (item.type === 'separator') {
      const sepRange = `${item.from ?? 'none'}-${item.to ?? 'none'}`;
      const isManualSeparator = manualSeparatorKeys.has(item.key);
      const hasManualSeparatorForRange = manualSeparatorRanges.has(sepRange);

      // Skip if we've already seen this range
      if (seenSeparatorRanges.has(sepRange)) {
        continue;
      }

      // Skip auto-generated if manual exists for this range
      if (!isManualSeparator && hasManualSeparatorForRange) {
        continue;
      }

      seenSeparatorRanges.add(sepRange);
    }
    deduped.push(item);
  }

  return deduped;
}

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

  // Selection mode for batch operations
  const {
    isSelectionMode,
    selectedAssetIds,
    enterSelection,
    toggleSelect,
    cancelSelection
  } = useSelectionMode();
  const [debouncedSearchQuery, searchQuery, setSearchQuery] = useDebouncedState(
    '',
    300
  );
  const { t } = useLocalization();
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showOffloadDrawer, setShowOffloadDrawer] = React.useState(false);
  const [showDeleteAllDrawer, setShowDeleteAllDrawer] = React.useState(false);
  const [verseSelectorState, setVerseSelectorState] = React.useState<{
    isOpen: boolean;
    key: string | null;
    from?: number;
    to?: number;
  }>({ isOpen: false, key: null });

  // State for adding new label (not editing existing)
  const [newLabelSelectorState, setNewLabelSelectorState] = React.useState<{
    isOpen: boolean;
    from?: number;
    to?: number;
  }>({ isOpen: false });

  // State for adding verse label above a specific asset
  const [assetVerseSelectorState, setAssetVerseSelectorState] = React.useState<{
    isOpen: boolean;
    assetId: string | null;
    from?: number;
    to?: number;
  }>({ isOpen: false, assetId: null });

  // State for editing an existing separator
  const [editSeparatorState, setEditSeparatorState] = React.useState<{
    isOpen: boolean;
    separatorKey: string | null;
    from?: number;
    to?: number;
  }>({ isOpen: false, separatorKey: null });

  // State for renaming assets
  const [showRenameDrawer, setShowRenameDrawer] = React.useState(false);
  const [renameAssetId, setRenameAssetId] = React.useState<string | null>(null);
  const [renameAssetName, setRenameAssetName] = React.useState<string>('');

  // State for batch verse assignment
  const [showVerseAssignerDrawer, setShowVerseAssignerDrawer] =
    React.useState(false);

  // Manual verse separators created by the user
  const [manualSeparators, setManualSeparators] = React.useState<
    { from: number; to: number; key: string; assetId?: string }[]
  >([]);

  // Track which separators have been processed for auto-assignment
  const processedSeparatorsRef = React.useRef<Set<string>>(new Set());

  // Function to add a new verse separator
  // If assetId is provided, insert the separator right above that asset
  const addVerseSeparator = React.useCallback(
    (from: number, to: number, assetId?: string) => {
      const newSeparator = {
        from,
        to,
        key: `manual-sep-${from}-${to}-${Date.now()}`,
        assetId // Store assetId to know where to insert it
      };
      setManualSeparators((prev) => [...prev, newSeparator]);
    },
    []
  );

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
  // Ref to allow handlePlayAsset to be used in renderItem before it's defined
  const handlePlayAssetRef = React.useRef<
    (assetId: string) => void | Promise<void>
  >((_assetId: string) => {
    // No-op: will be replaced by handlePlayAsset when defined
  });

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

  // Check if quest is published (source is 'synced')
  const isPublished = selectedQuest?.source === 'synced';

  // Store book name and chapter number for VerseSeparator label
  const bookChapterLabelRef = React.useRef<string>('Verse');

  // Calculate book chapter label (short name for separators)
  const bookChapterLabel = React.useMemo(() => {
    if (!selectedQuest || !currentBookId) {
      return 'Verse';
    }

    // Extract chapter number from metadata.bible.chapter
    let chapterNum: number | undefined;
    if (selectedQuest.metadata) {
      try {
        const metadata: unknown =
          typeof selectedQuest.metadata === 'string'
            ? JSON.parse(selectedQuest.metadata)
            : selectedQuest.metadata;
        if (
          metadata &&
          typeof metadata === 'object' &&
          'bible' in metadata &&
          metadata.bible &&
          typeof metadata.bible === 'object' &&
          'chapter' in metadata.bible
        ) {
          chapterNum =
            typeof metadata.bible.chapter === 'number'
              ? metadata.bible.chapter
              : undefined;
        }
      } catch {
        // Ignore parse errors
      }
    }

    if (typeof chapterNum !== 'number') return 'Verse';
    const book = BIBLE_BOOKS.find((b) => b.id === currentBookId);

    if (book?.name && chapterNum) {
      return `${book.shortName} ${chapterNum}`;
    }

    return 'Verse';
  }, [selectedQuest, currentBookId]);

  // Update ref when label changes
  React.useEffect(() => {
    bookChapterLabelRef.current = bookChapterLabel;
  }, [bookChapterLabel]);

  // Get verse count for current chapter
  // Use selectedQuest instead of currentQuestData to ensure we have the metadata from the database
  const verseCount = React.useMemo(() => {
    if (!selectedQuest || !currentBookId) return 0;

    // Extract chapter number from metadata.bible.chapter
    let chapterNum: number | undefined;
    if (selectedQuest.metadata) {
      try {
        const metadata: unknown =
          typeof selectedQuest.metadata === 'string'
            ? JSON.parse(selectedQuest.metadata)
            : selectedQuest.metadata;
        if (
          metadata &&
          typeof metadata === 'object' &&
          'bible' in metadata &&
          metadata.bible &&
          typeof metadata.bible === 'object' &&
          'chapter' in metadata.bible
        ) {
          chapterNum =
            typeof metadata.bible.chapter === 'number'
              ? metadata.bible.chapter
              : undefined;
        }
      } catch {
        // Ignore parse errors
      }
    }

    if (typeof chapterNum !== 'number') return 0;
    const book = BIBLE_BOOKS.find((b) => b.id === currentBookId);
    return book?.verses[chapterNum - 1] ?? 0;
  }, [selectedQuest, currentBookId]);

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

  // Track selected item for recording insertion
  // Can be an asset (insert after) or a separator (insert at beginning of verse)
  const [selectedForRecording, setSelectedForRecording] = React.useState<{
    type: 'asset' | 'separator';
    assetId?: string; // Only for type === 'asset'
    separatorKey?: string; // Only for type === 'separator'
    orderIndex: number;
    metadata: AssetMetadata | null;
    verseName: string; // e.g., "1:5" or "1:5-7"
  } | null>(null);

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

  // Call both hooks unconditionally to comply with React Hooks rules
  const publishedAssets = useAssetsByQuest(
    currentQuestId || '',
    debouncedSearchQuery,
    showInvisibleContent
  );
  const localAssets = useLocalAssetsByQuest(
    currentQuestId || '',
    debouncedSearchQuery,
    showInvisibleContent
  );

  // Use the appropriate hook result based on isPublished condition
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching,
    refetch
    //} = publishedAssets;
  } = isPublished ? publishedAssets : localAssets;

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

  // Infinite scroll - load more when reaching end of list
  const loadMoreAssets = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      const { layoutMeasurement, contentOffset, contentSize } = event;
      const paddingToBottom = 200; // pixels before end to trigger loading

      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom;

      if (isCloseToBottom) {
        runOnJS(loadMoreAssets)();
      }
    }
  });

  // ============================================================================
  // OPTIMIZED LIST BUILDING - Split into smaller memoized steps
  // ============================================================================

  // Step 1: Separate and sort assets with metadata (only recomputes when assets change)
  const assetsWithMeta = React.useMemo(() => {
    const filtered = assets.filter((a) => a.metadata?.verse?.from != null);
    // Sort by verse.from first, then by order_index within each verse group
    // This preserves the user's ordering within each verse
    return [...filtered].sort((a, b) => {
      const aFrom = a.metadata?.verse?.from ?? 0;
      const bFrom = b.metadata?.verse?.from ?? 0;
      if (aFrom !== bFrom) {
        return aFrom - bFrom;
      }
      // Same verse - sort by order_index to maintain user's ordering
      return (a.order_index ?? 0) - (b.order_index ?? 0);
    });
  }, [assets]);

  // Step 2: Get assets without metadata (only recomputes when assets change)
  // Sorted by order_index to maintain user's ordering
  const assetsWithoutMeta = React.useMemo(() => {
    return assets
      .filter((a) => a.metadata?.verse?.from == null)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }, [assets]);

  // Calculate the last order_index for unassigned assets (verse 999)
  // This is used when opening BibleRecordingView without a selected verse
  // to continue from where we left off instead of starting from DEFAULT_ORDER_INDEX
  const lastUnassignedOrderIndex = React.useMemo(() => {
    if (assetsWithoutMeta.length === 0) {
      return undefined; // No unassigned assets, use default
    }
    // Get the highest order_index from unassigned assets
    const lastAsset = assetsWithoutMeta[assetsWithoutMeta.length - 1];
    return lastAsset?.order_index;
  }, [assetsWithoutMeta]);

  // Step 3: Split manual separators by type (only recomputes when separators change)
  const separatorsWithAssetId = React.useMemo(() => {
    return manualSeparators.filter((sep) => sep.assetId);
  }, [manualSeparators]);

  const sortedSeparatorsWithoutAssetId = React.useMemo(() => {
    return manualSeparators
      .filter((sep) => !sep.assetId)
      .sort((a, b) => a.from - b.from);
  }, [manualSeparators]);

  // Step 4: Build final list using pure function (recomputes only when dependencies change)
  const listItems = React.useMemo((): ListItem[] => {
    return buildFinalList(
      assetsWithMeta,
      assetsWithoutMeta,
      separatorsWithAssetId,
      sortedSeparatorsWithoutAssetId,
      manualSeparators
    );
  }, [
    assetsWithMeta,
    assetsWithoutMeta,
    separatorsWithAssetId,
    sortedSeparatorsWithoutAssetId,
    manualSeparators
  ]);

  // Keep a ref to assets for stable callback (avoids recreating on every asset change)
  const assetsRef = React.useRef(assets);
  React.useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  // Handler for selecting/deselecting an asset for recording insertion
  // Optimized with ref to avoid recreation on every asset change
  const handleSelectForRecording = React.useCallback(
    (assetId: string) => {
      // Toggle: if same asset clicked, deselect
      if (
        selectedForRecording?.type === 'asset' &&
        selectedForRecording?.assetId === assetId
      ) {
        setSelectedForRecording(null);
        return;
      }

      // Find the asset using ref (stable across renders)
      const asset = assetsRef.current.find((a) => a.id === assetId);

      if (!asset) {
        console.warn('Asset not found:', assetId);
        return;
      }

      const metadata = asset.metadata as AssetMetadata | null;
      const orderIndex = asset.order_index ?? 0;

      // Build verse name from metadata
      let verseName = '';
      if (metadata?.verse) {
        const { from, to } = metadata.verse;
        if (from === to || to === undefined) {
          verseName = `${from}`;
        } else {
          verseName = `${from}-${to}`;
        }
      }

      setSelectedForRecording({
        type: 'asset',
        assetId,
        orderIndex,
        metadata,
        verseName
      });
    },
    [selectedForRecording?.type, selectedForRecording?.assetId]
  );

  // Handler for selecting/deselecting a separator for recording insertion
  // When a separator is selected, recordings start at the BEGINNING of that verse
  // order_index = verse * 1000 * 1000 (e.g., verse 7 → 7000000)
  const handleSelectSeparatorForRecording = React.useCallback(
    (separatorKey: string, from?: number, to?: number) => {
      // Toggle: if same separator clicked, deselect
      if (
        selectedForRecording?.type === 'separator' &&
        selectedForRecording?.separatorKey === separatorKey
      ) {
        setSelectedForRecording(null);
        return;
      }

      // Calculate order_index: verse * 1000 * 1000 to position BEFORE first asset
      // For unassigned (sep-unassigned), use 999
      const verse = from ?? 999;
      const orderIndex = verse * 1000 * 1000;

      // Build verse name
      let verseName = '';
      if (from !== undefined) {
        if (from === to || to === undefined) {
          verseName = `${from}`;
        } else {
          verseName = `${from}-${to}`;
        }
      }

      // Build metadata
      const metadata: AssetMetadata | null =
        from !== undefined ? { verse: { from, to: to ?? from } } : null;

      setSelectedForRecording({
        type: 'separator',
        separatorKey,
        orderIndex,
        metadata,
        verseName
      });

      console.log(
        `🎯 Selected separator for recording | verse: ${verse} | orderIndex: ${orderIndex} | verseName: "${verseName}"`
      );
    },
    [selectedForRecording?.type, selectedForRecording?.separatorKey]
  );

  // Handle batch delete of selected assets
  // Handle delete all assets
  const handleDeleteAllAssets = React.useCallback(async () => {
    if (!currentQuestId) return;

    // Filter assets that are local (not cloud-only)
    const localAssets = assets.filter((a) => a.source !== 'cloud');

    if (localAssets.length < 1) {
      RNAlert.alert(t('info'), 'No local assets to delete.');
      return;
    }

    try {
      console.log(`🗑️ Starting deletion of ${localAssets.length} assets...`);

      for (const asset of localAssets) {
        await audioSegmentService.deleteAudioSegment(asset.id);
      }

      // Reset the name counter for this quest
      const counterKey = `bible_recording_counter_${currentQuestId}`;
      await AsyncStorage.removeItem(counterKey);
      console.log(
        `🔄 Name counter reset for quest ${currentQuestId.slice(0, 8)}`
      );

      setSelectedForRecording(null);
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void refetch();

      console.log(
        `✅ Delete all completed: ${localAssets.length} assets deleted`
      );
      RNAlert.alert(
        t('success'),
        `${localAssets.length} assets deleted successfully.`
      );
    } catch (e) {
      console.error('Failed to delete all assets', e);
      RNAlert.alert(t('error'), 'Failed to delete assets. Please try again.');
    }
  }, [assets, currentQuestId, queryClient, t, refetch]);

  const handleBatchDeleteSelected = React.useCallback(() => {
    // Filter selected assets that are local (not cloud-only)
    const selectedAssets = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );

    if (selectedAssets.length < 1) return;

    RNAlert.alert(
      'Delete Assets',
      `Are you sure you want to delete ${selectedAssets.length} asset${selectedAssets.length > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                for (const asset of selectedAssets) {
                  await audioSegmentService.deleteAudioSegment(asset.id);
                }

                cancelSelection();
                setSelectedForRecording(null);
                void queryClient.invalidateQueries({ queryKey: ['assets'] });
                void refetch();

                console.log(
                  `✅ Batch delete completed: ${selectedAssets.length} assets`
                );
              } catch (e) {
                console.error('Failed to batch delete assets', e);
                RNAlert.alert(
                  t('error'),
                  'Failed to delete assets. Please try again.'
                );
              }
            })();
          }
        }
      ]
    );
  }, [assets, selectedAssetIds, cancelSelection, queryClient, t, refetch]);

  // Handle batch merge of selected assets
  const handleBatchMergeSelected = React.useCallback(() => {
    // Filter selected assets that are local (not cloud-only)
    const selectedAssets = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );

    if (selectedAssets.length < 2) return;

    RNAlert.alert(
      'Merge Assets',
      `Are you sure you want to merge ${selectedAssets.length} assets? The audio segments will be combined into the first selected asset, and the others will be deleted.`,
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: 'Merge',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                if (!currentUser) return;

                const target = selectedAssets[0]!;
                const rest = selectedAssets.slice(1);
                const contentLocal = resolveTable('asset_content_link', {
                  localOverride: true
                });

                for (const src of rest) {
                  // Find all content links for the source asset
                  const srcContent = await system.db
                    .select()
                    .from(asset_content_link)
                    .where(eq(asset_content_link.asset_id, src.id));

                  // Insert them for the target asset
                  for (const c of srcContent) {
                    if (!c.audio) continue;
                    await system.db.insert(contentLocal).values({
                      asset_id: target.id,
                      source_language_id: c.source_language_id,
                      languoid_id:
                        c.languoid_id ?? c.source_language_id ?? null,
                      text: c.text || '',
                      audio: c.audio,
                      download_profiles: [currentUser.id]
                    });
                  }

                  // Delete the source asset
                  await audioSegmentService.deleteAudioSegment(src.id);
                }

                cancelSelection();
                setSelectedForRecording(null);
                void queryClient.invalidateQueries({ queryKey: ['assets'] });
                void refetch();

                console.log(
                  `✅ Batch merge completed: ${selectedAssets.length} assets merged into ${target.id.slice(0, 8)}`
                );
              } catch (e) {
                console.error('Failed to batch merge assets', e);
                RNAlert.alert(
                  t('error'),
                  'Failed to merge assets. Please try again.'
                );
              }
            })();
          }
        }
      ]
    );
  }, [
    assets,
    selectedAssetIds,
    currentUser,
    cancelSelection,
    queryClient,
    t,
    refetch
  ]);

  // ============================================================================
  // RENAME ASSET
  // ============================================================================

  const handleRenameAsset = React.useCallback(
    (assetId: string, currentName: string | null) => {
      setRenameAssetId(assetId);
      setRenameAssetName(currentName ?? '');
      setShowRenameDrawer(true);
    },
    []
  );

  const handleSaveRename = React.useCallback(
    async (newName: string) => {
      if (!renameAssetId) return;

      try {
        // renameAsset will validate that this is a local-only asset
        // and throw if it's synced (immutable)
        await renameAsset(renameAssetId, newName);

        // Invalidate queries to refresh the list
        void queryClient.invalidateQueries({ queryKey: ['assets'] });
        void refetch();

      } catch (error) {
        console.error('❌ Failed to rename asset:', error);
        if (error instanceof Error) {
          console.warn('⚠️ Rename blocked:', error.message);
          RNAlert.alert(t('error'), error.message);
        }
      }
    },
    [renameAssetId, queryClient, refetch, t]
  );

  // Auto-assign labels to assets when a separator is created with assetId
  React.useEffect(() => {
    const processNewSeparators = async () => {
      // Find separators with assetId that haven't been processed yet
      const unprocessedSeparators = manualSeparators.filter(
        (sep) => sep.assetId && !processedSeparatorsRef.current.has(sep.key)
      );

      if (unprocessedSeparators.length === 0) return;

      // Process each unprocessed separator
      for (const separator of unprocessedSeparators) {
        if (!separator.assetId) continue;

        // Mark as processed immediately to avoid duplicate processing
        processedSeparatorsRef.current.add(separator.key);

        // Find the target asset to determine its position
        const targetAsset = assets.find((a) => a.id === separator.assetId);
        if (!targetAsset) {
          console.warn(
            `⚠️ Asset ${separator.assetId} not found in assets list, skipping auto-assignment`
          );
          processedSeparatorsRef.current.delete(separator.key);
          continue;
        }

        // Check if asset is in unassigned (no metadata)
        const isUnassigned = !targetAsset.metadata?.verse?.from;

        // Find all assets to update (with order_index calculation)
        const assetsToUpdate: AssetUpdatePayload[] = [];
        let sequentialInGroup = 1; // Start at 1 (e.g., verse 7 → 7001, 7002...)

        if (isUnassigned) {
          // Asset is in unassigned block - find it and all assets below it
          // until we hit another separator or the end
          const targetAssetIndex = listItems.findIndex(
            (item) =>
              item.type === 'asset' && item.content.id === separator.assetId
          );

          if (targetAssetIndex === -1) {
            console.warn(
              `⚠️ Asset ${separator.assetId} not found in listItems, skipping`
            );
            processedSeparatorsRef.current.delete(separator.key);
            continue;
          }

          // Start from the target asset and go down
          for (let i = targetAssetIndex; i < listItems.length; i++) {
            const item = listItems[i];
            if (!item) continue;

            // Stop if we encounter a separator (not the "No Verse Assigned" separator)
            if (
              item.type === 'separator' &&
              item.key !== 'sep-unassigned' &&
              item.key !== separator.key
            ) {
              break;
            }

            // If it's an asset, add it to the update list with order_index
            if (item.type === 'asset') {
              const newOrderIndex =
                (separator.from * 1000 + sequentialInGroup) * 1000;
              sequentialInGroup++;

              assetsToUpdate.push({
                assetId: item.content.id,
                metadata: {
                  verse: {
                    from: separator.from,
                    to: separator.to ?? separator.from
                  }
                },
                order_index: newOrderIndex
              });

            }
          }
        } else {
          // Asset already has metadata - find separator and assets below it
          const separatorIndex = listItems.findIndex(
            (item) => item.type === 'separator' && item.key === separator.key
          );

          if (separatorIndex === -1) {
            console.warn(
              `⚠️ Separator ${separator.key} not found in listItems, skipping`
            );
            processedSeparatorsRef.current.delete(separator.key);
            continue;
          }

          // Start from the position right after the separator
          for (let i = separatorIndex + 1; i < listItems.length; i++) {
            const item = listItems[i];
            if (!item) continue;

            // Stop if we encounter another separator
            if (item.type === 'separator') {
              break;
            }

            // If it's an asset, add it to the update list with order_index
            if (item.type === 'asset') {
              const newOrderIndex =
                (separator.from * 1000 + sequentialInGroup) * 1000;
              sequentialInGroup++;

              assetsToUpdate.push({
                assetId: item.content.id,
                metadata: {
                  verse: {
                    from: separator.from,
                    to: separator.to ?? separator.from
                  }
                },
                order_index: newOrderIndex
              });

            }
          }
        }

        // Batch update all affected assets
        if (assetsToUpdate.length > 0) {
          try {
            await batchUpdateAssetMetadata(assetsToUpdate);

            // Invalidate queries to refresh the UI
            void queryClient.invalidateQueries({ queryKey: ['assets'] });
            void refetch();
          } catch (err: unknown) {
            console.error('Failed to update asset metadata:', err);
            // Remove from processed set so it can be retried
            processedSeparatorsRef.current.delete(separator.key);
          }
        } else {
          console.warn(
            `⚠️ No assets found below separator ${separator.key} to update`
          );
        }
      }
    };

    void processNewSeparators();
  }, [manualSeparators, listItems, assets, queryClient, refetch]);

  // Clean up manual separators that have been persisted to asset metadata
  // This ensures the UI correctly reflects which verses are available after metadata updates
  React.useEffect(() => {
    // Find manual separators that have been processed and can be removed
    // A separator can be removed if:
    // 1. It has been processed (metadata was updated for assets below it), OR
    // 2. Its range is already covered by auto-generated separators from asset metadata
    const separatorsToRemove: string[] = [];

    for (const sep of manualSeparators) {
      // If this separator was already processed, it can be removed
      // The auto-generated separators from asset metadata will take over
      if (processedSeparatorsRef.current.has(sep.key)) {
        separatorsToRemove.push(sep.key);
        continue;
      }

      // Also check if any asset already has metadata with this exact verse range
      // This handles cases where metadata was updated outside of the normal flow
      // (e.g., via _handleSorting)
      const hasMatchingAsset = assets.some((asset) => {
        const metadata = asset.metadata;
        if (!metadata?.verse) return false;
        return metadata.verse.from === sep.from && metadata.verse.to === sep.to;
      });

      if (hasMatchingAsset) {
        separatorsToRemove.push(sep.key);
      }
    }

    if (separatorsToRemove.length > 0) {
      console.log(
        `🧹 Cleaning up ${separatorsToRemove.length} manual separator(s) that are now persisted in asset metadata`
      );
      setManualSeparators((prev) =>
        prev.filter((sep) => !separatorsToRemove.includes(sep.key))
      );
      // Also clean up the processed refs
      for (const key of separatorsToRemove) {
        processedSeparatorsRef.current.delete(key);
      }
    }
  }, [assets, manualSeparators]);

  // Function to update an existing separator and all assets below it (until next separator)
  const updateVerseSeparator = React.useCallback(
    async (
      separatorKey: string,
      oldFrom: number | undefined,
      oldTo: number | undefined,
      newFrom: number,
      newTo: number
    ) => {
      // Update the separator in state
      setManualSeparators((prev) =>
        prev.map((sep) =>
          sep.key === separatorKey ? { ...sep, from: newFrom, to: newTo } : sep
        )
      );

      // Find the separator in the listItems to get its position
      const separatorIndex = listItems.findIndex(
        (item) => item.type === 'separator' && item.key === separatorKey
      );

      if (separatorIndex === -1) {
        console.warn(
          `⚠️ Separator ${separatorKey} not found in listItems, skipping asset update`
        );
        return;
      }

      // Find all assets below this separator until we hit another separator
      const assetsToUpdate: AssetUpdatePayload[] = [];
      let sequentialInGroup = 1; // Start at 1 (e.g., verse 7 → 7001, 7002...)

      for (let i = separatorIndex + 1; i < listItems.length; i++) {
        const item = listItems[i];
        if (!item) continue;

        // Stop if we encounter another separator
        if (item.type === 'separator') {
          break;
        }

        // If it's an asset, add it to the update list with order_index
        if (item.type === 'asset') {
          const newOrderIndex = (newFrom * 1000 + sequentialInGroup) * 1000;
          sequentialInGroup++;

          assetsToUpdate.push({
            assetId: item.content.id,
            metadata: {
              verse: {
                from: newFrom,
                to: newTo
              }
            },
            order_index: newOrderIndex
          });

        }
      }

      // Batch update all affected assets
      if (assetsToUpdate.length > 0) {
        try {
          await batchUpdateAssetMetadata(assetsToUpdate);
          console.log(
            `✅ Updated ${assetsToUpdate.length} asset(s) below separator with new verse range ${newFrom}-${newTo} (with order_index)`
          );

          // Invalidate queries to refresh the UI
          void queryClient.invalidateQueries({ queryKey: ['assets'] });
          void refetch();
        } catch (err: unknown) {
          console.error('Failed to update asset metadata:', err);
        }
      } else {
        console.warn(
          `⚠️ No assets found below separator ${separatorKey} to update`
        );
      }
    },
    [listItems, queryClient, refetch]
  );

  // Compute the allowed range for a new separator based on existing separators
  // The AddVerseLabelButton is above the current separator, so:
  // - rangeFrom = previous separator's "to" + 1 (or 1 if no previous)
  // - rangeTo = CURRENT separator's "from" - 1 (or verseCount if current has no "from")
  // Note: Currently unused but kept for potential future use
  const _computeAllowedRange = React.useCallback(
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

      return { from: finalFrom, to: finalTo };
    },
    [listItems, verseCount]
  );

  // Compute available ranges for a new label (not editing existing)
  // Returns all gaps between existing separators
  // Note: Currently unused but kept for potential future use
  const _computeAvailableRanges = React.useCallback(() => {
    const ranges: { from: number; to: number }[] = [];

    // Get all separators with valid from/to values, sorted by 'from'
    const separators = listItems
      .filter(
        (item): item is ListItemSeparator =>
          item.type === 'separator' &&
          item.from !== undefined &&
          item.to !== undefined
      )
      .sort((a, b) => (a.from ?? 0) - (b.from ?? 0));

    // First gap: from 1 to first separator's from - 1
    if (separators.length > 0) {
      const first = separators[0];
      if (first?.from !== undefined) {
        const firstFrom = first.from;
        if (firstFrom > 1) {
          ranges.push({ from: 1, to: firstFrom - 1 });
        }
      }
    } else {
      // No separators, entire range is available
      ranges.push({ from: 1, to: verseCount || 1 });
    }

    // Gaps between separators
    for (let i = 0; i < separators.length - 1; i++) {
      const current = separators[i];
      const next = separators[i + 1];
      if (
        current &&
        next &&
        current.to !== undefined &&
        next.from !== undefined &&
        current.to < next.from - 1
      ) {
        ranges.push({ from: current.to + 1, to: next.from - 1 });
      }
    }

    // Last gap: from last separator's to + 1 to verseCount
    if (separators.length > 0) {
      const last = separators[separators.length - 1];
      if (last?.to !== undefined && last.to < (verseCount || 1)) {
        ranges.push({ from: last.to + 1, to: verseCount || 1 });
      }
    }

    return ranges;
  }, [listItems, verseCount]);

  // Get all available verses (not occupied by separators)
  const getAvailableVerses = React.useCallback(() => {
    const occupiedVerses = new Set<number>();

    // Get all separators with valid from/to values
    const separators = listItems.filter(
      (item): item is ListItemSeparator =>
        item.type === 'separator' &&
        item.from !== undefined &&
        item.to !== undefined
    );

    // Mark all occupied verses
    for (const sep of separators) {
      if (sep.from !== undefined && sep.to !== undefined) {
        for (let verse = sep.from; verse <= sep.to; verse++) {
          occupiedVerses.add(verse);
        }
      }
    }

    // Return array of available verses (1 to verseCount, excluding occupied)
    const available: number[] = [];
    for (let verse = 1; verse <= (verseCount || 1); verse++) {
      if (!occupiedVerses.has(verse)) {
        available.push(verse);
      }
    }

    return available;
  }, [listItems, verseCount]);

  // Given a selected 'from' value, find the maximum 'to' value allowed
  // This prevents overlapping ranges by limiting to the next occupied verse
  const getMaxToForFrom = React.useCallback(
    (selectedFrom: number) => {
      const availableVerses = getAvailableVerses();

      // Find the index of selectedFrom in available verses
      const fromIndex = availableVerses.indexOf(selectedFrom);
      if (fromIndex === -1) {
        // If selectedFrom is not available, return selectedFrom
        return selectedFrom;
      }

      // Find the next occupied verse after the available range
      // We need to find where the next separator starts
      const separators = listItems
        .filter(
          (item): item is ListItemSeparator =>
            item.type === 'separator' &&
            item.from !== undefined &&
            item.to !== undefined
        )
        .sort((a, b) => (a.from ?? 0) - (b.from ?? 0));

      // Find the first separator that starts after selectedFrom
      const nextSeparator = separators.find(
        (sep) => sep.from !== undefined && sep.from > selectedFrom
      );

      if (nextSeparator?.from !== undefined) {
        // Return the verse just before the next separator
        return nextSeparator.from - 1;
      }

      // No separator after selectedFrom, can go to the end
      return verseCount || 1;
    },
    [getAvailableVerses, listItems, verseCount]
  );

  // Get existing labels from separators for quick selection in VerseAssigner
  const existingLabels = React.useMemo(() => {
    const labels: { from: number; to: number }[] = [];
    const seen = new Set<string>();

    for (const item of listItems) {
      if (
        item.type === 'separator' &&
        item.from !== undefined &&
        item.to !== undefined
      ) {
        const key = `${item.from}-${item.to}`;
        if (!seen.has(key)) {
          seen.add(key);
          labels.push({ from: item.from, to: item.to });
        }
      }
    }

    // Sort by from value
    return labels.sort((a, b) => a.from - b.from);
  }, [listItems]);

  // Calculate nextVerse and limitVerse for automatic progression
  const { nextVerse, limitVerse } = React.useMemo(() => {
    // If no verse count, can't calculate
    if (!verseCount || verseCount === 0) {
      return { nextVerse: null, limitVerse: null };
    }

    // Get the current verse range from selectedForRecording
    const currentVerse = selectedForRecording?.metadata?.verse;

    // If no labels exist yet, start from verse 1
    if (existingLabels.length === 0) {
      const result = { nextVerse: 1, limitVerse: verseCount };
      return result;
    }

    // If no selection or no verse in selection, find the last gap
    if (!currentVerse) {
      // Find the last occupied verse
      const lastLabel = existingLabels[existingLabels.length - 1];
      if (!lastLabel) {
        const result = { nextVerse: 1, limitVerse: verseCount };
        return result;
      }

      // If there's space after the last label
      if (lastLabel.to < verseCount) {
        const result = { nextVerse: lastLabel.to + 1, limitVerse: verseCount };
        return result;
      }

      // No space available
      const result = { nextVerse: null, limitVerse: null };
      return result;
    }

    // Find the next available verse after the current selection
    const currentTo = currentVerse.to;

    // Find the next label that starts after currentTo
    const nextLabel = existingLabels.find((label) => label.from > currentTo);

    if (nextLabel) {
      // There's a next label - check if there's space between current and next
      if (currentTo + 1 < nextLabel.from) {
        // There's a gap
        const result = {
          nextVerse: currentTo + 1,
          limitVerse: nextLabel.from - 1
        };
        return result;
      } else {
        // No gap - next verse is already occupied
        const result = { nextVerse: null, limitVerse: null };
        return result;
      }
    } else {
      // No next label - check if there's space until the end
      if (currentTo < verseCount) {
        const result = { nextVerse: currentTo + 1, limitVerse: verseCount };
        return result;
      } else {
        // Already at the end
        const result = { nextVerse: null, limitVerse: null };
        return result;
      }
    }
  }, [selectedForRecording, existingLabels, verseCount]);

  // Check if any selected assets already have labels
  const selectedAssetsHaveLabels = React.useMemo(() => {
    for (const assetId of selectedAssetIds) {
      const asset = assets.find((a) => a.id === assetId);
      if (asset?.metadata) {
        try {
          const meta =
            typeof asset.metadata === 'string'
              ? (JSON.parse(asset.metadata) as AssetMetadata | null)
              : (asset.metadata as AssetMetadata | null);
          if (meta?.verse?.from !== undefined) {
            return true;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    return false;
  }, [selectedAssetIds, assets]);

  // Handle applying verse label to selected assets
  const handleAssignVerseToSelected = React.useCallback(
    async (from: number, to: number) => {
      const selectedAssets = assets.filter(
        (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
      );

      if (selectedAssets.length === 0) return;

      try {
        const verseBase = from;
        const minOrderIndex = verseBase * 1000 * 1000;
        const maxOrderIndex = (verseBase + 1) * 1000 * 1000 - 1;

        // Find the highest order_index already assigned to this verse
        // (excluding selected assets since they might be moving from another verse)
        let lastSequential = 0;
        for (const asset of assets) {
          if (selectedAssetIds.has(asset.id)) continue; // Skip assets being reassigned
          if (
            asset.order_index >= minOrderIndex &&
            asset.order_index <= maxOrderIndex
          ) {
            // Extract sequential part: order_index = (verseBase * 1000 + seq) * 1000
            // seq = (order_index / 1000) - (verseBase * 1000)
            const seq = Math.floor(asset.order_index / 1000) - verseBase * 1000;
            if (seq > lastSequential) {
              lastSequential = seq;
            }
          }
        }

        // Calculate order_index continuing from the last existing asset
        const updates: AssetUpdatePayload[] = selectedAssets.map(
          (asset, index) => ({
            assetId: asset.id,
            metadata: {
              verse: { from, to }
            },
            order_index:
              (verseBase * 1000 + (lastSequential + index + 1)) * 1000
          })
        );

        await batchUpdateAssetMetadata(updates);

        console.log(
          `✅ Assigned verse ${from}-${to} to ${selectedAssets.length} asset(s)`
        );

        // Close drawer and clear selection
        setShowVerseAssignerDrawer(false);
        cancelSelection();
        setSelectedForRecording(null);

        // Refresh the list
        void queryClient.invalidateQueries({ queryKey: ['assets'] });
        void refetch();
      } catch (error) {
        console.error('Failed to assign verse to assets:', error);
        RNAlert.alert(t('error'), 'Failed to assign verse. Please try again.');
      }
    },
    [assets, selectedAssetIds, cancelSelection, queryClient, refetch, t]
  );

  // Handle removing labels from selected assets
  const handleRemoveLabelFromSelected = React.useCallback(async () => {
    const selectedAssets = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );

    if (selectedAssets.length === 0) return;

    try {
      const verseBase = UNASSIGNED_VERSE_BASE;
      const minOrderIndex = verseBase * 1000 * 1000;
      const maxOrderIndex = (verseBase + 1) * 1000 * 1000 - 1;

      // Find the highest order_index among unassigned assets
      let lastSequential = 0;
      for (const asset of assets) {
        if (selectedAssetIds.has(asset.id)) continue; // Skip assets being moved
        if (
          asset.order_index >= minOrderIndex &&
          asset.order_index <= maxOrderIndex
        ) {
          const seq = Math.floor(asset.order_index / 1000) - verseBase * 1000;
          if (seq > lastSequential) {
            lastSequential = seq;
          }
        }
      }

      console.log(
        `📊 Unassigned (${verseBase}): last sequential = ${lastSequential}, moving ${selectedAssets.length} asset(s) starting at ${lastSequential + 1}`
      );

      // Set metadata to null and assign order_index at end of unassigned list
      const updates: AssetUpdatePayload[] = selectedAssets.map(
        (asset, index) => ({
          assetId: asset.id,
          metadata: null,
          order_index: (verseBase * 1000 + (lastSequential + index + 1)) * 1000
        })
      );

      await batchUpdateAssetMetadata(updates);

      console.log(`✅ Removed labels from ${selectedAssets.length} asset(s)`);

      // Close drawer and clear selection
      setShowVerseAssignerDrawer(false);
      cancelSelection();
      setSelectedForRecording(null);

      // Refresh the list
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void refetch();
    } catch (error) {
      console.error('Failed to remove labels from assets:', error);
      RNAlert.alert(t('error'), 'Failed to remove labels. Please try again.');
    }
  }, [assets, selectedAssetIds, cancelSelection, queryClient, refetch, t]);

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

  // ============================================================================
  // ORDER_INDEX NORMALIZATION
  // When returning from BibleRecordingView, normalize order_index for recorded verses
  // Recording uses unit scale (7001001, 7001002) but Assets view uses thousand scale (7001000, 7002000)
  // This function reads assets from DB and reassigns order_index with thousand scale
  // ============================================================================
  const normalizeOrderIndexForVerses = React.useCallback(
    async (verses: number[]) => {
      if (!currentQuestId || verses.length === 0) return;

      const assetTable = resolveTable('asset', { localOverride: true });
      const questAssetLinkTable = resolveTable('quest_asset_link', {
        localOverride: true
      });

      for (const verse of verses) {
        // Calculate order_index range for this verse
        // Formula: verse * 1000 * 1000 to (verse + 1) * 1000 * 1000 - 1
        // Example: verse 7 → 7000000 to 7999999
        const minOrderIndex = verse * 1000 * 1000;
        const maxOrderIndex = (verse + 1) * 1000 * 1000 - 1;

        try {
          // Query assets by order_index range using join with quest_asset_link
          // This ensures we only get assets that belong to this quest
          const assetsInVerse = await system.db
            .select({
              id: assetTable.id,
              name: assetTable.name,
              order_index: assetTable.order_index
            })
            .from(assetTable)
            .innerJoin(
              questAssetLinkTable,
              eq(assetTable.id, questAssetLinkTable.asset_id)
            )
            .where(
              and(
                eq(questAssetLinkTable.quest_id, currentQuestId),
                gte(assetTable.order_index, minOrderIndex),
                lte(assetTable.order_index, maxOrderIndex)
              )
            )
            .orderBy(asc(assetTable.order_index));

          if (assetsInVerse.length === 0) {
            console.log(`  ⏭️ Verse ${verse}: no assets found, skipping`);
            continue;
          }

          // Recalculate order_index with thousand scale
          // Formula: (verse * 1000 + sequential) * 1000
          // sequential starts at 1: 7001000, 7002000, 7003000...
          const updates: AssetUpdatePayload[] = [];
          let hasChanges = false;

          for (let i = 0; i < assetsInVerse.length; i++) {
            const asset = assetsInVerse[i];
            if (!asset) continue;

            const sequential = i + 1; // 1-based
            const newOrderIndex = (verse * 1000 + sequential) * 1000;

            // Only update if order_index changed
            if (asset.order_index !== newOrderIndex) {
              hasChanges = true;
              updates.push({
                assetId: asset.id,
                order_index: newOrderIndex
              });
            }
          }

          if (hasChanges && updates.length > 0) {
            await batchUpdateAssetMetadata(updates);
            console.log(
              `  ✅ Verse ${verse}: normalized ${updates.length} of ${assetsInVerse.length} asset(s)`
            );
          } else {
            console.log(
              `  ⏭️ Verse ${verse}: ${assetsInVerse.length} asset(s) already normalized`
            );
          }
        } catch (error) {
          console.error(`  ❌ Failed to normalize verse ${verse}:`, error);
        }
      }

      console.log(`🔄 Normalization complete`);
    },
    [currentQuestId]
  );

  // Calculate available range for adding verse label above a specific asset
  // Returns only verses between the previous separator's "to" and next separator's "from"
  const getRangeForAsset = React.useCallback(
    (assetId: string) => {
      const assetIndex = listItems.findIndex(
        (item) => item.type === 'asset' && item.content.id === assetId
      );

      if (assetIndex === -1) {
        return { from: 1, to: verseCount || 1, availableVerses: [] };
      }

      // Find previous separator (looking backward)
      let prevTo: number | undefined;
      for (let i = assetIndex - 1; i >= 0; i--) {
        const item = listItems[i];
        if (item && item.type === 'separator' && item.to !== undefined) {
          prevTo = item.to;
          break;
        }
      }

      // Find next separator (looking forward)
      let nextFrom: number | undefined;
      for (let i = assetIndex + 1; i < listItems.length; i++) {
        const item = listItems[i];
        if (item && item.type === 'separator' && item.from !== undefined) {
          nextFrom = item.from;
          break;
        }
      }

      // Calculate range - only between prevTo and nextFrom
      const rangeFrom = prevTo !== undefined ? prevTo + 1 : 1;
      const rangeTo = nextFrom !== undefined ? nextFrom - 1 : verseCount || 1;

      // Ensure valid range and check if there's actually space available
      const finalFrom = Math.max(1, rangeFrom);
      const finalTo = Math.max(finalFrom, Math.min(rangeTo, verseCount || 1));

      // Check if there's actually space between separators
      // If prevTo + 1 > nextFrom - 1, there's no space
      if (
        prevTo !== undefined &&
        nextFrom !== undefined &&
        prevTo + 1 > nextFrom - 1
      ) {
        return {
          from: finalFrom,
          to: finalTo,
          availableVerses: []
        };
      }

      // Generate array of available verses only in this range
      const availableVerses: number[] = [];
      for (
        let verse = finalFrom;
        verse <= finalTo && verse <= (verseCount || 1);
        verse++
      ) {
        availableVerses.push(verse);
      }

      return {
        from: finalFrom,
        to: finalTo,
        availableVerses
      };
    },
    [listItems, verseCount]
  );

  // Get available verses for editing a separator (between previous and next separators)
  const getRangeForSeparator = React.useCallback(
    (separatorKey: string) => {
      const separatorIndex = listItems.findIndex(
        (item) => item.type === 'separator' && item.key === separatorKey
      );

      if (separatorIndex === -1) {
        return { from: 1, to: verseCount || 1, availableVerses: [] };
      }

      // Find previous separator (looking backward)
      let prevTo: number | undefined;
      for (let i = separatorIndex - 1; i >= 0; i--) {
        const item = listItems[i];
        if (item && item.type === 'separator' && item.to !== undefined) {
          prevTo = item.to;
          break;
        }
      }

      // Find next separator (looking forward)
      let nextFrom: number | undefined;
      for (let i = separatorIndex + 1; i < listItems.length; i++) {
        const item = listItems[i];
        if (item && item.type === 'separator' && item.from !== undefined) {
          nextFrom = item.from;
          break;
        }
      }

      // Calculate range - only between prevTo and nextFrom
      const rangeFrom = prevTo !== undefined ? prevTo + 1 : 1;
      const rangeTo = nextFrom !== undefined ? nextFrom - 1 : verseCount || 1;

      // Ensure valid range
      const finalFrom = Math.max(1, rangeFrom);
      const finalTo = Math.max(finalFrom, Math.min(rangeTo, verseCount || 1));

      // Generate array of available verses only in this range
      const availableVerses: number[] = [];
      for (
        let verse = finalFrom;
        verse <= finalTo && verse <= (verseCount || 1);
        verse++
      ) {
        availableVerses.push(verse);
      }

      return {
        from: finalFrom,
        to: finalTo,
        availableVerses
      };
    },
    [listItems, verseCount]
  );

  // Get max 'to' value for editing a separator (limited to available range)
  const getMaxToForFromSeparator = React.useCallback(
    (separatorKey: string, selectedFrom: number): number => {
      const range = getRangeForSeparator(separatorKey);
      const availableVerses = range.availableVerses;

      // Find the index of selectedFrom in available verses
      const fromIndex = availableVerses.indexOf(selectedFrom);
      if (fromIndex === -1) {
        // If selectedFrom is not available, return selectedFrom
        return selectedFrom;
      }

      // Find the next occupied verse after selectedFrom
      // Look for the next separator's 'from' value
      const separatorIndex = listItems.findIndex(
        (item) => item.type === 'separator' && item.key === separatorKey
      );

      let nextFrom: number | undefined;
      for (let i = separatorIndex + 1; i < listItems.length; i++) {
        const item = listItems[i];
        if (item && item.type === 'separator' && item.from !== undefined) {
          nextFrom = item.from;
          break;
        }
      }

      // The maximum 'to' is the verse before the next separator's 'from', or the last available verse
      const maxTo = nextFrom !== undefined ? nextFrom - 1 : range.to;

      // Find the index of maxTo in available verses, or use the last available verse
      const maxToIndex = availableVerses.indexOf(maxTo);
      if (maxToIndex !== -1 && maxToIndex >= fromIndex) {
        const result = availableVerses[maxToIndex];
        if (result !== undefined) {
          return result;
        }
      }

      // If maxTo is not in available verses, return the last available verse from selectedFrom onwards
      const remainingVerses = availableVerses.slice(fromIndex);
      if (remainingVerses.length > 0) {
        const lastVerse = remainingVerses[remainingVerses.length - 1];
        if (lastVerse !== undefined) {
          return lastVerse;
        }
      }

      return selectedFrom;
    },
    [listItems, getRangeForSeparator]
  );

  // Stable wrapper for onPlay callback (avoids creating new function in renderItem)
  const stableOnPlay = React.useCallback(
    (assetId: string) => handlePlayAssetRef.current(assetId),
    []
  );

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
      if (item.type === 'separator') {
        // Check if this separator is selected for recording
        const isSeparatorSelected =
          selectedForRecording?.type === 'separator' &&
          selectedForRecording?.separatorKey === item.key;

        return (
          <View>
            <VerseSeparator
              editable={!isPublished}
              from={item.from}
              to={item.to}
              label={bookChapterLabelRef.current}
              onPress={
                !isPublished
                  ? () => {
                      setEditSeparatorState({
                        isOpen: true,
                        separatorKey: item.key,
                        from: item.from,
                        to: item.to
                      });
                    }
                  : undefined
              }
              // Recording selection - clicking the separator text selects it for recording
              isSelectedForRecording={!isPublished && isSeparatorSelected}
              onSelectForRecording={
                !isPublished
                  ? () =>
                      handleSelectSeparatorForRecording(
                        item.key,
                        item.from,
                        item.to
                      )
                  : undefined
              }
              dragHandleComponent={!isPublished ? Sortable.Handle : undefined}
              dragHandleProps={
                !isPublished
                  ? {
                      mode: fixedItemsIndexesRef.current.includes(index)
                        ? 'fixed-order'
                        : 'draggable'
                    }
                  : undefined
              }
            />
            {!isPublished && !isSelectionMode && isSeparatorSelected && (
              <RecordingPlaceIndicator />
            )}
          </View>
        );
      }

      // Handle asset items
      const asset = item.content;
      const isPlaying =
        audioContext.isPlaying &&
        audioContext.currentAudioId === PLAY_ALL_AUDIO_ID &&
        currentlyPlayingAssetId === asset.id;

      const isSelected = selectedAssetIds.has(asset.id);

      const isAssetSelectedForRecording =
        !isPublished &&
        selectedForRecording?.type === 'asset' &&
        selectedForRecording?.assetId === asset.id;

      // Only calculate range if this asset is selected for recording (performance optimization)
      const assetRange = isAssetSelectedForRecording
        ? getRangeForAsset(asset.id)
        : null;
      const hasAvailableVerses = assetRange
        ? assetRange.availableVerses.length > 0
        : false;

      return (
        <View className="relative">
          {/* Add verse button - centered, only shown when asset is selected for recording */}
          {!isPublished &&
            !isSelectionMode &&
            isAssetSelectedForRecording &&
            hasAvailableVerses && (
              <View className="flex flex-row items-center justify-center gap-1 py-2">
                <Pressable
                  onPress={() => {
                    const range = getRangeForAsset(asset.id);
                    setAssetVerseSelectorState({
                      isOpen: true,
                      assetId: asset.id,
                      from: range.from,
                      to: range.to
                    });
                  }}
                  className="rounded-full bg-primary/80 p-1 shadow-sm active:bg-primary"
                >
                  <Icon
                    as={BookmarkPlusIcon}
                    size={12}
                    className="text-primary-foreground"
                  />
                </Pressable>
              </View>
            )}
          <BibleAssetListItem
            key={asset.id}
            asset={asset}
            attachmentState={safeAttachmentStates.get(asset.id)}
            questId={currentQuestId || ''}
            isCurrentlyPlaying={isPlaying}
            onUpdate={handleAssetUpdate}
            onPlay={stableOnPlay}
            isPublished={isPublished}
            // Drag handle props (primitives instead of ReactNode)
            showDragHandle={!isPublished && !isSelectionMode}
            isDragFixed={fixedItemsIndexesRef.current.includes(index)}
            // Selection mode only works when NOT published
            isSelectionMode={!isPublished && isSelectionMode}
            isSelected={!isPublished && isSelected}
            onToggleSelect={!isPublished ? toggleSelect : undefined}
            onEnterSelection={!isPublished ? enterSelection : undefined}
            // Recording insertion point selection
            isSelectedForRecording={isAssetSelectedForRecording}
            onSelectForRecording={
              !isPublished ? handleSelectForRecording : undefined
            }
            onRename={!isPublished ? handleRenameAsset : undefined}
          />
          {!isPublished && !isSelectionMode && isAssetSelectedForRecording && (
            <RecordingPlaceIndicator />
          )}
        </View>
      );
    },
    [
      currentQuestId,
      safeAttachmentStates,
      audioContext.isPlaying,
      audioContext.currentAudioId,
      currentlyPlayingAssetId,
      handleAssetUpdate,
      stableOnPlay,
      getRangeForAsset,
      isSelectionMode,
      selectedAssetIds,
      toggleSelect,
      enterSelection,
      selectedForRecording?.type,
      selectedForRecording?.assetId,
      selectedForRecording?.separatorKey,
      handleSelectForRecording,
      handleSelectSeparatorForRecording,
      handleRenameAsset
    ]
  );

  const _onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
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
    // If not playing at all, clear the highlight
    if (!audioContext.isPlaying) {
      setCurrentlyPlayingAssetId(null);
      return;
    }

    // If playing a single asset (not play-all mode), the currentAudioId IS the assetId
    // Just keep the highlight for that asset (handlePlayAsset already sets it)
    if (audioContext.currentAudioId !== PLAY_ALL_AUDIO_ID) {
      // The currentAudioId is the assetId, ensure it's highlighted
      setCurrentlyPlayingAssetId(audioContext.currentAudioId);
      return;
    }

    // Calculate which asset is playing based on cumulative position (play-all mode)
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

  // Handle play individual asset
  const handlePlayAsset = React.useCallback(
    async (assetId: string) => {
      try {
        const isThisAssetPlaying =
          audioContext.isPlaying && audioContext.currentAudioId === assetId;

        if (isThisAssetPlaying) {
          console.log('⏸️ Stopping asset:', assetId.slice(0, 8));
          await audioContext.stopCurrentSound();
          setCurrentlyPlayingAssetId(null);
        } else {
          console.log('▶️ Playing asset:', assetId.slice(0, 8));
          const uris = await getAssetAudioUris(assetId);

          if (uris.length === 0) {
            console.warn('⚠️ No audio URIs found for asset:', assetId);
            return;
          }

          // Set the asset as currently playing immediately for visual feedback
          setCurrentlyPlayingAssetId(assetId);

          if (uris.length === 1 && uris[0]) {
            console.log('▶️ Playing single segment');
            await audioContext.playSound(uris[0], assetId);
          } else if (uris.length > 1) {
            console.log(`▶️ Playing ${uris.length} segments in sequence`);
            await audioContext.playSoundSequence(uris, assetId);
          }
        }
      } catch (error) {
        console.error('❌ Failed to play audio:', error);
        setCurrentlyPlayingAssetId(null);
      }
    },
    [audioContext, getAssetAudioUris]
  );

  // Update ref so renderItem can use it
  handlePlayAssetRef.current = handlePlayAsset;

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
    // Calculate initialOrderIndex:
    // - If an asset is selected, use its order_index
    // - Otherwise, use the last unassigned order_index (to continue from where we left off)
    // - If no unassigned assets exist, undefined will trigger default in BibleRecordingView
    const recordingOrderIndex =
      selectedForRecording?.orderIndex ?? lastUnassignedOrderIndex;

    // Pass existing assets as initial data for instant rendering
    return (
      <BibleRecordingView
        onBack={async (recordedVerses) => {
          setShowRecording(false);
          setSelectedForRecording(null); // Clear selection when exiting

          // Normalize order_index for recorded verses before refetching
          // This converts unit-scale (7001001) to thousand-scale (7001000)
          if (recordedVerses && recordedVerses.length > 0) {
            await normalizeOrderIndexForVerses(recordedVerses);
          }

          // Refetch to show newly recorded assets with normalized order_index
          void refetch();
        }}
        initialAssets={assets}
        label={selectedForRecording?.verseName}
        initialOrderIndex={recordingOrderIndex}
        verse={selectedForRecording?.metadata?.verse}
        bookChapterLabel={bookChapterLabel}
        bookChapterLabelFull={selectedQuest?.name}
        nextVerse={nextVerse}
        limitVerse={limitVerse}
      />
    );
  }

  // Check if quest is published (source is 'synced')
  // const isPublished = selectedQuest?.source === 'synced';

  // Get project name for PrivateAccessGate
  // Note: queriedProjectData doesn't include name, so we only use currentProjectData
  const projectName = currentProjectData?.name || '';

  // ============================================================================
  // ORDER_INDEX CALCULATION
  // Formula: order_index = (from * 1000 + sequential) * 1000
  // - 'from' is the verse number from the separator (999 for unassigned)
  // - 'sequential' is the position within that verse group (1-based, starts at 1)
  // - Final value is multiplied by 1000 to leave space for future insertions
  // Example: verse 7, first asset → 7001000, second → 7002000, etc.
  // This ensures assets are ordered by verse first, then by position within verse
  // ============================================================================

  const UNASSIGNED_VERSE_BASE = 999; // High value so unassigned assets appear at the end

  async function _handleSorting(params: {
    indexToKey: string[];
    data: ListItem[];
  }) {
    console.log('🔄 Sorting:');
    // Build a map of key -> item for quick lookup
    const keyToItem = new Map(params.data.map((item) => [item.key, item]));

    // Iterate through the new order and update asset metadata + order_index
    // based on the preceding separator
    let currentSeparator: ListItemSeparator | null = null;
    let sequentialInGroup = 1; // Tracks position within current verse group (starts at 1)
    const updates: AssetUpdatePayload[] = [];

    for (const key of params.indexToKey) {
      const item = keyToItem.get(key);
      if (!item) continue;

      if (item.type === 'separator') {
        currentSeparator = item;
        sequentialInGroup = 1; // Reset counter for new group (starts at 1)
      } else if (item.type === 'asset') {
        // Calculate order_index: (from * 1000 + sequential) * 1000
        const verseBase = currentSeparator?.from ?? UNASSIGNED_VERSE_BASE;
        const newOrderIndex = (verseBase * 1000 + sequentialInGroup) * 1000;
        sequentialInGroup++;

        // Determine the metadata based on the current separator
        const newMetadata: AssetMetadata | null = currentSeparator?.from
          ? {
              verse: {
                from: currentSeparator.from,
                to: currentSeparator.to ?? currentSeparator.from
              }
            }
          : null;

        // Check if metadata or order_index has changed
        const currentMetadata = item.content.metadata;
        const currentOrderIndex = item.content.order_index;

        const metadataChanged =
          JSON.stringify(newMetadata) !== JSON.stringify(currentMetadata);
        const orderIndexChanged = newOrderIndex !== currentOrderIndex;

        if (metadataChanged || orderIndexChanged) {
          const update: AssetUpdatePayload = {
            assetId: item.content.id
          };

          // Only include changed fields
          if (metadataChanged) {
            update.metadata = newMetadata;
          }
          if (orderIndexChanged) {
            update.order_index = newOrderIndex;
          }

          // Log asset change details
          console.log(
            `📝 "${item.content.name}" (${item.content.id.slice(0, 8)}...) | ` +
              `metadata: ${metadataChanged ? `${JSON.stringify(currentMetadata)} → ${JSON.stringify(newMetadata)}` : '(unchanged)'} | ` +
              `order_index: ${orderIndexChanged ? `${currentOrderIndex} → ${newOrderIndex}` : '(unchanged)'}`
          );

          updates.push(update);
        }
      }
    }

    // Batch update all changed assets
    if (updates.length > 0) {
      try {
        await batchUpdateAssetMetadata(updates);
        console.log(
          `✅ Updated ${updates.length} asset(s) (metadata + order_index)`
        );

        // Invalidate queries to refresh the UI
        void queryClient.invalidateQueries({ queryKey: ['assets'] });
        void refetch(); // Refresh current assets to remove stale separators
      } catch (err: unknown) {
        console.error('Failed to update assets:', err);
      }
    }
  }

  return (
    <View className="flex flex-1 flex-col gap-6 p-6">
      <View className="flex flex-row items-center justify-between">
        {/* Left side: Quest name on top, Assets below */}
        <View className="flex flex-col">
          {selectedQuest?.name && (
            <Text className="text-xl font-semibold">
              {selectedQuest.name.length > 25
                ? `${selectedQuest.name.slice(0, 25)}...`
                : selectedQuest.name}
            </Text>
          )}
          <Text className="text-lg font-medium text-muted-foreground">
            {t('assets')}
          </Text>
        </View>

        {/* Right side: Icons */}
        <View className="flex flex-row items-center gap-2">
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
                {!isPublished && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-[1.5px] border-primary"
                    onPress={() => {
                      setNewLabelSelectorState({
                        isOpen: true
                      });
                    }}
                    disabled={
                      !isOnline ||
                      verseCount === 0 ||
                      getAvailableVerses().length === 0
                    }
                  >
                    <Icon as={BookmarkPlusIcon} className="text-primary" />
                  </Button>
                )}
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
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <Sortable.Grid
            dragActivationDelay={100}
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
            onDragEnd={(params) => void _handleSorting(params)}
            customHandle
            sortEnabled={!isSelectionMode} // Disable sorting in selection mode
            // autoScrollActivationOffset={75}
            // autoScrollSpeed={1}
            // autoScrollEnabled={true}
          />
          {/* Loading indicator for infinite scroll */}
          {isFetchingNextPage && (
            <View className="items-center justify-center py-4">
              <ActivityIndicator
                size="small"
                color={getThemeColor('primary')}
              />
              <Text className="mt-2 text-sm text-muted-foreground">
                {t('loading')}...
              </Text>
            </View>
          )}
          {/* End of list indicator */}
          {!hasNextPage && assets.length > 0 && (
            <View className="items-center justify-center py-4">
              <Text className="text-sm text-muted-foreground">•••</Text>
            </View>
          )}
        </Animated.ScrollView>
      )}

      {/* Hide SpeedDial in selection mode */}
      {!isSelectionMode && (
        <View
          style={{
            bottom: insets.bottom + 24,
            left: 24
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
              {!isPublished && (
                <SpeedDialItem
                  icon={BrushCleaning}
                  variant="outline"
                  onPress={() => setShowDeleteAllDrawer(true)}
                />
              )}
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
            <SpeedDialTrigger className='rounded-md -top-0.5 text-destructive-foreground' />
          </SpeedDial>
        </View>
      )}      

      {/* Sticky Record Button Footer - only show for authenticated users */}
      {!isPublished && currentUser && (
        <View
          style={{
            paddingBottom: insets.bottom,
            paddingRight: isSelectionMode ? 0 : 50 // Leave space for SpeedDial when not in selection mode
          }}
          className="px-2"
        >
          {isSelectionMode ? (
            <BibleSelectionControls
              selectedCount={selectedAssetIds.size}
              onCancel={cancelSelection}
              onMerge={handleBatchMergeSelected}
              onDelete={handleBatchDeleteSelected}
              onAssignVerse={() => setShowVerseAssignerDrawer(true)}
            />
          ) : (
            <Pressable
              //variant="destructive"
              // size="lg"
              className="bg-primary w-full flex-row items-center justify-around gap-2 p-2 px-4 rounded-lg ml-14"
              onPress={() => setShowRecording(true)}
            >
              <Icon
                as={MicIcon}
                size={24}
                className="text-secondary"
              />
              <View className="flex-col justify-start items-start gap-0 ml-2">
              
                <Text className="text-base font-semibold text-secondary text-center">
                  {t('startRecordingSession')}
                </Text>
              <Text className="text-sm text-secondary text-center">
                {selectedForRecording?.verseName
                  ? `${bookChapterLabelRef.current}:${selectedForRecording.verseName}`
                  : t('noLabelSelected')}
                {/* {selectedForRecording?.verseName
                  ? `${t('doRecord')} ${bookChapterLabelRef.current}:${selectedForRecording.verseName}`
                  : t('doRecord')} */}
              </Text>
              </View>
              <Icon
                as={ChevronRight}
                size={24}
                className="text-secondary"
              />              
            </Pressable>

          )}
        </View>
      )}


      {allowSettings && isOwner && (
        <QuestSettingsModal
          isVisible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          questId={currentQuestId}
          projectId={currentProjectId || ''}
        />
      )}

      {/* Delete All Assets Drawer */}
      <AssetsDeletionDrawer
        isOpen={showDeleteAllDrawer}
        onClose={() => setShowDeleteAllDrawer(false)}
        onConfirm={() => void handleDeleteAllAssets()}
        title="Delete All Assets?"
        description="All assets in this quest will be permanently deleted. This action is irreversible and cannot be undone."
        countdown={10}
      />
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

      {/* Rename Asset Drawer */}
      <RenameAssetDrawer
        isOpen={showRenameDrawer}
        currentName={renameAssetName}
        onOpenChange={(open) => {
          setShowRenameDrawer(open);
          if (!open) {
            setRenameAssetId(null);
          }
        }}
        onSave={handleSaveRename}
      />

      {/* Batch Verse Assignment Drawer */}
      <Drawer
        open={showVerseAssignerDrawer}
        onOpenChange={(open) => {
          setShowVerseAssignerDrawer(open);
        }}
        snapPoints={['40%']}
        enableDynamicSizing={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Assign Verse</DrawerTitle>
            <DrawerDescription>
              Select verse range for {selectedAssetIds.size} selected asset
              {selectedAssetIds.size !== 1 ? 's' : ''}
            </DrawerDescription>
          </DrawerHeader>
          <VerseAssigner
            availableVerses={getAvailableVerses()}
            existingLabels={existingLabels}
            getMaxToForFrom={getMaxToForFrom}
            verseCount={verseCount}
            onApply={(from, to) => {
              void handleAssignVerseToSelected(from, to);
            }}
            onCancel={() => setShowVerseAssignerDrawer(false)}
            onRemove={handleRemoveLabelFromSelected}
            hasSelectedAssetsWithLabels={selectedAssetsHaveLabels}
            className="mx-4"
            ScrollViewComponent={DrawerScrollView}
          />
        </DrawerContent>
      </Drawer>

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

      {/* Verse Range Selector Drawer for editing existing separator */}
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
                // Clear recording selection when any label is added
                setSelectedForRecording(null);
                setVerseSelectorState({ isOpen: false, key: null });
              }}
              onCancel={() =>
                setVerseSelectorState({ isOpen: false, key: null })
              }
            />
          </View>
        </DrawerContent>
      </Drawer>

      {/* Verse Range Selector Drawer for adding new label */}
      <Drawer
        open={newLabelSelectorState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setNewLabelSelectorState({ isOpen: false });
          }
        }}
        snapPoints={['40%']}
        enableDynamicSizing={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add Verse Label</DrawerTitle>
          </DrawerHeader>
          <View className="p-4">
            <VerseRangeSelector
              availableVerses={getAvailableVerses()}
              ScrollViewComponent={GHScrollView}
              getMaxToForFrom={getMaxToForFrom}
              onApply={(from, to) => {
                addVerseSeparator(from, to);
                // Clear recording selection when any label is added
                setSelectedForRecording(null);
                setNewLabelSelectorState({ isOpen: false });
              }}
              onCancel={() => setNewLabelSelectorState({ isOpen: false })}
            />
          </View>
        </DrawerContent>
      </Drawer>

      {/* Verse Range Selector Drawer for adding label above asset */}
      <Drawer
        open={assetVerseSelectorState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssetVerseSelectorState({ isOpen: false, assetId: null });
          }
        }}
        snapPoints={['40%']}
        enableDynamicSizing={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add Verse Label</DrawerTitle>
          </DrawerHeader>
          <View className="p-4">
            <VerseRangeSelector
              availableVerses={
                assetVerseSelectorState.assetId
                  ? getRangeForAsset(assetVerseSelectorState.assetId)
                      .availableVerses
                  : getAvailableVerses()
              }
              ScrollViewComponent={GHScrollView}
              getMaxToForFrom={getMaxToForFrom}
              onApply={(from, to) => {
                if (assetVerseSelectorState.assetId) {
                  addVerseSeparator(from, to, assetVerseSelectorState.assetId);
                } else {
                  addVerseSeparator(from, to);
                }
                // Clear recording selection when any label is added
                setSelectedForRecording(null);
                setAssetVerseSelectorState({ isOpen: false, assetId: null });
              }}
              onCancel={() =>
                setAssetVerseSelectorState({ isOpen: false, assetId: null })
              }
            />
          </View>
        </DrawerContent>
      </Drawer>

      {/* Verse Range Selector Drawer for editing separator */}
      <Drawer
        open={editSeparatorState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditSeparatorState({ isOpen: false, separatorKey: null });
          }
        }}
        snapPoints={['40%']}
        enableDynamicSizing={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Verse Label</DrawerTitle>
          </DrawerHeader>
          <View className="p-4">
            {editSeparatorState.separatorKey && (
              <VerseRangeSelector
                availableVerses={
                  getRangeForSeparator(editSeparatorState.separatorKey)
                    .availableVerses
                }
                from={editSeparatorState.from}
                to={editSeparatorState.to}
                ScrollViewComponent={GHScrollView}
                getMaxToForFrom={(selectedFrom) =>
                  getMaxToForFromSeparator(
                    editSeparatorState.separatorKey!,
                    selectedFrom
                  )
                }
                onApply={async (from, to) => {
                  if (editSeparatorState.separatorKey) {
                    await updateVerseSeparator(
                      editSeparatorState.separatorKey,
                      editSeparatorState.from,
                      editSeparatorState.to,
                      from,
                      to
                    );
                  }
                  // Clear recording selection when any label is edited
                  // This ensures we don't have stale order_index references
                  setSelectedForRecording(null);
                  setEditSeparatorState({ isOpen: false, separatorKey: null });
                }}
                onCancel={() =>
                  setEditSeparatorState({ isOpen: false, separatorKey: null })
                }
              />
            )}
          </View>
        </DrawerContent>
      </Drawer>
    </View>
  );
}
