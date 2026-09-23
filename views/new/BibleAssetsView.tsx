/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AssetsDeletionDrawer } from '@/components/AssetsDeletionDrawer';
import { AudioPlayerControls } from '@/components/AudioPlayerControls';
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
import { useProjectById } from '@/hooks/db/useProjects';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import { useAudioPlaybackCheckpoint } from '@/hooks/useAudioPlaybackCheckpoint';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { usePlayAllAudioController } from '@/hooks/usePlayAllAudioController';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useSingleAudioController } from '@/hooks/useSingleAudioController';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { isImportedAsset } from '@/utils/assetProvenance';
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import RNAlert from '@blazejkustra/react-native-alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack } from 'expo-router';
import {
  ArrowBigDownDashIcon,
  BookmarkPlusIcon,
  BookOpenIcon,
  BrushCleaning,
  DownloadIcon,
  FilePenIcon,
  FlagIcon,
  InfoIcon,
  LockIcon,
  PlayIcon,
  Redo2,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  Undo2,
  UserPlusIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImportWizard } from './importWizard';
import type { ImportWizardVerseLabel } from './importWizard';
import type { HybridDataSource } from '@/hooks/useHybridQuery';
import { useHybridQuery } from '@/hooks/useHybridQuery';

import { AssetListSkeleton } from '@/components/AssetListSkeleton';
import { ExportButton } from '@/components/ExportButton';
import type { FiaDrawerState } from '@/components/FiaStepDrawer';
import {
  FiaStepDrawer,
  INITIAL_FIA_DRAWER_STATE
} from '@/components/FiaStepDrawer';
import { ModalDetails } from '@/components/ModalDetails';
import { QuestDownloadButton } from '@/components/QuestDownloadButton';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { PublishQuestButton } from '@/components/PublishQuestButton';
import { QuestLabelHandler } from '@/components/questLabelHandler';
import { QuestSyncedBadge } from '@/components/QuestSyncedBadge';
import { RecordButton } from '@/components/RecordButton';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { VerseAssigner } from '@/components/VerseAssigner';
import { VerseRangeSelector } from '@/components/VerseRangeSelector';
import { VerseSeparator } from '@/components/VerseSeparator';
import {
  getAssetOperationMessage,
  MAX_ASSETS_WITHOUT_CONFIRMATION
} from '@/constants/assetOperations';
import type { ChapterVerse } from '@/constants/bibleStructure';
import {
  BIBLE_BOOKS,
  buildPericopeSequence,
  formatPericopeVerseLabel
} from '@/constants/bibleStructure';
import { useCollectAssetsOnBlur } from '@/hooks/useCollectAssetsOnBlur';
import type { AssetUpdatePayload } from '@/database_services/assetService';
import {
  AssetVerseUpdateError,
  batchUpdateAssetVerse,
  getMaxQuestOrderIndex,
  getQuestAssetOrderIndex,
  renameAsset,
  softDeleteAssetsFromQuest,
  softMergeAssetsInQuest
} from '@/database_services/assetService';
import { whenAssetWritesIdle } from '@/database_services/assetWriteQueue';
import {
  redo as redoAssetOperation,
  undo as undoAssetOperation
} from '@/database_services/assetUndoService';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import {
  createQuestRecordingSession,
  parseQuestMetadata
} from '@/database_services/questService';
import type {
  AssetOperationDataItem,
  AssetOperationTypes
} from '@/database_services/types';
import type { FiaMetadata } from '@/db/drizzleSchemaColumns';
import { useAssetsByQuest, useLocalAssetsByQuest } from '@/hooks/db/useAssets';
import { useBlockedAssetsCount } from '@/hooks/useBlockedCount';
import { useFiaPericopeSteps } from '@/hooks/useFiaPericopeSteps';
import { useProjectFiaLanguageCode } from '@/hooks/useProjectFiaLanguageCode';
import { useQuestDownloadFlow } from '@/hooks/useQuestDownloadFlow';
import { useHasUserReported } from '@/hooks/useReports';
import { useUndoHistory } from '@/hooks/useUndoHistory';
import { isFiaPericopeCached } from '@/services/FiaAttachmentQueue';
import { getAssetAudioUris as getPlayableAssetAudioUris } from '@/utils/getAssetAudioUris';
import { publishQuest as publishQuestUtils } from '@/utils/publishQuest';
import { resolveQuestDownloadAction } from '@/utils/questDownloadGate';
import { formatQuestDisplayLabel } from '@/utils/questVersionLabel';
import { getThemeColor } from '@/utils/styleUtils';
import {
  invalidateCloud,
  invalidateOfflineChapterLists
} from '@/hooks/hybridCache';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import type { ReorderableListReorderEvent } from 'react-native-reorderable-list';
import ReorderableList, {
  useReorderableDrag
} from 'react-native-reorderable-list';
import { toast } from 'sonner-native';
import { AssetCardItem } from './AssetCardItem';
import { RecordSelectionControls } from './recording/components/RecordSelectionControls';
import { RenameAssetDrawer } from './recording/components/RenameAssetDrawer';
import { useSelectionMode } from './recording/hooks/useSelectionMode';
import type {
  ManualSeparator,
  ReorderRejection,
  VerseListItem,
  VerseListSeparator,
  VerseRange
} from '@/utils/verseAssignment';
import {
  assignGroupFrom,
  buildVerseList,
  getVerseRange,
  labelRanges,
  lastSequenceInVerse,
  lastUnassignedOrderIndex as findLastUnassignedOrderIndex,
  maxToForNewLabel,
  openRangeAt,
  orderIndexFor,
  parseAssetMetadata,
  planReorder,
  UNASSIGNED_VERSE_BASE,
  unlabeledVerses,
  verseStartOrderIndex
} from '@/utils/verseAssignment';

type Asset = typeof asset.$inferSelect;

interface AssetMetadata {
  verse?: {
    from: number;
    to: number;
  };
  recordingSessionId?: string;
}

type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
  tag_ids?: string[] | undefined;
  metadata?: AssetMetadata | null;
  source?: HybridDataSource;
};

type ListItem = VerseListItem<AssetQuestLink>;
const ENABLE_BIBLE_ASSET_LIST_TRANSITIONS = false;

const REORDER_REJECTION_MESSAGE = {
  'above-first-section': 'verseDropAboveFirstSection',
  'out-of-order': 'verseLabelsOutOfOrder',
  'empties-label': 'verseLabelNeedsRecording'
} as const satisfies Record<ReorderRejection, string>;

// ============================================================================
// FIA METADATA HELPERS
// Maps FIA book IDs to BIBLE_BOOKS IDs for label/verse lookup
// ============================================================================

const FIA_TO_BIBLE_BOOK_ID: Record<string, string> = {
  mrk: 'mar',
  php: 'phi',
  jol: 'joe',
  nam: 'nah'
};

function getBibleBookIdFromFia(fiaBookId: string): string {
  return FIA_TO_BIBLE_BOOK_ID[fiaBookId] ?? fiaBookId;
}

/**
 * Parse FIA verseRange string like "1:1-13", "4:30-5:20", or "6:1-6a"
 * Sub-verse letters (a, b, c…) are stripped — "6a" becomes verse 6.
 * Returns chapter, startVerse, endVerse for use in verse labeling
 */
function parseFiaVerseRange(verseRange: string): {
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
} | null {
  const match = /^(\d+):(\d+)[a-z]?-(?:(\d+):)?(\d+)[a-z]?$/.exec(verseRange);
  if (!match) return null;
  const startChapter = parseInt(match[1]!, 10);
  const startVerse = parseInt(match[2]!, 10);
  const endChapter = match[3] ? parseInt(match[3], 10) : startChapter;
  const endVerse = parseInt(match[4]!, 10);
  return { startChapter, startVerse, endChapter, endVerse };
}

/**
 * Extract FIA metadata from quest metadata (handles both string and object forms)
 */
function extractFiaMetadata(metadata: unknown): FiaMetadata | null {
  try {
    const parsed =
      typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'fia' in parsed &&
      parsed.fia &&
      typeof parsed.fia === 'object'
    ) {
      return parsed.fia as FiaMetadata;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// ============================================================================
// DRAGGABLE LIST ITEM WRAPPERS
// These components call useReorderableDrag() and pass the drag function down
// ============================================================================

interface DraggableSeparatorProps {
  item: VerseListSeparator;
  isPublished: boolean;
  isSelectionMode: boolean;
  isSeparatorSelected: boolean;
  canDrag: boolean;
  isDragFixed: boolean;
  bookChapterLabel: string;
  formatVerse?: (position: number) => string | null;
  onPress?: () => void;
  onSelectForRecording?: () => void;
  onStartRecording?: () => void;
}

const DraggableSeparator = React.memo(function DraggableSeparator({
  item,
  isPublished,
  isSelectionMode,
  isSeparatorSelected,
  canDrag,
  isDragFixed,
  bookChapterLabel,
  formatVerse,
  onPress,
  onSelectForRecording,
  onStartRecording
}: DraggableSeparatorProps) {
  const drag = useReorderableDrag();

  return (
    <View>
      <VerseSeparator
        editable={!isPublished}
        from={item.from}
        to={item.to}
        label={bookChapterLabel}
        formatVerse={formatVerse}
        onPress={onPress}
        isSelectedForRecording={!isPublished && isSeparatorSelected}
        onSelectForRecording={onSelectForRecording}
        onDrag={canDrag ? drag : undefined}
        isDragFixed={isDragFixed}
      />
      {!isPublished &&
        !isSelectionMode &&
        isSeparatorSelected &&
        onStartRecording && (
          <View className="py-2">
            <RecordButton onPress={onStartRecording} />
          </View>
        )}
    </View>
  );
});

interface DraggableAssetItemProps {
  asset: AssetQuestLink;
  questId: string;
  isPublished: boolean;
  isPlaying: boolean;
  playDisabled?: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  isAssetSelectedForRecording: boolean;
  hasAvailableVerses: boolean;
  showDragHandle: boolean;
  isHighlighted: boolean;
  onPlay: (assetId: string) => void;
  onToggleSelect: (assetId: string) => void;
  onEnterSelection?: (assetId: string) => void;
  onSelectForRecording?: (assetId: string) => void;
  onRename?: (assetId: string, currentName: string | null) => void;
  onAddVersePress?: () => void;
  onQuickAddVersePress?: () => void;
  onStartRecording?: () => void;
}

const DraggableAssetItem = React.memo(function DraggableAssetItem({
  asset,
  questId,
  isPublished,
  isPlaying,
  playDisabled = false,
  isSelected,
  isSelectionMode,
  isAssetSelectedForRecording,
  hasAvailableVerses,
  showDragHandle,
  isHighlighted,
  onPlay,
  onToggleSelect,
  onEnterSelection,
  onSelectForRecording,
  onRename,
  onAddVersePress,
  onQuickAddVersePress,
  onStartRecording
}: DraggableAssetItemProps) {
  const drag = useReorderableDrag();

  return (
    <View className="relative">
      {/* Add verse button - centered, only shown when asset is selected for recording */}
      {!isPublished &&
        !isSelectionMode &&
        isAssetSelectedForRecording &&
        hasAvailableVerses && (
          <View className="flex flex-row items-center justify-center gap-1 py-2">
            <Pressable
              onPress={onQuickAddVersePress}
              onLongPress={onAddVersePress}
              className="flex flex-row items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 active:bg-primary/20"
            >
              <Icon as={BookmarkPlusIcon} size={14} className="text-primary" />
              <Text className="text-xs font-medium text-primary">
                Add Verse Label
              </Text>
            </Pressable>
          </View>
        )}
      <AssetCardItem
        asset={asset}
        questId={questId}
        isPublished={isPublished}
        isCurrentlyPlaying={isPlaying}
        playDisabled={playDisabled}
        onPlay={onPlay}
        showDragHandle={showDragHandle}
        onDrag={drag}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        onEnterSelection={onEnterSelection}
        isSelectedForRecording={isAssetSelectedForRecording}
        onSelectForRecording={onSelectForRecording}
        onRename={onRename}
        isHighlighted={isHighlighted && !isPublished}
      />
      {!isPublished &&
        !isSelectionMode &&
        isAssetSelectedForRecording &&
        onStartRecording && (
          <View className="py-2">
            <RecordButton onPress={onStartRecording} />
          </View>
        )}
    </View>
  );
});

// Track quests where the user has dismissed the FIA drawer (persists across mounts within session)
const fiaDrawerDismissedQuests = new Set<string>();

function KeepAwakeGuard() {
  useKeepAwake();
  return null;
}

export default function BibleAssetsView() {
  const { questId, projectId, router, goToRecording, promptVersionLabel } =
    useNavigationHelpers();
  const { currentUser } = useAuth();
  const audioContext = useAudio();
  const queryClient = useQueryClient();
  const {
    push: pushUndoHistory,
    undo: undoHistory,
    redo: redoHistory,
    clear: clearUndoHistory,
    peekUndo: peekUndoHistory,
    peekRedo: peekRedoHistory,
    canUndo: hasUndoHistory,
    canRedo: hasRedoHistory
  } = useUndoHistory<AssetOperationDataItem[], AssetOperationDataItem[]>();
  const currentUndoOperation = peekUndoHistory() as
    | AssetOperationTypes
    | undefined;
  const currentRedoOperation = peekRedoHistory() as
    | AssetOperationTypes
    | undefined;
  const insets = useSafeAreaInsets();

  useCollectAssetsOnBlur();

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
  const [showDeleteAllDrawer, setShowDeleteAllDrawer] = React.useState(false);
  const [showRenameQuestLabelDrawer, setShowRenameQuestLabelDrawer] =
    React.useState(false);
  // Hold FIA instructions until the version-label prompt (if any) is dismissed
  const [awaitingVersionLabel, setAwaitingVersionLabel] = React.useState(
    () => promptVersionLabel === '1'
  );
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

  // State for FIA pericope text drawer
  const [showFiaTextDrawer, setShowFiaTextDrawer] = React.useState(false);
  const [showImportWizard, setShowImportWizard] = React.useState(false);
  const fiaDrawerStateRef = React.useRef<FiaDrawerState>({
    ...INITIAL_FIA_DRAWER_STATE
  });

  // Labels created in the UI that no asset carries yet
  const [manualSeparators, setManualSeparators] = React.useState<
    ManualSeparator[]
  >([]);

  const [showPrivateAccessModal, setShowPrivateAccessModal] =
    React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  // Track which asset is currently playing during play-all
  const [currentlyPlayingAssetId, setCurrentlyPlayingAssetId] = React.useState<
    string | null
  >(null);
  const [showPlayAllControls, setShowPlayAllControls] = React.useState(false);
  const [currentPlayAllSegmentIndex, setCurrentPlayAllSegmentIndex] =
    React.useState<number | null>(null);
  const [currentPlayAllTotalSegments, setCurrentPlayAllTotalSegments] =
    React.useState<number | null>(null);
  // OLD handlePlayAllAssets refs - commented out
  // const assetUriMapRef = React.useRef<Map<string, string>>(new Map()); // URI -> assetId
  // const assetOrderRef = React.useRef<string[]>([]); // Ordered list of asset IDs
  // const uriOrderRef = React.useRef<string[]>([]); // Ordered list of URIs matching assetOrderRef
  // const segmentDurationsRef = React.useRef<number[]>([]); // Duration of each URI segment in ms
  // Ref to allow handlePlayAsset to be used in renderItem before it's defined
  const handlePlayAssetRef = React.useRef<
    (assetId: string) => void | Promise<void>
  >((_assetId: string) => {
    // No-op: will be replaced by handlePlayAsset when defined
  });

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
  const { data: queriedQuestData } = useHybridQuery({
    queryKey: ['current-quest', questId],
    offlineQuery: toCompilableQuery(
      system.db.query.quest.findFirst({
        where: eq(questTable.id, questId!)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', questId)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!questId,
    enableOfflineQuery: !!questId,
    getItemId: (item) => item.id
  });

  const selectedQuest = React.useMemo(() => {
    return queriedQuestData && queriedQuestData.length > 0
      ? queriedQuestData[0]
      : undefined;
  }, [queriedQuestData]);

  // Check if quest is published (source is 'synced')
  const isPublished = selectedQuest?.published_at != null;
  const promptVersionLabelConsumedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (promptVersionLabel !== '1' || !questId) return;

    const consumeKey = `${questId}:promptVersionLabel`;
    if (promptVersionLabelConsumedRef.current === consumeKey) return;
    if (!selectedQuest || !currentUser?.id) return;

    promptVersionLabelConsumedRef.current = consumeKey;

    if (isPublished || selectedQuest.creator_id !== currentUser.id) {
      setAwaitingVersionLabel(false);
      router.setParams({ promptVersionLabel: undefined });
      return;
    }

    setAwaitingVersionLabel(true);
    setShowFiaTextDrawer(false);
    setShowRenameQuestLabelDrawer(true);
    router.setParams({ promptVersionLabel: undefined });
  }, [
    currentUser?.id,
    isPublished,
    promptVersionLabel,
    questId,
    router,
    selectedQuest
  ]);

  // Derive bookId from quest metadata (was previously passed via navigation)
  const currentBookId = React.useMemo(() => {
    if (!selectedQuest?.metadata) return undefined;
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
        'book' in metadata.bible &&
        typeof metadata.bible.book === 'string'
      ) {
        return metadata.bible.book;
      }
      if (
        metadata &&
        typeof metadata === 'object' &&
        'fia' in metadata &&
        metadata.fia &&
        typeof metadata.fia === 'object' &&
        'bookId' in metadata.fia &&
        typeof metadata.fia.bookId === 'string'
      ) {
        return metadata.fia.bookId;
      }
    } catch {
      // Ignore parse errors
    }
    return undefined;
  }, [selectedQuest?.metadata]);

  const enableFia = useLocalStore((s) => s.enableFia);

  // Extract FIA metadata from quest (null for Bible quests)
  const fiaMetaExtracted = React.useMemo(() => {
    if (!selectedQuest?.metadata) return null;
    return extractFiaMetadata(selectedQuest.metadata);
  }, [selectedQuest?.metadata]);

  const fiaPericopeId = enableFia
    ? (fiaMetaExtracted?.pericopeId ?? null)
    : null;

  // Build the ordered verse sequence for FIA pericopes (null for standard chapters)
  const pericopeSequence = React.useMemo<ChapterVerse[] | null>(() => {
    if (!fiaMetaExtracted?.verseRange || !fiaMetaExtracted.bookId) return null;
    const parsed = parseFiaVerseRange(fiaMetaExtracted.verseRange);
    if (!parsed) return null;
    const bibleBookId = getBibleBookIdFromFia(fiaMetaExtracted.bookId);
    return buildPericopeSequence(
      bibleBookId,
      parsed.startChapter,
      parsed.startVerse,
      parsed.endChapter,
      parsed.endVerse
    );
  }, [fiaMetaExtracted]);

  const pericopeBookShortName = React.useMemo<string | null>(() => {
    if (!fiaMetaExtracted?.bookId) return null;
    const bibleBookId = getBibleBookIdFromFia(fiaMetaExtracted.bookId);
    return BIBLE_BOOKS.find((b) => b.id === bibleBookId)?.shortName ?? null;
  }, [fiaMetaExtracted]);

  // Store book name and chapter number for VerseSeparator label
  const bookChapterLabelRef = React.useRef<string>('Verse');
  const formatVersePositionRef = React.useRef<
    ((position: number) => string | null) | undefined
  >(undefined);

  // Calculate book chapter label (short name for separators)
  const bookChapterLabel = React.useMemo(() => {
    if (!selectedQuest || !currentBookId) {
      return 'Verse';
    }

    if (selectedQuest.metadata) {
      // FIA pericope: use just the book short name — the chapter number is
      // part of the per-verse label produced by the pericope sequence mapper.
      if (pericopeSequence && pericopeBookShortName) {
        return pericopeBookShortName;
      }

      // Try FIA metadata (non-pericope fallback)
      const fiaMeta = extractFiaMetadata(selectedQuest.metadata);
      if (fiaMeta?.verseRange && fiaMeta.bookId) {
        const bibleBookId = getBibleBookIdFromFia(fiaMeta.bookId);
        const book = BIBLE_BOOKS.find((b) => b.id === bibleBookId);
        const parsed = parseFiaVerseRange(fiaMeta.verseRange);
        if (book && parsed) {
          if (parsed.startChapter === parsed.endChapter) {
            return `${book.shortName} ${parsed.startChapter}`;
          }
          return `${book.shortName} ${parsed.startChapter}-${parsed.endChapter}`;
        }
        return selectedQuest.name || 'Verse';
      }

      // Try Bible metadata
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
          const chapterNum =
            typeof metadata.bible.chapter === 'number'
              ? metadata.bible.chapter
              : undefined;
          if (typeof chapterNum === 'number') {
            const book = BIBLE_BOOKS.find((b) => b.id === currentBookId);
            if (book?.name && chapterNum) {
              return `${book.shortName} ${chapterNum}`;
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return 'Verse';
  }, [selectedQuest, currentBookId, pericopeSequence, pericopeBookShortName]);

  // Update refs when label / formatter changes
  React.useEffect(() => {
    bookChapterLabelRef.current = bookChapterLabel;
  }, [bookChapterLabel]);

  const verseCount = React.useMemo(() => {
    if (!selectedQuest || !currentBookId) return 0;

    // FIA pericopes: the sequence length IS the verse count
    if (pericopeSequence && pericopeSequence.length > 0) {
      return pericopeSequence.length;
    }

    if (selectedQuest.metadata) {
      // Try Bible metadata
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
          const chapterNum =
            typeof metadata.bible.chapter === 'number'
              ? metadata.bible.chapter
              : undefined;
          if (typeof chapterNum === 'number') {
            const book = BIBLE_BOOKS.find((b) => b.id === currentBookId);
            return book?.verses[chapterNum - 1] ?? 0;
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return 0;
  }, [selectedQuest, currentBookId, pericopeSequence]);

  // For FIA pericopes: map a 1-based position to a display label like "Mrk 2:23"
  const formatVersePosition = React.useCallback(
    (position: number): string | null => {
      if (!pericopeSequence || !pericopeBookShortName) return null;
      return formatPericopeVerseLabel(
        pericopeBookShortName,
        pericopeSequence,
        position
      );
    },
    [pericopeSequence, pericopeBookShortName]
  );

  React.useEffect(() => {
    formatVersePositionRef.current = pericopeSequence
      ? formatVersePosition
      : undefined;
  }, [pericopeSequence, formatVersePosition]);

  // Query project data to get privacy status if not passed
  const { data: queriedProjectData } = useHybridQuery({
    queryKey: ['project-privacy-assets', projectId],
    offlineQuery: toCompilableQuery(
      system.db.query.project.findFirst({
        where: eq(project.id, projectId!),
        columns: { id: true, private: true, creator_id: true }
      })
    ),
    cloudQueryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('id, private, creator_id')
        .eq('id', projectId);
      if (error) throw error;
      return data as Pick<
        typeof project.$inferSelect,
        'id' | 'private' | 'creator_id'
      >[];
    },
    enableCloudQuery: !!projectId,
    enableOfflineQuery: !!projectId,
    getItemId: (item) => item.id
  });

  const projectPrivacyData = queriedProjectData?.[0];
  const isPrivateProject = projectPrivacyData?.private ?? false;

  // Track selected item for recording insertion
  // Can be an asset (insert after) or a separator (insert at beginning of verse)
  const [selectedForRecording, setSelectedForRecording] = React.useState<{
    type: 'asset' | 'separator';
    assetId?: string; // Only for type === 'asset'
    separatorKey?: string; // Only for type === 'separator'
    orderIndex: number;
    metadata: AssetMetadata | null;
    verseName: string; // e.g., "1:5" or "1:5-7"
    name?: string;
  } | null>(null);

  const { membership } = useUserPermissions(
    projectId || '',
    'open_project',
    !!isPrivateProject
  );

  const isOwner = membership === 'owner';
  const isMember = membership === 'member' || membership === 'owner';
  // Check if user is creator
  const isCreator = currentUser?.id === projectPrivacyData?.creator_id;
  // User can see published badge if they are creator, member, or owner
  const canSeePublishedBadge = isCreator || isMember;

  // FIA steps guide recording, so only members and owners see them, and only
  // on unpublished quests. Wait for the quest to load so a published quest
  // never flashes the steps open.
  const fiaStepsPericopeId =
    isMember && selectedQuest && !isPublished ? fiaPericopeId : null;

  const { fiaLanguageCode } = useProjectFiaLanguageCode(
    fiaStepsPericopeId ? projectId : undefined
  );

  const needsFiaRecache = Boolean(
    fiaStepsPericopeId &&
    fiaLanguageCode &&
    !isFiaPericopeCached(fiaLanguageCode, fiaStepsPericopeId)
  );

  // Fetch all FIA steps (only for FIA pericope quests)
  const { data: fiaStepsData, isLoading: fiaStepsLoading } =
    useFiaPericopeSteps(
      fiaStepsPericopeId ? projectId : undefined,
      fiaStepsPericopeId ?? undefined
    );

  // Auto-open FIA steps drawer once per quest per session.
  // Open immediately when guide content must be downloaded (e.g. post LQ-17 recache).
  // When cached, open after data is ready. If the user dismissed the drawer, don't reopen
  // unless content is missing and needs a fresh download.
  // Wait for the version-label prompt to finish so it isn't covered by FIA instructions.
  React.useEffect(() => {
    if (!fiaStepsPericopeId || !questId) return;
    if (awaitingVersionLabel || showRenameQuestLabelDrawer) return;

    const dismissed = fiaDrawerDismissedQuests.has(questId);
    if (dismissed && !needsFiaRecache) return;

    if (needsFiaRecache) {
      setShowFiaTextDrawer(true);
      return;
    }

    if (fiaStepsData && !fiaStepsLoading) {
      setShowFiaTextDrawer(true);
    }
  }, [
    awaitingVersionLabel,
    fiaStepsPericopeId,
    fiaStepsData,
    fiaStepsLoading,
    needsFiaRecache,
    questId,
    showRenameQuestLabelDrawer
  ]);

  const questDownloadFlow = useQuestDownloadFlow(projectId || '');

  // Query SQLite directly - single source of truth, no cache, no race conditions
  const isQuestDownloaded =
    useQuestDownloadStatusLive(questId || null) ||
    questDownloadFlow.downloadedQuestIds.has(questId || '');

  // Clean deeper layers
  const currentStatus = useStatusContext();
  currentStatus.layerStatus(LayerType.QUEST, questId || '');
  const showInvisibleContent = useLocalStore((s) => s.showHiddenContent);
  const enableMerge = useLocalStore((s) => s.enableMerge);
  const enableAssetImport = useLocalStore((s) => s.enableAssetImport);
  const allowImportAssets = React.useMemo(
    () =>
      parseQuestMetadata(selectedQuest?.metadata).allowImportAssets === true,
    [selectedQuest?.metadata]
  );

  // Call both hooks unconditionally to comply with React Hooks rules
  const publishedAssets = useAssetsByQuest(
    questId || '',
    debouncedSearchQuery,
    showInvisibleContent
  );
  const localAssets = useLocalAssetsByQuest(
    questId || '',
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
    isFetching
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
        if (asset.source !== 'cloud' && existing.source === 'cloud') {
          assetMap.set(asset.id, asset);
        }
      }
    }

    return Array.from(assetMap.values());
  }, [data.pages]);

  const importWizardVerseLabels = React.useMemo<
    ImportWizardVerseLabel[]
  >(() => {
    return manualSeparators.map((separator) => ({
      key: separator.key,
      from: separator.from,
      to: separator.to,
      source: 'manual'
    }));
  }, [manualSeparators]);

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

  // Used when opening BibleRecordingView without a selected verse, to continue
  // after the last unassigned asset instead of starting from DEFAULT_ORDER_INDEX
  const lastUnassignedOrderIndex = React.useMemo(
    () => findLastUnassignedOrderIndex(assets),
    [assets]
  );

  const listItems = React.useMemo(
    () => buildVerseList(assets, manualSeparators),
    [assets, manualSeparators]
  );

  // The list only contains matching assets while searching, so reordering it
  // would renumber and relabel a partial view of the chapter.
  const isSearchActive =
    searchQuery.trim() !== '' || debouncedSearchQuery.trim() !== '';

  // Keep a ref to assets for stable callback (avoids recreating on every asset change)
  const assetsRef = React.useRef(assets);
  React.useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  // Handler for selecting/deselecting an asset for recording insertion
  // Optimized with ref to avoid recreation on every asset change
  // Handle single selection for published quests (for playAll start point)
  const handleToggleSelect = React.useCallback(
    (assetId: string) => {
      if (isPublished) {
        // Single selection: if already selected, deselect. Otherwise, select only this one.
        if (selectedAssetIds.has(assetId)) {
          cancelSelection();
        } else {
          // Clear all and select only this one
          cancelSelection();
          toggleSelect(assetId);
        }
      } else {
        // Multi-selection for batch operations when not published
        toggleSelect(assetId);
      }
    },
    [isPublished, selectedAssetIds, cancelSelection, toggleSelect]
  );

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
        verseName,
        name: asset.name ?? (undefined as string | undefined)
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

      const orderIndex = verseStartOrderIndex(from ?? UNASSIGNED_VERSE_BASE);

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
    },
    [selectedForRecording?.type, selectedForRecording?.separatorKey]
  );

  // Handle batch delete of selected assets
  // Handle delete all assets
  const handleDeleteAllAssets = React.useCallback(async () => {
    if (!questId) return;

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
      const counterKey = `bible_recording_counter_${questId}`;
      await AsyncStorage.removeItem(counterKey);

      setSelectedForRecording(null);
      void invalidateCloud(queryClient, 'assets');

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
  }, [assets, questId, queryClient, t]);

  const handleBatchDeleteSelected = React.useCallback(() => {
    // Filter selected assets that are local (not cloud-only)
    const selectedAssets = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );

    if (selectedAssets.length < 1) return;

    const shouldRequireConfirmation =
      selectedAssets.length > MAX_ASSETS_WITHOUT_CONFIRMATION;

    const runBatchDelete = async (allowUndo: boolean) => {
      try {
        if (!questId) return;
        if (!allowUndo) {
          clearUndoHistory();
        }

        const selectedIds = selectedAssets.map((asset) => asset.id);
        const previousData = await softDeleteAssetsFromQuest(
          questId,
          selectedIds
        );
        if (allowUndo) {
          pushUndoHistory({
            domain: 'asset',
            action: 'delete',
            previousData,
            newData: [],
            canUndo: true
          });
        }

        cancelSelection();
        setSelectedForRecording(null);
        void invalidateCloud(queryClient, 'assets');

        console.log(
          `✅ Batch delete completed: ${selectedAssets.length} assets`
        );
      } catch (e) {
        console.error('Failed to batch delete assets', e);
        RNAlert.alert(t('error'), 'Failed to delete assets. Please try again.');
      }
    };

    if (!shouldRequireConfirmation) {
      void runBatchDelete(true);
      return;
    }

    RNAlert.alert(
      t('deleteAssets'),
      t('deleteAssetsConfirmation').replace(
        '{count}',
        String(selectedAssets.length)
      ),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('delete'),
          style: 'destructive',
          isPreferred: true,
          onPress: () => {
            void runBatchDelete(false);
          }
        }
      ]
    );
  }, [
    assets,
    cancelSelection,
    clearUndoHistory,
    pushUndoHistory,
    queryClient,
    questId,
    selectedAssetIds,
    t
  ]);

  // Handle batch merge of selected assets
  const handleBatchMergeSelected = React.useCallback(() => {
    // Filter selected assets that are local (not cloud-only)
    const selectedAssets = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );

    if (selectedAssets.length < 2) return;

    const shouldRequireConfirmation =
      selectedAssets.length > MAX_ASSETS_WITHOUT_CONFIRMATION;

    const runBatchMerge = async (allowUndo: boolean) => {
      try {
        if (!questId) return;
        if (!allowUndo) {
          clearUndoHistory();
        }

        const merged = await softMergeAssetsInQuest({
          questId,
          assetsToMerge: selectedAssets.map((asset) => ({
            id: asset.id
          })),
          fallbackProjectId: projectId ?? null,
          fallbackCreatorId: currentUser?.id ?? null
        });

        if (!merged) return;

        if (allowUndo) {
          pushUndoHistory({
            domain: 'asset',
            action: 'merge',
            previousData: merged.previousData,
            newData: merged.newData,
            canUndo: true
          });
        }

        cancelSelection();
        setSelectedForRecording(null);

        console.log(
          `✅ Batch merge completed: ${selectedAssets.length} assets merged into ${merged.newAssetId.slice(0, 8)}`
        );
      } catch (e) {
        console.error('Failed to batch merge assets', e);
        RNAlert.alert(t('error'), 'Failed to merge assets. Please try again.');
      }
    };

    if (!shouldRequireConfirmation) {
      void runBatchMerge(true);
      return;
    }

    RNAlert.alert(
      t('mergeAssets'),
      t('mergeAssetsConfirmation').replace(
        '{count}',
        String(selectedAssets.length)
      ),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('merge'),
          style: 'destructive',
          isPreferred: true,
          onPress: () => {
            void runBatchMerge(false);
          }
        }
      ]
    );
  }, [
    assets,
    selectedAssetIds,
    currentUser,
    cancelSelection,
    clearUndoHistory,
    projectId,
    pushUndoHistory,
    questId,
    t
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
      if (!renameAssetId || !questId) return;

      try {
        // renameAsset will validate that this is a local-only asset
        // and throw if it's synced (immutable)
        await renameAsset(questId, renameAssetId, newName);

        pushUndoHistory({
          domain: 'asset',
          action: 'rename',
          previousData: [{ id: renameAssetId, name: renameAssetName }],
          newData: [{ id: renameAssetId, name: newName }],
          canUndo: true
        });
      } catch (error) {
        console.error('❌ Failed to rename asset:', error);
        if (error instanceof Error) {
          console.warn('⚠️ Rename blocked:', error.message);
          RNAlert.alert(t('error'), error.message);
        }
      }
    },
    [renameAssetId, renameAssetName, pushUndoHistory, t]
  );

  const handleUndoAction = React.useCallback(() => {
    if (!currentUndoOperation?.canUndo) return;

    if (!projectId || !questId) {
      console.warn('[Undo] Missing projectId or questId, cannot execute undo');
      return;
    }

    void undoHistory(async (entry) => {
      const operation = {
        ...(entry as AssetOperationTypes),
        domain: 'asset'
      } as AssetOperationTypes;

      await undoAssetOperation(projectId, questId, operation);

      const message = getAssetOperationMessage(operation, 'undo');
      toast.info(t('undo'), {
        description: t(message.key).replace('{count}', String(message.count))
      });
    });
  }, [currentUndoOperation, projectId, questId, t, undoHistory]);

  const handleRedoAction = React.useCallback(() => {
    if (!currentRedoOperation?.canUndo) return;

    if (!projectId || !questId) {
      console.warn('[Redo] Missing projectId or questId, cannot execute redo');
      return;
    }

    void redoHistory(async (entry) => {
      const operation = {
        ...(entry as AssetOperationTypes),
        domain: 'asset'
      } as AssetOperationTypes;

      await redoAssetOperation(projectId, questId, operation);

      const message = getAssetOperationMessage(operation, 'redo');
      toast.info(t('redo'), {
        description: t(message.key).replace('{count}', String(message.count))
      });
    });
  }, [currentRedoOperation, projectId, questId, redoHistory, t]);

  const buildMoveHistoryEntries = React.useCallback(
    (updates: AssetUpdatePayload[]) => {
      const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
      const previousData: AssetOperationDataItem[] = [];
      const newData: AssetOperationDataItem[] = [];

      for (const update of updates) {
        const current = assetsById.get(update.assetId);
        if (!current) continue;

        const currentMetadata = parseAssetMetadata(current.metadata);
        const nextMetadata =
          update.metadata !== undefined ? update.metadata : currentMetadata;
        const nextOrderIndex =
          update.order_index !== undefined
            ? update.order_index
            : current.order_index;

        previousData.push({
          id: current.id,
          order_index: current.order_index,
          metadata: currentMetadata as Record<string, any> | null
        });
        newData.push({
          id: current.id,
          order_index: nextOrderIndex,
          metadata: (nextMetadata ?? null) as Record<string, any> | null
        });
      }

      return { previousData, newData };
    },
    [assets]
  );

  // Writes verse/order changes and records undo for the ones that landed.
  // Resolves false (after telling the user) if any placement failed.
  const applyVerseUpdates = React.useCallback(
    async (updates: AssetUpdatePayload[]): Promise<boolean> => {
      if (updates.length === 0 || !questId) return true;

      const history = buildMoveHistoryEntries(updates);
      const recordUndo = (appliedAssetIds: string[]) => {
        const applied = new Set(appliedAssetIds);
        const previousData = history.previousData.filter((item) =>
          applied.has(item.id)
        );
        if (previousData.length === 0) return;
        pushUndoHistory({
          domain: 'asset',
          action: 'move',
          previousData,
          newData: history.newData.filter((item) => applied.has(item.id)),
          canUndo: true
        });
      };

      try {
        recordUndo(await batchUpdateAssetVerse(questId, updates));
        return true;
      } catch (error) {
        if (error instanceof AssetVerseUpdateError) {
          recordUndo(error.appliedAssetIds);
        }
        console.error('Failed to update verse placement:', error);
        toast.error(t('verseLabelsSaveFailed'));
        return false;
      }
    },
    [buildMoveHistoryEntries, pushUndoHistory, questId, t]
  );

  // Adds a label. With an assetId, the label goes above that asset and is
  // written to it and the assets below it in the same group.
  const addVerseSeparator = React.useCallback(
    async (from: number, to: number, assetId?: string) => {
      const key = `manual-sep-${from}-${to}-${Date.now()}`;
      setManualSeparators((prev) => [...prev, { from, to, key, assetId }]);
      if (!assetId) return;

      const assetIndex = listItems.findIndex(
        (item) => item.type === 'asset' && item.content.id === assetId
      );
      if (assetIndex === -1) return;

      const saved = await applyVerseUpdates(
        assignGroupFrom(listItems, assetIndex, { from, to })
      );
      if (!saved) {
        setManualSeparators((prev) => prev.filter((sep) => sep.key !== key));
      }
    },
    [applyVerseUpdates, listItems]
  );

  // Drop manual labels once an asset carries the same range; the label derived
  // from asset metadata takes over from there.
  React.useEffect(() => {
    const persisted = new Set(
      manualSeparators
        .filter((sep) =>
          assets.some((asset) => {
            const verse = getVerseRange(asset);
            return verse?.from === sep.from && verse.to === sep.to;
          })
        )
        .map((sep) => sep.key)
    );
    if (persisted.size > 0) {
      setManualSeparators((prev) =>
        prev.filter((sep) => !persisted.has(sep.key))
      );
    }
  }, [assets, manualSeparators]);

  // Relabels a separator and the assets below it, up to the next separator
  const updateVerseSeparator = React.useCallback(
    async (separatorKey: string, range: VerseRange) => {
      setManualSeparators((prev) =>
        prev.map((sep) =>
          sep.key === separatorKey ? { ...sep, ...range } : sep
        )
      );

      const separatorIndex = listItems.findIndex(
        (item) => item.type === 'separator' && item.key === separatorKey
      );
      if (separatorIndex === -1) return;

      await applyVerseUpdates(
        assignGroupFrom(listItems, separatorIndex + 1, range)
      );
    },
    [applyVerseUpdates, listItems]
  );

  const getAvailableVerses = React.useCallback(
    () => unlabeledVerses(listItems, verseCount),
    [listItems, verseCount]
  );

  const getMaxToForFrom = React.useCallback(
    (selectedFrom: number) =>
      maxToForNewLabel(listItems, selectedFrom, verseCount),
    [listItems, verseCount]
  );

  // Existing labels for quick selection in VerseAssigner
  const existingLabels = React.useMemo(
    () => labelRanges(listItems),
    [listItems]
  );

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
  const selectedAssetsHaveLabels = React.useMemo(
    () =>
      assets.some(
        (asset) => selectedAssetIds.has(asset.id) && !!getVerseRange(asset)
      ),
    [selectedAssetIds, assets]
  );

  // Imported assets cannot be merged — keep Merge disabled if any are selected
  const canMergeSelection = React.useMemo(() => {
    if (selectedAssetIds.size < 2) return false;
    for (const asset of assets) {
      if (!selectedAssetIds.has(asset.id)) continue;
      if (isImportedAsset(asset.metadata)) return false;
    }
    return true;
  }, [assets, selectedAssetIds]);

  // Handle applying verse label to selected assets
  const handleAssignVerseToSelected = React.useCallback(
    async (from: number, to: number) => {
      const selectedAssets = assets.filter(
        (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
      );

      if (selectedAssets.length === 0) return;

      // Append after the assets already in this verse
      const lastSequence = lastSequenceInVerse(assets, from, selectedAssetIds);
      const updates: AssetUpdatePayload[] = selectedAssets.map(
        (asset, index) => ({
          assetId: asset.id,
          metadata: {
            ...(parseAssetMetadata(asset.metadata) ?? {}),
            verse: { from, to }
          },
          order_index: orderIndexFor(from, lastSequence + index + 1)
        })
      );

      if (!(await applyVerseUpdates(updates))) return;

      setShowVerseAssignerDrawer(false);
      cancelSelection();
      setSelectedForRecording(null);
    },
    [assets, selectedAssetIds, applyVerseUpdates, cancelSelection]
  );

  // Handle removing labels from selected assets
  const handleRemoveLabelFromSelected = React.useCallback(async () => {
    const selectedAssets = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );

    if (selectedAssets.length === 0) return;

    // Append to the end of the unassigned section
    const lastSequence = lastSequenceInVerse(
      assets,
      UNASSIGNED_VERSE_BASE,
      selectedAssetIds
    );
    const updates: AssetUpdatePayload[] = selectedAssets.map(
      (asset, index) => ({
        assetId: asset.id,
        metadata: {
          ...(parseAssetMetadata(asset.metadata) ?? {}),
          verse: undefined
        },
        order_index: orderIndexFor(
          UNASSIGNED_VERSE_BASE,
          lastSequence + index + 1
        )
      })
    );

    if (!(await applyVerseUpdates(updates))) return;

    setShowVerseAssignerDrawer(false);
    cancelSelection();
    setSelectedForRecording(null);
  }, [assets, selectedAssetIds, applyVerseUpdates, cancelSelection]);

  const _blockedCount = useBlockedAssetsCount(questId || '');

  const handleAssetUpdate = React.useCallback(async () => {}, []);

  // Verses free for a new label directly above an asset
  const getRangeForAsset = React.useCallback(
    (assetId: string) => {
      const assetIndex = listItems.findIndex(
        (item) => item.type === 'asset' && item.content.id === assetId
      );
      if (assetIndex === -1) {
        return { from: 1, to: verseCount || 1, availableVerses: [] };
      }
      return openRangeAt(listItems, assetIndex, verseCount);
    },
    [listItems, verseCount]
  );

  // Verses a separator can be edited to without overlapping its neighbors
  const getRangeForSeparator = React.useCallback(
    (separatorKey: string) => {
      const separatorIndex = listItems.findIndex(
        (item) => item.type === 'separator' && item.key === separatorKey
      );
      if (separatorIndex === -1) {
        return { from: 1, to: verseCount || 1, availableVerses: [] };
      }
      return openRangeAt(listItems, separatorIndex, verseCount);
    },
    [listItems, verseCount]
  );

  const getMaxToForFromSeparator = React.useCallback(
    (separatorKey: string, selectedFrom: number): number => {
      const range = getRangeForSeparator(separatorKey);
      return range.availableVerses.includes(selectedFrom)
        ? range.to
        : selectedFrom;
    },
    [getRangeForSeparator]
  );

  // Stable wrapper for onPlay callback (avoids creating new function in renderItem)
  const blockIndividualPlayRef = React.useRef(false);
  const stableOnPlay = React.useCallback((assetId: string) => {
    if (blockIndividualPlayRef.current) {
      return;
    }
    handlePlayAssetRef.current(assetId);
  }, []);

  // Stable callbacks for DraggableAssetItem (to prevent recreation on each render)
  const handleAddVersePressRef = React.useRef<
    ((assetId: string) => void) | undefined
  >(undefined);
  handleAddVersePressRef.current = (assetId: string) => {
    const range = getRangeForAsset(assetId);
    setAssetVerseSelectorState({
      isOpen: true,
      assetId,
      from: range.from,
      to: range.to
    });
  };

  const handleQuickAddVersePressRef = React.useRef<
    ((assetId: string) => void) | undefined
  >(undefined);
  handleQuickAddVersePressRef.current = (assetId: string) => {
    const nextVerse = getRangeForAsset(assetId).availableVerses[0];
    if (nextVerse === undefined) {
      return;
    }
    void addVerseSeparator(nextVerse, nextVerse, assetId);
    // Clear recording selection when any label is added
    setSelectedForRecording(null);
  };

  const handleEditSeparatorRef = React.useRef<
    ((key: string, from?: number, to?: number) => void) | undefined
  >(undefined);
  handleEditSeparatorRef.current = (
    key: string,
    from?: number,
    to?: number
  ) => {
    setEditSeparatorState({
      isOpen: true,
      separatorKey: key,
      from,
      to
    });
  };

  const handleStartRecordingRef = React.useRef<(() => void) | undefined>(
    undefined
  );

  const canDrag = !isPublished && !isSelectionMode && !isSearchActive;

  // Render function for ReorderableList - uses the new draggable wrapper components
  const renderItem = React.useCallback(
    ({ item, index }: { item: ListItem; index: number }) => {
      if (item.type === 'separator') {
        const isSeparatorSelected =
          selectedForRecording?.type === 'separator' &&
          selectedForRecording?.separatorKey === item.key;

        return (
          <Animated.View
            key={item.key}
            entering={
              ENABLE_BIBLE_ASSET_LIST_TRANSITIONS
                ? FadeIn.duration(160)
                : undefined
            }
            exiting={
              ENABLE_BIBLE_ASSET_LIST_TRANSITIONS
                ? FadeOut.duration(120)
                : undefined
            }
            layout={
              ENABLE_BIBLE_ASSET_LIST_TRANSITIONS
                ? LinearTransition.duration(160)
                : undefined
            }
          >
            <DraggableSeparator
              item={item}
              isPublished={isPublished}
              isSelectionMode={isSelectionMode}
              isSeparatorSelected={isSeparatorSelected}
              canDrag={canDrag}
              isDragFixed={index === 0}
              bookChapterLabel={bookChapterLabelRef.current}
              formatVerse={formatVersePositionRef.current}
              onPress={
                !isPublished
                  ? () =>
                      handleEditSeparatorRef.current?.(
                        item.key,
                        item.from,
                        item.to
                      )
                  : undefined
              }
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
              onStartRecording={
                isSeparatorSelected
                  ? () => handleStartRecordingRef.current?.()
                  : undefined
              }
            />
          </Animated.View>
        );
      }

      // Handle asset items
      const asset = item.content;
      const isPlaying =
        (audioContext.isPlaying &&
          (audioContext.currentAudioId === asset.id ||
            (audioContext.currentAudioId === PLAY_ALL_AUDIO_ID &&
              currentlyPlayingAssetId === asset.id))) ||
        currentlyPlayingAssetId === asset.id;

      const isSelected = selectedAssetIds.has(asset.id);

      const isAssetSelectedForRecording =
        !isPublished &&
        selectedForRecording?.type === 'asset' &&
        selectedForRecording?.assetId === asset.id;

      const assetRange = isAssetSelectedForRecording
        ? getRangeForAsset(asset.id)
        : null;
      const hasAvailableVerses = assetRange
        ? assetRange.availableVerses.length > 0
        : false;

      return (
        <Animated.View
          key={asset.id}
          entering={
            ENABLE_BIBLE_ASSET_LIST_TRANSITIONS
              ? FadeIn.duration(160)
              : undefined
          }
          exiting={
            ENABLE_BIBLE_ASSET_LIST_TRANSITIONS
              ? FadeOut.duration(120)
              : undefined
          }
          layout={
            ENABLE_BIBLE_ASSET_LIST_TRANSITIONS
              ? LinearTransition.duration(160)
              : undefined
          }
        >
          <DraggableAssetItem
            asset={asset}
            questId={questId || ''}
            isPublished={isPublished}
            isPlaying={isPlaying}
            playDisabled={showPlayAllControls}
            isHighlighted={
              asset.metadata?.recordingSessionId ==
              selectedQuest?.metadata?.lastRecordingSessionId
            }
            isSelected={isSelected}
            isSelectionMode={!isPublished && isSelectionMode}
            isAssetSelectedForRecording={isAssetSelectedForRecording}
            hasAvailableVerses={hasAvailableVerses}
            showDragHandle={canDrag}
            onPlay={stableOnPlay}
            onToggleSelect={handleToggleSelect}
            onEnterSelection={!isPublished ? enterSelection : undefined}
            onSelectForRecording={
              !isPublished ? handleSelectForRecording : undefined
            }
            onRename={!isPublished ? handleRenameAsset : undefined}
            onAddVersePress={
              isAssetSelectedForRecording && hasAvailableVerses
                ? () => handleAddVersePressRef.current?.(asset.id)
                : undefined
            }
            onQuickAddVersePress={
              isAssetSelectedForRecording && hasAvailableVerses
                ? () => handleQuickAddVersePressRef.current?.(asset.id)
                : undefined
            }
            onStartRecording={
              isAssetSelectedForRecording
                ? () => handleStartRecordingRef.current?.()
                : undefined
            }
          />
        </Animated.View>
      );
    },
    [
      isPublished,
      canDrag,
      questId,
      audioContext.isPlaying,
      audioContext.currentAudioId,
      currentlyPlayingAssetId,
      stableOnPlay,
      getRangeForAsset,
      isSelectionMode,
      selectedAssetIds,
      handleToggleSelect,
      enterSelection,
      selectedForRecording?.type,
      selectedForRecording?.assetId,
      selectedForRecording?.separatorKey,
      handleSelectForRecording,
      handleSelectSeparatorForRecording,
      handleRenameAsset,
      selectedQuest?.metadata?.lastRecordingSessionId
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

  const {
    hasReported,
    // isLoading: isReportLoading,
    refetch: refetchReport
  } = useHasUserReported(questId || '', 'quests');

  const statusContext = useStatusContext();
  const { allowSettings } = statusContext.getStatusParams(
    LayerType.QUEST,
    questId
  );

  // Special audio ID for "play all" mode
  const PLAY_ALL_AUDIO_ID = 'play-all-assets';

  const getAssetAudioUris = React.useCallback(
    (assetId: string) => getPlayableAssetAudioUris(assetId),
    []
  );

  // Calculate which asset should be highlighted based on position
  // NOTE: This is only used for handlePlayAsset (individual)
  // handlePlayAll (new function) controls currentlyPlayingAssetId directly
  const derivedCurrentlyPlayingAssetId = React.useMemo(() => {
    // Not playing at all
    if (!audioContext.isPlaying) {
      return null;
    }

    // Playing a single asset (not play-all mode) - return directly
    if (audioContext.currentAudioId !== PLAY_ALL_AUDIO_ID) {
      return audioContext.currentAudioId;
    }

    return null;
  }, [
    audioContext.isPlaying,
    audioContext.currentAudioId,
    audioContext.position
  ]);

  const playbackCheckpoint = useAudioPlaybackCheckpoint();
  const {
    isPlayAllRunning,
    isPlayAllPaused,
    isPlayAllRunningRef,
    togglePlayAll,
    stopPlayAll,
    stopAndResetPlayAll,
    togglePlayPausePlayAll,
    nextPlayAllItem,
    previousPlayAllItem,
    rewindPlayAll,
    forwardPlayAll
  } = usePlayAllAudioController({
    checkpointStore: playbackCheckpoint,
    onCurrentAssetChange: ({ assetId }) => {
      setCurrentlyPlayingAssetId(assetId);
    },
    onPlaybackStatusUpdate: (status, payload) => {
      if (status.playing) {
        audioContext.positionShared.value = payload.assetPositionMs;
        audioContext.durationShared.value = payload.assetDurationMs;
        setCurrentPlayAllSegmentIndex(payload.uriIndex + 1);
        setCurrentPlayAllTotalSegments(payload.item.uris.length);
      }
    },
    onStopped: () => {
      audioContext.positionShared.value = 0;
      audioContext.durationShared.value = 0;
      setCurrentPlayAllSegmentIndex(null);
      setCurrentPlayAllTotalSegments(null);
      setShowPlayAllControls(false);
    },
    onFinished: () => {
      audioContext.positionShared.value = 0;
      audioContext.durationShared.value = 0;
      setCurrentPlayAllSegmentIndex(null);
      setCurrentPlayAllTotalSegments(null);
      setShowPlayAllControls(false);
    },
    onError: () => {
      audioContext.positionShared.value = 0;
      audioContext.durationShared.value = 0;
      setCurrentPlayAllSegmentIndex(null);
      setCurrentPlayAllTotalSegments(null);
      setShowPlayAllControls(false);
    }
  });

  const currentPlayAllAssetName = React.useMemo(() => {
    if (!currentlyPlayingAssetId) {
      return null;
    }
    return (
      assets.find((asset) => asset.id === currentlyPlayingAssetId)?.name ?? null
    );
  }, [assets, currentlyPlayingAssetId]);

  const currentSingleAsset = React.useMemo(() => {
    const assetId = audioContext.currentAudioId;
    if (!assetId) {
      return null;
    }
    return assets.find((asset) => asset.id === assetId) ?? null;
  }, [assets, audioContext.currentAudioId]);

  const currentSingleAssetName = currentSingleAsset?.name ?? null;

  const showSingleControls =
    !showPlayAllControls &&
    !!audioContext.currentAudioId &&
    audioContext.currentAudioId !== PLAY_ALL_AUDIO_ID &&
    !!currentSingleAsset &&
    (audioContext.isPlaying || audioContext.isPaused);
  const isIndividualPlayerActive = showSingleControls;
  const isPlayAllPlayerActive = showPlayAllControls || isPlayAllRunning;

  React.useEffect(() => {
    blockIndividualPlayRef.current = isPlayAllPlayerActive;
  }, [isPlayAllPlayerActive]);

  // Ref to hold latest audioContext for cleanup (avoids stale closure)
  const audioContextCurrentRef = React.useRef(audioContext);
  React.useEffect(() => {
    audioContextCurrentRef.current = audioContext;
  }, [audioContext]);

  // Update state only for handlePlayAsset and handlePlayAllAssets
  // handlePlayAll controls state directly so we skip when it's running
  React.useEffect(() => {
    // Skip if handlePlayAll is controlling the state directly
    if (isPlayAllRunningRef.current) {
      return;
    }

    // Only update if we're in audioContext-controlled playback mode
    if (
      audioContext.isPlaying &&
      (audioContext.currentAudioId === PLAY_ALL_AUDIO_ID ||
        audioContext.currentAudioId)
    ) {
      setCurrentlyPlayingAssetId(derivedCurrentlyPlayingAssetId);
    } else if (!audioContext.isPlaying && !audioContext.currentAudioId) {
      // Clear highlight when audio finishes naturally
      setCurrentlyPlayingAssetId(null);
    }
  }, [
    derivedCurrentlyPlayingAssetId,
    audioContext.isPlaying,
    audioContext.currentAudioId
  ]);

  // Handle play all - plays all assets sequentially with direct asset-audio linking
  // Uses assets that have isAssetSelectedForRecording={true} in BibleAssetListItem (determined by selectedForRecording)
  // Takes selectedAsset as parameter to avoid recreating the function when selection changes

  const handlePlayAll = React.useCallback(
    async (
      selectedAsset?: { type: 'asset' | 'separator'; assetId?: string } | null
    ) => {
      if (isIndividualPlayerActive) {
        return;
      }

      // Determine which assets to process based on selection state
      let assetsToProcess: AssetQuestLink[];

      if (selectedAsset?.type === 'asset' && selectedAsset?.assetId) {
        const selectedIndex = assets.findIndex(
          (a) => a.id === selectedAsset.assetId
        );
        assetsToProcess =
          selectedIndex >= 0 ? assets.slice(selectedIndex) : assets;
      } else if (selectedAssetIds.size > 0) {
        const firstSelectedIndex = assets.findIndex((a) =>
          selectedAssetIds.has(a.id)
        );
        assetsToProcess =
          firstSelectedIndex >= 0 ? assets.slice(firstSelectedIndex) : assets;
      } else {
        assetsToProcess = assets;
      }

      if (assetsToProcess.length === 0) {
        console.warn('⚠️ No assets to play');
        return;
      }

      const playlist: { assetId: string; uris: string[] }[] = [];
      for (const asset of assetsToProcess) {
        const uris = await getAssetAudioUris(asset.id);
        if (uris.length > 0) {
          playlist.push({ assetId: asset.id, uris });
        }
      }

      if (playlist.length === 0) {
        console.warn('⚠️ No audio URIs found for any assets');
        return;
      }

      await togglePlayAll({
        playlist,
        playlistKey: questId ? `bible-assets:${questId}` : undefined
      });
    },
    [
      assets,
      getAssetAudioUris,
      isIndividualPlayerActive,
      questId,
      selectedAssetIds,
      togglePlayAll
    ]
  );

  // Handle going to recording - stops any playing audio first
  const handleGoToRecording = React.useCallback(async () => {
    if (!questId) {
      console.error('Cannot start recording without quest ID');
      return;
    }

    if (selectedQuest?.source === 'cloud') {
      RNAlert.alert(t('downloadRequired'), t('downloadQuestToView'));
      return;
    }

    // Stop PlayAll if running
    if (isPlayAllRunningRef.current) {
      stopPlayAll();
    }

    // Stop any other audio from audioContext
    if (audioContext.isPlaying) {
      await audioContext.stopCurrentSound();
    }

    // Navigate to recording view
    await whenAssetWritesIdle(questId);

    let recordingOrderIndex: number | undefined;
    if (selectedForRecording?.assetId) {
      recordingOrderIndex =
        (await getQuestAssetOrderIndex(
          questId,
          selectedForRecording.assetId
        )) ?? selectedForRecording.orderIndex;
    } else {
      recordingOrderIndex =
        (await getMaxQuestOrderIndex(questId, { unassignedOnly: true })) ??
        lastUnassignedOrderIndex;
    }

    try {
      const recordingSessionId = await createQuestRecordingSession(questId);

      goToRecording({
        recordingSession: recordingSessionId,
        bookChapterLabel: bookChapterLabel,
        bookChapterLabelFull: selectedQuest?.name,
        initialOrderIndex: recordingOrderIndex,
        verse: selectedForRecording?.metadata?.verse,
        nextVerse: nextVerse,
        limitVerse: limitVerse,
        label: selectedForRecording?.verseName,
        pericopeSequence: pericopeSequence ?? undefined,
        bookShortName: pericopeBookShortName ?? undefined
      });
    } catch (error) {
      console.error('Failed to create quest recording session:', error);
      RNAlert.alert(t('error'), t('error'));
    }
  }, [
    audioContext,
    goToRecording,
    questId,
    projectId,
    bookChapterLabel,
    selectedQuest?.name,
    selectedQuest?.source,
    selectedForRecording?.orderIndex,
    selectedForRecording?.metadata?.verse,
    selectedForRecording?.verseName,
    lastUnassignedOrderIndex,
    nextVerse,
    limitVerse,
    pericopeSequence,
    pericopeBookShortName,
    isPlayAllRunningRef,
    stopPlayAll,
    t
  ]);

  handleStartRecordingRef.current = () => {
    void handleGoToRecording();
  };

  // Cleanup effect: Stop audio when component unmounts
  React.useEffect(() => {
    return () => {
      // Stop audio playback if playing (access via ref for latest state)
      if (audioContextCurrentRef.current.isPlaying) {
        void audioContextCurrentRef.current.stopCurrentSound();
      }

      // Stop PlayAll if running
      if (isPlayAllRunningRef.current) {
        stopPlayAll();
      }

      // Reset state
      playbackCheckpoint.clearAllCheckpoints();
      setCurrentlyPlayingAssetId(null);
    };
  }, [isPlayAllRunningRef, playbackCheckpoint, stopPlayAll]);

  const {
    playAsset: handlePlayAsset,
    toggleCurrentAssetPlayPause,
    stopAndResetCurrentAsset,
    rewindCurrentAsset,
    forwardCurrentAsset
  } = useSingleAudioController({
    audioContext,
    checkpointStore: playbackCheckpoint,
    getAssetAudioUris,
    onCurrentAssetChange: (assetId) => {
      setCurrentlyPlayingAssetId(assetId);
    },
    onNoAudioFound: (assetId) => {
      console.warn('⚠️ No audio URIs found for asset:', assetId);
    },
    onError: (error) => {
      console.error('❌ Failed to play audio:', error);
      setCurrentlyPlayingAssetId(null);
    },
    log: (action, assetId) => {
      if (action === 'pause') {
        console.log('⏸️ Pausing asset:', assetId.slice(0, 8));
      } else if (action === 'resume') {
        console.log('▶️ Resuming asset:', assetId.slice(0, 8));
      } else {
        console.log('▶️ Playing asset:', assetId.slice(0, 8));
      }
    }
  });

  // Update ref so renderItem can use it
  handlePlayAssetRef.current = handlePlayAsset;

  // Handle publish button press with useMutation
  const { mutate: publishQuest, isPending: isPublishing } = useMutation({
    mutationFn: async () => {
      if (!questId || !projectId) {
        throw new Error('Missing quest or project ID');
      }
      console.log(`📤 Publishing quest ${questId}...`);
      const result = await publishQuestUtils(questId, projectId);
      return result;
    },
    onSuccess: async (result) => {
      if (result.success) {
        await invalidateOfflineChapterLists(queryClient);
        await invalidateCloud(queryClient, 'quests', 'current-quest', 'assets');
      } else {
        RNAlert.alert(t('error'), result.message || t('error'), [
          { text: t('ok'), isPreferred: true }
        ]);
      }
    },
    onError: (error) => {
      console.error('Publish error:', error);
      RNAlert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedCreateTranslation'),
        [{ text: t('ok'), isPreferred: true }]
      );
    }
  });

  const questDownloadAction = resolveQuestDownloadAction({
    isSignedIn: Boolean(currentUser),
    isLocal: selectedQuest?.source === 'local',
    isDownloaded: isQuestDownloaded,
    isPublished: selectedQuest?.published_at != null
  });
  const isQuestDownloading =
    !isQuestDownloaded &&
    !!questId &&
    questDownloadFlow.downloadingQuestIds.has(questId);
  const handleDownloadClick = () => {
    if (questId) questDownloadFlow.download(questId);
  };
  // Offloaded quests are no longer on-device; leave the assets screen.
  const handleOffloadClick = () => {
    if (questId) questDownloadFlow.offload(questId, { leaveQuest: true });
  };

  // A refused drop leaves `listItems` unchanged, so the list snaps back.
  const handleReorder = React.useCallback(
    async ({ from, to }: ReorderableListReorderEvent) => {
      const plan = planReorder(listItems, from, to);
      if (!plan.ok) {
        toast.warning(t(REORDER_REJECTION_MESSAGE[plan.reason]));
        return;
      }
      await applyVerseUpdates(plan.updates);
    },
    [applyVerseUpdates, listItems, t]
  );

  const { project: projectForName } = useProjectById(projectId);

  if (!questId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>{t('noQuestSelected')}</Text>
      </View>
    );
  }

  const projectName = projectForName?.name || '';
  const hasFloatingPlayer = showPlayAllControls || showSingleControls;
  const hasFloatingSelectionControls =
    isSelectionMode && !isPublished && !!currentUser;
  const canRecord =
    !isPublished && !!currentUser && selectedQuest?.source !== 'cloud';
  const listBottomSpacerHeight = hasFloatingPlayer
    ? insets.bottom + 96
    : hasFloatingSelectionControls
      ? insets.bottom + 96
      : 0;

  return (
    <View className="flex flex-1 flex-col gap-4 px-6 pb-6 pt-1">
      {selectedQuest?.name && (
        <Stack.Screen
          options={{
            title: formatQuestDisplayLabel(
              selectedQuest.name,
              selectedQuest.metadata
            )
          }}
        />
      )}
      {isPlayAllPlayerActive && <KeepAwakeGuard />}
      <View className="flex flex-row items-center justify-between">
        <Text className="text-base font-semibold">{t('assets')}</Text>
        <View className="flex flex-row items-center gap-2">
          <View className="flex flex-row items-center gap-2">
            <QuestDownloadButton
              action={questDownloadAction}
              isDownloading={isQuestDownloading}
              onDownload={handleDownloadClick}
              onOffload={handleOffloadClick}
            />
            {isPublished ? (
              // Show cloud badge and export button if user is creator, member, or owner
              canSeePublishedBadge ? (
                <>
                  <QuestSyncedBadge
                    questId={questId}
                    questName={selectedQuest?.name}
                  />
                  {questId && projectId && (
                    <ExportButton
                      questId={questId}
                      projectId={projectId}
                      questName={selectedQuest?.name}
                      disabled={isPublishing || !isOnline}
                      membership={membership}
                      passedQuestPublished={isPublished}
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
              // Only show publish/export buttons for authenticated users
              currentUser && (
                <>
                  <PublishQuestButton
                    questId={questId}
                    questName={selectedQuest?.name}
                    disabled={isPublishing || !isOnline || !isMember}
                    isPublishing={isPublishing}
                    isOnline={isOnline}
                    isMember={isMember}
                    hasLocalAssets={assets.length > 0}
                    onPublish={() => publishQuest()}
                  />
                  {questId && projectId && (
                    <ExportButton
                      questId={questId}
                      projectId={projectId}
                      questName={selectedQuest?.name}
                      disabled={isPublishing || !isOnline}
                      membership={membership}
                    />
                  )}
                  {enableAssetImport &&
                    allowImportAssets &&
                    questId &&
                    projectId &&
                    selectedQuest && (
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={isPublishing || !isMember}
                        onPress={() => setShowImportWizard(true)}
                        className="border-2 border-primary bg-primary/10"
                        testID="assets-import"
                        accessibilityLabel="assets-import"
                      >
                        <Icon
                          as={DownloadIcon}
                          size={18}
                          className="font-bold text-primary"
                        />
                        {/*


                      <Text className="text-sm font-medium text-primary">
                        Import
                      </Text>
                        */}
                      </Button>
                    )}
                </>
              )
            )}
          </View>
        </View>
      </View>
      <View className="flex w-full flex-row items-center">
        <View className="flex-1 flex-row items-center gap-1">
          {fiaStepsPericopeId && (
            <Button
              variant="default"
              size="icon"
              disabled={isPlayAllPlayerActive}
              onPress={() => setShowFiaTextDrawer(true)}
              style={isPlayAllPlayerActive ? { opacity: 0.5 } : undefined}
              className="size-10 rounded-full bg-primary"
            >
              <Icon
                as={BookOpenIcon}
                size={20}
                className="text-primary-foreground"
              />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={isRefreshing || isPlayAllPlayerActive}
            onPress={async () => {
              setIsRefreshing(true);
              console.log('🔄 Manually refreshing assets queries...');
              await invalidateCloud(queryClient, 'assets');
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
          {!isPublished && currentUser && (
            <Button
              variant="ghost"
              size="icon"
              onPress={() => {
                setNewLabelSelectorState({
                  isOpen: true
                });
              }}
              disabled={
                isPlayAllPlayerActive ||
                !isOnline ||
                verseCount === 0 ||
                getAvailableVerses().length === 0
              }
            >
              <Icon as={BookmarkPlusIcon} className="text-primary" />
            </Button>
          )}
        </View>
        <View className="flex-row items-center gap-1">
          {!isPublished && (
            <>
              <Button
                variant="ghost"
                size="icon"
                disabled={!hasUndoHistory || !currentUndoOperation?.canUndo}
                onPress={handleUndoAction}
                testID="assets-undo"
                accessibilityLabel="assets-undo"
              >
                <Icon as={Undo2} size={18} className="text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!hasRedoHistory || !currentRedoOperation?.canUndo}
                onPress={handleRedoAction}
                testID="assets-redo"
                accessibilityLabel="assets-redo"
              >
                <Icon as={Redo2} size={18} className="text-primary" />
              </Button>
            </>
          )}
        </View>
        <View className="flex-1 flex-row items-center justify-end gap-1">
          {assets.length > 0 && (
            <Button
              variant="secondary"
              size="icon"
              disabled={isIndividualPlayerActive && !isPlayAllPlayerActive}
              onPress={() => {
                if (isPlayAllPlayerActive) {
                  stopAndResetPlayAll();
                  setShowPlayAllControls(false);
                  return;
                }
                if (!isPlayAllRunning) {
                  playbackCheckpoint.clearPlayAllCheckpoint();
                  setShowPlayAllControls(true);
                  void handlePlayAll(selectedForRecording);
                }
              }}
              className="rounded-full"
            >
              <Icon
                as={PlayIcon}
                size={16}
                className="text-secondary-foreground"
              />
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

      {isLoading ? (
        searchQuery.trim().length > 0 ? (
          <View className="flex-1 items-center justify-center pt-8">
            <ActivityIndicator size="large" color={getThemeColor('primary')} />
            <Text className="mt-4 text-muted-foreground">{t('searching')}</Text>
          </View>
        ) : (
          <AssetListSkeleton />
        )
      ) : (
        <ReorderableList
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          onReorder={handleReorder}
          dragEnabled={canDrag}
          autoscrollThreshold={0.15}
          autoscrollSpeedScale={1.5}
          onScroll={scrollHandler}
          ItemSeparatorComponent={() => <View className="h-1" />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <View className="flex-col items-center gap-2">
                <Text className="text-muted-foreground">
                  {canRecord ? t('nothingHereYet') : t('noAssetsFound')}
                </Text>
                {canRecord && (
                  <Icon
                    as={ArrowBigDownDashIcon}
                    size={48}
                    className="text-muted-foreground"
                  />
                )}
              </View>
            </View>
          }
          ListFooterComponent={
            <>
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
              {listBottomSpacerHeight > 0 && (
                <View style={{ height: listBottomSpacerHeight }} />
              )}
            </>
          }
        />
      )}

      {/* Hide SpeedDial in selection mode */}
      {!isSelectionMode && (
        <View
          style={{
            bottom: insets.bottom + 32,
            ...(isPublished ? { right: 24 } : { left: 24 })
          }}
          className="absolute z-50"
        >
          <SpeedDial>
            <SpeedDialItems className="rounded-full">
              {/* For anonymous users, only show info button */}
              {currentUser ? (
                <>
                  {allowSettings && isOwner ? (
                    <SpeedDialItem
                      className="rounded-full"
                      icon={SettingsIcon}
                      variant="outline"
                      onPress={() => setShowSettingsModal(true)}
                    />
                  ) : !hasReported ? (
                    <SpeedDialItem
                      className="rounded-full"
                      icon={FlagIcon}
                      variant="outline"
                      onPress={() => setShowReportModal(true)}
                    />
                  ) : null}
                </>
              ) : null}
              {!isPublished && currentUser && (
                <SpeedDialItem
                  className="rounded-full"
                  icon={BrushCleaning}
                  variant="outline"
                  onPress={() => setShowDeleteAllDrawer(true)}
                />
              )}
              {!isPublished && currentUser && (
                <SpeedDialItem
                  className="rounded-full"
                  icon={FilePenIcon}
                  variant="outline"
                  onPress={() => setShowRenameQuestLabelDrawer(true)}
                />
              )}
              {/* Info button always visible */}
              <SpeedDialItem
                icon={InfoIcon}
                className="rounded-full"
                variant="outline"
                onPress={() => {
                  console.log('📋 [Info] Opening details modal', {
                    selectedQuest: selectedQuest?.id,
                    isDownloaded: isQuestDownloaded
                  });
                  setShowDetailsModal(true);
                }}
              />
            </SpeedDialItems>
            <SpeedDialTrigger
              className="-top-0.5 size-10 rounded-full text-destructive-foreground"
              // openClassName="bg-secondary text-white"
              // closedClassName="bg-secondary text-white"
            />
          </SpeedDial>
        </View>
      )}

      {/* Sticky Record Button Footer - only show for authenticated users */}
      {!showPlayAllControls &&
        !showSingleControls &&
        canRecord &&
        (isSelectionMode ? (
          <View
            style={{
              paddingBottom: insets.bottom,
              paddingRight: isSelectionMode ? 0 : 50 // Leave space for SpeedDial when not in selection mode
            }}
            className="absolute bottom-0 left-0 right-0 z-40"
          >
            <RecordSelectionControls
              selectedCount={selectedAssetIds.size}
              onCancel={cancelSelection}
              onMerge={handleBatchMergeSelected}
              onDelete={handleBatchDeleteSelected}
              allowAssignVerse={true}
              onAssignVerse={() => setShowVerseAssignerDrawer(true)}
              showMerge={enableMerge}
              canMerge={canMergeSelection}
            />
          </View>
        ) : (
          !selectedForRecording && (
            <View
              style={{
                paddingBottom: insets.bottom + 6,
                paddingRight: isSelectionMode ? 0 : 50 // Leave space for SpeedDial when not in selection mode
              }}
              className="px-2"
            >
              <RecordButton
                onPress={() => void handleGoToRecording()}
                className="ml-14"
                size="large"
              />
            </View>
          )
        ))}
      {showPlayAllControls && (
        <AudioPlayerControls
          mode="playAll"
          position="footer"
          currentAssetName={currentPlayAllAssetName}
          currentSegmentIndex={currentPlayAllSegmentIndex}
          totalSegments={currentPlayAllTotalSegments}
          isPlaying={isPlayAllRunning && !isPlayAllPaused}
          isPaused={isPlayAllPaused}
          positionShared={audioContext.positionShared}
          durationShared={audioContext.durationShared}
          onPrevious={previousPlayAllItem}
          onRewind={rewindPlayAll}
          onPlayPause={togglePlayPausePlayAll}
          onForward={forwardPlayAll}
          onNext={nextPlayAllItem}
          onStop={() => {
            stopAndResetPlayAll();
            setShowPlayAllControls(false);
          }}
        />
      )}
      {showSingleControls && (
        <AudioPlayerControls
          mode="individual"
          position="footer"
          currentAssetName={currentSingleAssetName}
          isPlaying={audioContext.isPlaying}
          isPaused={audioContext.isPaused}
          positionShared={audioContext.positionShared}
          durationShared={audioContext.durationShared}
          onRewind={() => {
            void rewindCurrentAsset();
          }}
          onPlayPause={() => {
            void toggleCurrentAssetPlayPause();
          }}
          onStop={() => {
            void stopAndResetCurrentAsset();
          }}
          onForward={() => {
            void forwardCurrentAsset();
          }}
        />
      )}
      {/* )} */}

      {enableAssetImport && allowImportAssets && selectedQuest && projectId && (
        <ImportWizard
          visible={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          projectId={projectId}
          currentQuest={selectedQuest}
          currentAssets={assets}
          availableVerses={getAvailableVerses()}
          verseCount={verseCount}
          targetVerseLabels={importWizardVerseLabels}
          formatVerse={formatVersePositionRef.current}
          chapterSequence={pericopeSequence ?? undefined}
          onImported={(linkedSnapshots) => {
            if (linkedSnapshots.length === 0) return;
            pushUndoHistory({
              domain: 'asset',
              action: 'import',
              previousData: [],
              newData: linkedSnapshots,
              canUndo: true
            });
          }}
        />
      )}

      {allowSettings && isOwner && showSettingsModal && (
        <QuestSettingsModal
          isVisible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          questId={questId}
          projectId={projectId || ''}
          questSource={selectedQuest?.source}
          onOffloadClick={
            questDownloadAction === 'offload' ? handleOffloadClick : undefined
          }
        />
      )}

      {/* Delete All Assets Drawer */}
      {showDeleteAllDrawer && (
        <AssetsDeletionDrawer
          isOpen={showDeleteAllDrawer}
          onClose={() => setShowDeleteAllDrawer(false)}
          onConfirm={handleDeleteAllAssets}
          title="Delete All Assets?"
          description="All assets in this quest will be permanently deleted. This action is irreversible and cannot be undone."
          confirmationString={selectedQuest?.name || 'DELETE'}
        />
      )}
      {showRenameQuestLabelDrawer && selectedQuest && (
        <QuestLabelHandler
          isOpen={showRenameQuestLabelDrawer}
          questId={questId}
          questName={selectedQuest.name}
          metadata={selectedQuest.metadata}
          isPublished={isPublished}
          onOpenChange={(open) => {
            setShowRenameQuestLabelDrawer(open);
            if (!open) {
              setAwaitingVersionLabel(false);
            }
          }}
          onSaved={() => {
            void invalidateCloud(
              queryClient,
              'current-quest',
              'bible-chapters',
              'fia-pericope-quests'
            );
          }}
        />
      )}
      {showDetailsModal && selectedQuest && (
        <ModalDetails
          isVisible={showDetailsModal}
          contentType="quest"
          content={selectedQuest}
          onClose={() => setShowDetailsModal(false)}
          isDownloaded={isQuestDownloaded}
        />
      )}
      {showReportModal && (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={questId}
          recordTable="quest"
          hasAlreadyReported={hasReported}
          creatorId={selectedQuest?.creator_id ?? undefined}
          onReportSubmitted={() => refetchReport()}
        />
      )}

      {questDownloadFlow.sheets}

      {/* Rename Asset Drawer */}
      {showRenameDrawer && (
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
      )}

      {/* Batch Verse Assignment Drawer */}
      {showVerseAssignerDrawer && (
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
              formatLabel={formatVersePositionRef.current ?? undefined}
              chapterSequence={pericopeSequence ?? undefined}
              onApply={(from, to) => {
                void handleAssignVerseToSelected(from, to);
              }}
              onCancel={() => setShowVerseAssignerDrawer(false)}
              onRemove={handleRemoveLabelFromSelected}
              hasSelectedAssetsWithLabels={selectedAssetsHaveLabels}
              className="mx-4"
              ScrollViewComponent={GHScrollView}
            />
          </DrawerContent>
        </Drawer>
      )}

      {/* Private Access Gate Modal for Membership Requests */}
      {isPrivateProject && showPrivateAccessModal && (
        <PrivateAccessGate
          projectId={projectId || ''}
          projectName={projectName}
          isPrivate={isPrivateProject as boolean}
          action="contribute"
          modal={true}
          isVisible={showPrivateAccessModal}
          onClose={() => setShowPrivateAccessModal(false)}
        />
      )}

      {/* Verse Range Selector Drawer for editing existing separator */}
      {verseSelectorState.isOpen && (
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
                formatLabel={formatVersePositionRef.current ?? undefined}
                chapterSequence={pericopeSequence ?? undefined}
                onApply={(from, to) => {
                  void addVerseSeparator(from, to);
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
      )}

      {/* Verse Range Selector Drawer for adding new label */}
      {newLabelSelectorState.isOpen && (
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
                formatLabel={formatVersePositionRef.current ?? undefined}
                chapterSequence={pericopeSequence ?? undefined}
                onApply={(from, to) => {
                  void addVerseSeparator(from, to);
                  // Clear recording selection when any label is added
                  setSelectedForRecording(null);
                  setNewLabelSelectorState({ isOpen: false });
                }}
                onCancel={() => setNewLabelSelectorState({ isOpen: false })}
              />
            </View>
          </DrawerContent>
        </Drawer>
      )}

      {/* Verse Range Selector Drawer for adding label above asset */}
      {assetVerseSelectorState.isOpen && (
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
                formatLabel={formatVersePositionRef.current ?? undefined}
                chapterSequence={pericopeSequence ?? undefined}
                onApply={(from, to) => {
                  void addVerseSeparator(
                    from,
                    to,
                    assetVerseSelectorState.assetId ?? undefined
                  );
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
      )}

      {/* Verse Range Selector Drawer for editing separator */}
      {editSeparatorState.isOpen && (
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
                  formatLabel={formatVersePositionRef.current ?? undefined}
                  chapterSequence={pericopeSequence ?? undefined}
                  onApply={async (from, to) => {
                    if (editSeparatorState.separatorKey) {
                      await updateVerseSeparator(
                        editSeparatorState.separatorKey,
                        { from, to }
                      );
                    }
                    // Clear recording selection when any label is edited
                    // This ensures we don't have stale order_index references
                    setSelectedForRecording(null);
                    setEditSeparatorState({
                      isOpen: false,
                      separatorKey: null
                    });
                  }}
                  onCancel={() =>
                    setEditSeparatorState({ isOpen: false, separatorKey: null })
                  }
                />
              )}
            </View>
          </DrawerContent>
        </Drawer>
      )}

      {/* FIA Pericope Steps Drawer */}
      <FiaStepDrawer
        open={showFiaTextDrawer && !!fiaStepsPericopeId}
        onOpenChange={(open) => {
          setShowFiaTextDrawer(open);
          if (!open && questId) {
            fiaDrawerDismissedQuests.add(questId);
          }
        }}
        projectId={projectId}
        pericopeId={fiaStepsPericopeId ?? undefined}
        questName={selectedQuest?.name}
        fiaBookId={fiaMetaExtracted?.bookId}
        verseRange={fiaMetaExtracted?.verseRange}
        persistedState={fiaDrawerStateRef}
      />
    </View>
  );
}
