import type { ArrayInsertionWheelHandle } from '@/components/ArrayInsertionWheel';
import ArrayInsertionWheel from '@/components/NewArrayInsertionWheel';
import { VerseAssigner } from '@/components/VerseAssigner';
import { VerseSeparator } from '@/components/VerseSeparator';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import type { AssetMetadata } from '@/database_services/assetService';
import {
  batchUpdateAssetMetadata,
  renameAsset,
  updateAssetMetadata
} from '@/database_services/assetService';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import {
  asset,
  asset_content_link,
  project_language_link,
  quest_asset_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { resolveTable } from '@/utils/dbUtils';
import {
  fileExists,
  getLocalAttachmentUriWithOPFS,
  saveAudioLocally
} from '@/utils/fileUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import type { LegendListRef } from '@legendapp/list';
import { LegendList } from '@legendapp/list';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQueryClient } from '@tanstack/react-query';
import { and, asc, eq, getTableColumns } from 'drizzle-orm';
import { Audio } from 'expo-av';
import {
  ArrowLeft,
  ArrowUpDown,
  BookmarkPlusIcon,
  PauseIcon,
  PlayIcon
} from 'lucide-react-native';
import React from 'react';
import { InteractionManager, View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHybridData } from '../../useHybridData';
import { useSelectionMode } from '../hooks/useSelectionMode';
import { useVADRecording } from '../hooks/useVADRecording';
import { getNextOrderIndex, saveRecording } from '../services/recordingService';
import { FullScreenVADOverlay } from './FullScreenVADOverlay';
import { LabeledAssetCard } from './LabeledAssetCard';
import { RecordingControls } from './NewRecordingControls';
import { RenameAssetModal } from './RenameAssetModal';
import { SelectionControls } from './SelectionControls';
import { VADSettingsDrawer } from './VADSettingsDrawer';

// Feature flag: true = use ArrayInsertionWheel, false = use LegendList
const USE_INSERTION_WHEEL = true;
const DEBUG_MODE = false;
function debugLog(...args: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

interface UIAsset {
  id: string;
  name: string;
  created_at: string;
  order_index: number;
  source: 'local' | 'synced' | 'cloud';
  segmentCount: number;
  duration?: number; // Total duration in milliseconds
  metadata?: string | { verse?: { from: number; to: number } } | null;
  labelId?: number; // ID of the verse label this asset belongs to
}

interface RecordingViewSimplifiedProps {
  onBack: () => void;
  // Pass existing assets as initial data to avoid redundant query
  initialAssets?: unknown[];
}

const RecordingViewSimplified = ({
  onBack,
  initialAssets
}: RecordingViewSimplifiedProps) => {
  const queryClient = useQueryClient();
  const { t } = useLocalization();
  const navigation = useCurrentNavigation();
  const { currentQuestId, currentProjectId, currentBookId, currentQuestData } =
    navigation;
  const { currentUser } = useAuth();
  const { project: currentProject } = useProjectById(currentProjectId);
  const audioContext = useAudio();
  const insets = useSafeAreaInsets();

  // Get target languoid_id from project_language_link
  const { data: targetLanguoidLink = [] } = useHybridData<{
    languoid_id: string | null;
  }>({
    dataType: 'project-target-languoid-id',
    queryKeyParams: [currentProjectId || ''],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ languoid_id: project_language_link.languoid_id })
        .from(project_language_link)
        .where(
          and(
            eq(project_language_link.project_id, currentProjectId!),
            eq(project_language_link.language_type, 'target')
          )
        )
        .limit(1)
    ),
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid_id')
        .eq('project_id', currentProjectId)
        .eq('language_type', 'target')
        .not('languoid_id', 'is', null)
        .limit(1)
        .overrideTypes<{ languoid_id: string | null }[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!currentProjectId,
    enableOfflineQuery: !!currentProjectId
  });

  const targetLanguoidId = targetLanguoidLink[0]?.languoid_id;

  // Recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [isVADLocked, setIsVADLocked] = React.useState(false);

  // Active verse state - when set, this verse will be applied to new recordings
  const [activeVerse, setActiveVerse] = React.useState<{
    from: number;
    to: number;
  } | null>(null);

  // VAD settings - persisted in local store for consistent UX
  // These settings are automatically saved to AsyncStorage and restored on app restart
  // Default: threshold=0.03 (normal sensitivity), silenceDuration=1000ms (1 second pause)
  const vadThreshold = useLocalStore((state) => state.vadThreshold);
  const setVadThreshold = useLocalStore((state) => state.setVadThreshold);
  const vadSilenceDuration = useLocalStore((state) => state.vadSilenceDuration);
  const setVadSilenceDuration = useLocalStore(
    (state) => state.setVadSilenceDuration
  );
  const vadDisplayMode = useLocalStore((state) => state.vadDisplayMode);
  const setVadDisplayMode = useLocalStore((state) => state.setVadDisplayMode);
  const [showVADSettings, setShowVADSettings] = React.useState(false);
  const [autoCalibrateOnOpen, setAutoCalibrateOnOpen] = React.useState(false);

  // Track current recording order index
  const currentRecordingOrderRef = React.useRef<number>(0);
  const vadCounterRef = React.useRef<number | null>(null);
  const dbWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  // Track pending asset names to prevent duplicates when recording multiple assets quickly
  const pendingAssetNamesRef = React.useRef<Set<string>>(new Set());

  // Track which asset is currently playing during play-all
  const [currentlyPlayingAssetId, setCurrentlyPlayingAssetId] = React.useState<
    string | null
  >(null);
  const assetUriMapRef = React.useRef<Map<string, string>>(new Map()); // URI -> assetId
  const segmentDurationsRef = React.useRef<number[]>([]); // Duration of each URI segment in ms
  // Track segment ranges for each asset (start position, end position, duration)
  const assetSegmentRangesRef = React.useRef<
    Map<string, { startMs: number; endMs: number; durationMs: number }>
  >(new Map());
  // Track last scrolled asset to avoid scrolling to the same asset multiple times
  const lastScrolledAssetIdRef = React.useRef<string | null>(null);

  // Create SharedValues for each asset's progress (0-100 percentage)
  // We need to create them at the top level, so we'll create a pool and map them
  // Store the mapping in a ref that gets updated when assets change
  const assetProgressSharedMapRef = React.useRef<
    Map<string, ReturnType<typeof useSharedValue<number>>>
  >(new Map());

  // Create SharedValues for assets (max 100 assets supported)
  // We create a pool and reuse them - must create at top level (hooks rule)
  const progressPool0 = useSharedValue(0);
  const progressPool1 = useSharedValue(0);
  const progressPool2 = useSharedValue(0);
  const progressPool3 = useSharedValue(0);
  const progressPool4 = useSharedValue(0);
  const progressPool5 = useSharedValue(0);
  const progressPool6 = useSharedValue(0);
  const progressPool7 = useSharedValue(0);
  const progressPool8 = useSharedValue(0);
  const progressPool9 = useSharedValue(0);
  // Create more if needed (extend this pattern or use a different approach)
  const progressPool = React.useRef([
    progressPool0,
    progressPool1,
    progressPool2,
    progressPool3,
    progressPool4,
    progressPool5,
    progressPool6,
    progressPool7,
    progressPool8,
    progressPool9
  ]).current;

  // Insertion wheel state
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  // Real-time index updated during scroll (for button label calculation)
  const [realTimeIndex, setRealTimeIndex] = React.useState(0);
  // Track if wheel is currently scrolling to hide button during scroll
  const [isWheelScrolling, setIsWheelScrolling] = React.useState(false);
  // Debounce ref for wheel scrolling - button reappears after delay
  const wheelScrollDebounceRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const WHEEL_SCROLL_DEBOUNCE_MS = 300; // ms before button reappears
  const wheelRef = React.useRef<ArrayInsertionWheelHandle>(null);

  // Cleanup debounce timeout on unmount
  React.useEffect(() => {
    return () => {
      if (wheelScrollDebounceRef.current) {
        clearTimeout(wheelScrollDebounceRef.current);
      }
    };
  }, []);

  // Sort order state: 'original' = by recording order, 'verse' = by verse metadata
  const [sortOrder, setSortOrder] = React.useState<'original' | 'verse'>(
    'verse'
  );

  // Track footer height for proper scrolling
  const [footerHeight, setFooterHeight] = React.useState(0);
  const ROW_HEIGHT = 80;

  // Selection mode for batch operations (merge, delete)
  const {
    isSelectionMode,
    selectedAssetIds,
    enterSelection,
    toggleSelect,
    cancelSelection
  } = useSelectionMode();

  // Rename modal state
  const [showRenameModal, setShowRenameModal] = React.useState(false);
  const [renameAssetId, setRenameAssetId] = React.useState<string | null>(null);
  const [renameAssetName, setRenameAssetName] = React.useState<string>('');

  // Verse assigner modal state
  const [showVerseAssignerModal, setShowVerseAssignerModal] =
    React.useState(false);

  // Track segment counts for each asset (loaded lazily)
  const [assetSegmentCounts, setAssetSegmentCounts] = React.useState<
    Map<string, number>
  >(new Map());

  // Track durations for each asset (loaded lazily)
  const [assetDurations, setAssetDurations] = React.useState<
    Map<string, number>
  >(new Map());

  // Load quest data to get verse count
  const questTable = resolveTable('quest', { localOverride: true });
  type Quest = typeof questTable.$inferSelect;
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

  // Prefer queried data (fresh) over navigation data (may be stale)
  const selectedQuest = React.useMemo(() => {
    if (queriedQuestData.length > 0) {
      return queriedQuestData[0];
    }
    if (currentQuestData) {
      return currentQuestData as Quest;
    }
    return undefined;
  }, [currentQuestData, queriedQuestData]);

  // Store book name and chapter number for VerseSeparator label
  const bookChapterLabelRef = React.useRef<string>('Verse');

  // Calculate book chapter label
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
  const verseCount = React.useMemo(() => {
    if (!selectedQuest || !currentBookId) {
      return 0;
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

    if (typeof chapterNum !== 'number') return 0;
    const book = BIBLE_BOOKS.find((b) => b.id === currentBookId);
    return book?.verses[chapterNum - 1] ?? 0;
  }, [selectedQuest, currentBookId]);

  // Load assets from database
  // Use initialAssets if provided to avoid redundant query and instant render
  const {
    data: rawAssets = [],
    isOfflineLoading,
    isError,
    offlineError
  } = useHybridData({
    dataType: 'assets',
    queryKeyParams: [currentQuestId],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          ...getTableColumns(asset),
          quest_id: quest_asset_link.quest_id
        })
        .from(asset)
        .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
        .where(eq(quest_asset_link.quest_id, currentQuestId!))
        .orderBy(asc(asset.order_index), asc(asset.created_at), asc(asset.name))
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select('asset:asset_id(*)')
        .eq('quest_id', currentQuestId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;

      return data.map((d: { asset: unknown }) => d.asset).filter(Boolean);
    },
    enableOfflineQuery: true,
    enableCloudQuery: true,
    lazyLoadCloud: true, // Show local data immediately
    getItemId: (item) => {
      const typedItem = item as unknown as { id: string };
      return typedItem.id;
    },
    // Use initial data if provided - renders instantly with cached data
    offlineQueryOptions: initialAssets
      ? {
          initialData: initialAssets,
          staleTime: 0 // Still refetch to ensure fresh data
        }
      : undefined
  });

  // Normalize assets
  // ARCHITECTURE:
  // - Asset: A single recording or merged group of recordings
  // - Segment: One content_link row (merged assets have multiple segments)
  // - Audio file: Individual audio file (each segment has audio[] array)
  //
  // METADATA (loaded lazily in background):
  // - segmentCount: Number of content_link rows for this asset
  // - duration: Sum of all audio files' durations across all segments
  const assets = React.useMemo((): UIAsset[] => {
    const result = rawAssets
      .filter((a) => {
        const obj = a as {
          id?: string;
          name?: string;
          created_at?: string;
          source?: string;
        } | null;
        return obj?.id && obj.name && obj.created_at && obj.source;
      })
      .map((a, index) => {
        const obj = a as {
          id: string;
          name: string;
          created_at: string;
          order_index?: number | null;
          source: 'local' | 'synced' | 'cloud';
          metadata?: string | { verse?: { from: number; to: number } } | null;
        };
        // Get segment count and duration from lazy-loaded maps
        // Default to 1 segment if not loaded yet, undefined for duration (shows loading state)
        const segmentCount = assetSegmentCounts.get(obj.id) ?? 1;
        const duration = assetDurations.get(obj.id); // undefined if not loaded yet

        // DEBUG: Log assets with metadata
        if (obj.metadata) {
          debugLog(
            `📋 Asset "${obj.name}" (${obj.id.slice(0, 8)}) has metadata:`,
            obj.metadata
          );
        }

        // DEBUG: Log assets with multiple segments
        if (segmentCount > 1) {
          debugLog(
            `📊 Asset "${obj.name}" (${obj.id.slice(0, 8)}) has ${segmentCount} segments`
          );
        }

        return {
          id: obj.id,
          name: obj.name,
          created_at: obj.created_at,
          order_index:
            typeof obj.order_index === 'number' ? obj.order_index : index,
          source: obj.source,
          segmentCount,
          duration,
          metadata: obj.metadata
        };
      });

    // DEBUG: Summary of segment counts
    const multiSegmentAssets = result.filter((a) => a.segmentCount > 1);
    if (multiSegmentAssets.length > 0) {
      debugLog(
        `📊 Total assets with multiple segments: ${multiSegmentAssets.length}`
      );
    }

    return result;
  }, [rawAssets, assetSegmentCounts, assetDurations]);

  // Map assets to SharedValues from the pool (after assets is declared)
  const assetIdsKey = React.useMemo(
    () => assets.map((a) => a.id).join(','),
    [assets]
  );
  React.useEffect(() => {
    if (assets.length === 0) {
      assetProgressSharedMapRef.current.clear();
      return;
    }

    const map = assetProgressSharedMapRef.current;
    map.clear();

    // Assign SharedValues from pool to assets
    for (let i = 0; i < Math.min(assets.length, progressPool.length); i++) {
      const asset = assets[i];
      if (asset) {
        // Reset the SharedValue
        progressPool[i]!.value = 0;
        map.set(asset.id, progressPool[i]!);
      }
    }
  }, [assetIdsKey, assets, progressPool]);

  // Stable asset list that only updates when content actually changes
  // Sorted by verse range (assets without metadata go to the bottom) or by original order
  const assetsForLegendList = React.useMemo(() => {
    if (sortOrder === 'original') {
      // Return assets in their original order (as they come from the database)
      return assets;
    }

    // Sort by verse metadata (verse.from)
    // Create a copy to avoid mutating the original array
    const sorted = [...assets].sort((a, b) => {
      // If one doesn't have metadata, it goes to the bottom
      if (!a.metadata && !b.metadata) return 0; // Both without metadata: maintain order
      if (!a.metadata) return 1; // a goes to bottom
      if (!b.metadata) return -1; // b goes to bottom

      // Parse JSON metadata if it's a string
      let aMetadata: unknown;
      let bMetadata: unknown;

      try {
        aMetadata =
          typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
        bMetadata =
          typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata;
      } catch {
        // If parsing fails, treat as no metadata (goes to bottom)
        if (!aMetadata) return 1;
        if (!bMetadata) return -1;
        return 0;
      }

      // Extract verse range
      const aVerse =
        aMetadata && typeof aMetadata === 'object' && 'verse' in aMetadata
          ? (aMetadata as { verse?: { from?: number; to?: number } }).verse
              ?.from
          : undefined;
      const bVerse =
        bMetadata && typeof bMetadata === 'object' && 'verse' in bMetadata
          ? (bMetadata as { verse?: { from?: number; to?: number } }).verse
              ?.from
          : undefined;

      // If verse is undefined, treat as no metadata (goes to bottom)
      if (aVerse === undefined && bVerse === undefined) return 0;
      if (aVerse === undefined) return 1; // a goes to bottom
      if (bVerse === undefined) return -1; // b goes to bottom

      // Both have verse ranges, compare them
      return aVerse - bVerse;
    });

    return sorted;
  }, [assets, sortOrder]);

  // Helper function to extract verse from metadata
  const getVerseFromMetadata = React.useCallback(
    (
      metadata:
        | string
        | { verse?: { from: number; to: number } }
        | null
        | undefined
    ): {
      from?: number;
      to?: number;
    } | null => {
      if (!metadata) return null;

      try {
        const parsed: unknown =
          typeof metadata === 'string' ? JSON.parse(metadata) : metadata;

        if (
          parsed &&
          typeof parsed === 'object' &&
          'verse' in parsed &&
          parsed.verse &&
          typeof parsed.verse === 'object' &&
          'from' in parsed.verse
        ) {
          const verse = parsed.verse as { from: unknown; to?: unknown };
          const from = typeof verse.from === 'number' ? verse.from : undefined;
          const to =
            typeof verse.to === 'number'
              ? verse.to
              : typeof verse.from === 'number'
                ? verse.from
                : undefined;

          if (from !== undefined) {
            return { from, to };
          }
        }
      } catch {
        // Ignore parsing errors
      }

      return null;
    },
    []
  );

  // Data structure to track exactly what is at each position of the wheel
  // This allows O(1) lookup of what is at a specific insertionIndex
  type WheelItem =
    | { type: 'separator'; verse: { from: number; to: number } | null }
    | {
        type: 'asset';
        asset: UIAsset;
        verse: { from: number; to: number } | null;
      };

  const wheelStructureMap = React.useMemo((): WheelItem[] => {
    const structure: WheelItem[] = [];

    assetsForLegendList.forEach((item, index) => {
      const currentVerse = getVerseFromMetadata(item.metadata);
      const prevItem = index > 0 ? assetsForLegendList[index - 1] : null;
      const prevVerse = prevItem
        ? getVerseFromMetadata(prevItem.metadata)
        : null;

      // Determine if we need a separator before this asset
      let shouldShowVerseSeparator = false;
      if (sortOrder === 'verse') {
        if (index === 0) {
          shouldShowVerseSeparator = true;
        } else if (!currentVerse && prevVerse) {
          shouldShowVerseSeparator = true;
        } else if (currentVerse && !prevVerse) {
          shouldShowVerseSeparator = true;
        } else if (currentVerse && prevVerse) {
          shouldShowVerseSeparator =
            currentVerse.from !== prevVerse.from ||
            (currentVerse.to ?? currentVerse.from) !==
              (prevVerse.to ?? prevVerse.from);
        }
      }

      if (shouldShowVerseSeparator) {
        structure.push({
          type: 'separator',
          verse: currentVerse
            ? {
                from: currentVerse.from!,
                to: currentVerse.to ?? currentVerse.from!
              }
            : null
        });
      }

      structure.push({
        type: 'asset',
        asset: item,
        verse: currentVerse
          ? {
              from: currentVerse.from!,
              to: currentVerse.to ?? currentVerse.from!
            }
          : null
      });
    });

    return structure;
  }, [assetsForLegendList, sortOrder, getVerseFromMetadata]);

  // Calculate total number of elements in the wheel (including separators)
  // O(1) access via the pre-computed structure
  const totalWheelItems = React.useMemo(() => {
    return wheelStructureMap.length;
  }, [wheelStructureMap]);

  // Clamp insertion index when wheel items count changes
  // Note: insertionIndex represents insertion boundaries, so maxIndex = totalWheelItems
  // (can insert at 0..N boundaries, where N is the number of items)
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (USE_INSERTION_WHEEL) {
      const maxIndex = totalWheelItems; // Can insert at 0..N (after last item)
      if (insertionIndex > maxIndex) {
        debugLog(
          `📍 Clamping insertion index from ${insertionIndex} to ${maxIndex} (total wheel items: ${totalWheelItems})`
        );
        setInsertionIndex(maxIndex);
      }
    }
  }, [totalWheelItems, insertionIndex]);

  // Ref for LegendList to enable scrolling
  const listRef = React.useRef<LegendListRef>(null);

  // Track asset count to detect new insertions
  const previousAssetCountRef = React.useRef(assets.length);

  // Auto-scroll behavior differs between list and wheel
  React.useEffect(() => {
    const currentCount = assets.length;
    const previousCount = previousAssetCountRef.current;

    // Only scroll if a new asset was added (count increased)
    if (currentCount > previousCount && currentCount > 0) {
      debugLog('📜 Auto-scrolling to new asset');

      // Small delay to ensure the new item is rendered before scrolling
      setTimeout(() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (USE_INSERTION_WHEEL) {
            // For wheel: scroll to the newly inserted item's position
            // After insertion at index N, the new item is at position N
            const newItemIndex = Math.min(insertionIndex, currentCount - 1);
            wheelRef.current?.scrollToInsertionIndex(newItemIndex + 1, true);
          } else {
            // For list: scroll to end
            listRef.current?.scrollToEnd({ animated: true });
          }
        } catch (error) {
          console.error('Failed to scroll:', error);
        }
      }, 100);
    }

    previousAssetCountRef.current = currentCount;
  }, [assets.length, insertionIndex]);

  // ============================================================================
  // AUDIO PLAYBACK
  // ============================================================================

  // Fetch audio URIs for an asset
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

        debugLog(
          `📀 Found ${uniqueLinks.length} content link(s) for asset ${assetId.slice(0, 8)} (${contentLinksSynced.length} synced, ${contentLinksLocal.length} local)`
        );

        if (uniqueLinks.length === 0) {
          debugLog('No content links found for asset:', assetId);
          return [];
        }

        // Get audio values from content links (can be URIs or attachment IDs)
        const audioValues = uniqueLinks
          .flatMap((link) => {
            const audioArray = link.audio ?? [];
            debugLog(
              `  📎 Content link has ${audioArray.length} audio file(s):`,
              audioArray
            );
            return audioArray;
          })
          .filter((value): value is string => !!value);

        debugLog(`📊 Total audio files for asset: ${audioValues.length}`);

        if (audioValues.length === 0) {
          debugLog('No audio values found in content links');
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
              debugLog(
                '✅ Using direct local URI:',
                constructedUri.slice(0, 80)
              );
            } else {
              // File doesn't exist at expected path - try to find it in attachment queue
              debugLog(
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
                    debugLog(
                      `✅ Found attachment in queue for local URI ${audioValue.slice(0, 20)}`
                    );
                  } else {
                    debugLog(
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
                          debugLog(`✅ Found fallback file URI`);
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
              debugLog('✅ Using full file URI:', audioValue.slice(0, 80));
            } else {
              debugLog(`⚠️ File URI does not exist: ${audioValue}`);
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
                      debugLog(`✅ Found attachment in queue for file URI`);
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
                debugLog('✅ Found attachment URI:', localUri.slice(0, 60));
              }
            } else {
              // Attachment ID not found in queue - try fallback to local table
              debugLog(
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
                      debugLog(
                        `✅ Found fallback local URI for attachment ${audioValue.slice(0, 8)}`
                      );
                      break;
                    }
                  } else if (fallbackAudioValue.startsWith('file://')) {
                    if (await fileExists(fallbackAudioValue)) {
                      uris.push(fallbackAudioValue);
                      debugLog(
                        `✅ Found fallback file URI for attachment ${audioValue.slice(0, 8)}`
                      );
                      break;
                    }
                  }
                }
              } else {
                debugLog(`⚠️ Audio ${audioValue} not downloaded yet`);
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

  // Special audio ID for "play all" mode
  const PLAY_ALL_AUDIO_ID = 'play-all-assets';

  // Handle asset playback
  const handlePlayAsset = React.useCallback(
    async (assetId: string) => {
      try {
        const isThisAssetPlaying =
          audioContext.isPlaying && audioContext.currentAudioId === assetId;

        if (isThisAssetPlaying) {
          debugLog('⏸️ Stopping asset:', assetId.slice(0, 8));
          await audioContext.stopCurrentSound();
        } else {
          debugLog('▶️ Playing asset:', assetId.slice(0, 8));
          const uris = await getAssetAudioUris(assetId);

          if (uris.length === 0) {
            console.error('❌ No audio URIs found for asset:', assetId);
            return;
          }

          if (uris.length === 1 && uris[0]) {
            debugLog('▶️ Playing single segment');
            await audioContext.playSound(uris[0], assetId);
          } else if (uris.length > 1) {
            debugLog(`▶️ Playing ${uris.length} segments in sequence`);
            await audioContext.playSoundSequence(uris, assetId);
          }
        }
      } catch (error) {
        console.error('❌ Failed to play audio:', error);
      }
    },
    [audioContext, getAssetAudioUris]
  );

  // Track currently playing asset based on audio position during play-all
  React.useEffect(() => {
    if (
      !audioContext.isPlaying ||
      audioContext.currentAudioId !== PLAY_ALL_AUDIO_ID
    ) {
      setCurrentlyPlayingAssetId(null);
      return;
    }

    // Calculate which asset is playing based on cumulative position
    // Also update progress for each asset based on its segment range
    const checkCurrentAsset = () => {
      const uris = Array.from(assetUriMapRef.current.keys());
      const durations = segmentDurationsRef.current;
      const ranges = assetSegmentRangesRef.current;

      if (uris.length === 0) return;

      const position = audioContext.position; // Position in milliseconds

      // Update progress for each asset based on its segment range
      const progressMap = assetProgressSharedMapRef.current;
      for (const [assetId, range] of ranges.entries()) {
        const progressShared = progressMap.get(assetId);
        if (!progressShared) {
          debugLog(
            `⚠️ No progress SharedValue found for asset ${assetId.slice(0, 8)}`
          );
          continue;
        }

        if (position < range.startMs) {
          // Before this asset's segments - no progress
          progressShared.value = 0;
        } else if (position >= range.endMs) {
          // After this asset's segments - fully complete
          progressShared.value = 100;
        } else {
          // Within this asset's segments - calculate progress
          const assetPosition = position - range.startMs;
          const progressPercent = (assetPosition / range.durationMs) * 100;
          const clampedProgress = Math.min(100, Math.max(0, progressPercent));
          progressShared.value = clampedProgress;
          debugLog(
            `📊 Asset ${assetId.slice(0, 8)} progress: ${Math.round(clampedProgress)}% (position: ${Math.round(position)}ms, range: [${Math.round(range.startMs)}-${Math.round(range.endMs)}]ms)`
          );
        }
      }

      // Find which asset is currently playing
      let newPlayingAssetId: string | null = null;

      // If we don't have durations yet, use simple percentage-based approach
      if (durations.length === 0 || durations.every((d) => d === 0)) {
        const duration = audioContext.duration;
        if (duration === 0) return;

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
            newPlayingAssetId = assetId;
          }
        }
      } else {
        // Calculate which segment we're in based on cumulative durations
        let cumulativeDuration = 0;
        for (let i = 0; i < uris.length; i++) {
          const segmentDuration = durations[i] || 0;
          const segmentStart = cumulativeDuration;
          cumulativeDuration += segmentDuration;

          // If position is within this segment's range
          if (
            (position >= segmentStart && position <= cumulativeDuration) ||
            (i === uris.length - 1 && position >= segmentStart)
          ) {
            const currentUri = uris[i];
            if (currentUri) {
              const assetId = assetUriMapRef.current.get(currentUri);
              if (assetId) {
                newPlayingAssetId = assetId;
              }
            }
            break;
          }
        }
      }

      // Update currently playing asset ID and scroll to it
      if (newPlayingAssetId) {
        setCurrentlyPlayingAssetId((prev) => {
          if (newPlayingAssetId !== prev) {
            debugLog(
              `🎵 Highlighting asset ${newPlayingAssetId.slice(0, 8)} (was: ${prev?.slice(0, 8) ?? 'none'})`
            );

            // Scroll to the currently playing asset (only if it changed)
            if (
              wheelRef.current &&
              newPlayingAssetId !== lastScrolledAssetIdRef.current
            ) {
              // Find the index of the asset in the assets array
              const assetIndex = assets.findIndex(
                (a) => a.id === newPlayingAssetId
              );
              if (assetIndex >= 0) {
                debugLog(
                  `📜 Scrolling to asset at index ${assetIndex} (asset ${newPlayingAssetId.slice(0, 8)})`
                );
                // Scroll the item to the top of the wheel
                // scrollItemToTop adds 1 internally, so subtract 1 to get correct position
                wheelRef.current.scrollItemToTop(assetIndex - 1, true);
                lastScrolledAssetIdRef.current = newPlayingAssetId;
              } else {
                debugLog(
                  `⚠️ Could not find asset ${newPlayingAssetId.slice(0, 8)} in assets array`
                );
              }
            }

            return newPlayingAssetId;
          }
          return prev;
        });
      }
    };

    // Check immediately and then periodically while playing
    checkCurrentAsset();
    const interval = setInterval(checkCurrentAsset, 200); // Check every 200ms
    return () => clearInterval(interval);
    // Note: We intentionally read audioContext.position and audioContext.duration inside the callback
    // rather than including them as dependencies, because they change frequently (every ~200ms)
    // and we don't want to re-run the effect that often. The interval handles the updates.
    // assetProgressSharedMap is a ref, so we access it directly in the callback.
    // assets is included to find the asset index for scrolling.
  }, [audioContext.isPlaying, audioContext.currentAudioId, assets]);

  // Handle play all assets
  const handlePlayAllAssets = React.useCallback(async () => {
    try {
      const isPlayingAll =
        audioContext.isPlaying &&
        audioContext.currentAudioId === PLAY_ALL_AUDIO_ID;

      if (isPlayingAll) {
        debugLog('⏸️ Stopping play all');
        await audioContext.stopCurrentSound();
        setCurrentlyPlayingAssetId(null);
        assetUriMapRef.current.clear();
        segmentDurationsRef.current = [];
        assetSegmentRangesRef.current.clear();
        lastScrolledAssetIdRef.current = null;
        // Reset all asset progress
        for (const progressShared of assetProgressSharedMapRef.current.values()) {
          progressShared.value = 0;
        }
      } else {
        debugLog('▶️ Playing all assets');
        if (assets.length === 0) {
          console.warn('⚠️ No assets to play');
          return;
        }

        // Collect all URIs from all assets in order, tracking which asset each URI belongs to
        const allUris: string[] = [];
        assetUriMapRef.current.clear();
        segmentDurationsRef.current = [];

        for (const asset of assets) {
          const uris = await getAssetAudioUris(asset.id);
          for (const uri of uris) {
            allUris.push(uri);
            // Map each URI to its asset ID
            assetUriMapRef.current.set(uri, asset.id);
          }
        }

        if (allUris.length === 0) {
          console.error('❌ No audio URIs found for any assets');
          return;
        }

        debugLog(
          `▶️ Playing ${allUris.length} audio segments from ${assets.length} assets`
        );

        // Preload durations for accurate highlighting and calculate asset segment ranges
        try {
          const durations: number[] = [];
          for (const uri of allUris) {
            try {
              const { sound } = await Audio.Sound.createAsync({ uri });
              const status = await sound.getStatusAsync();
              await sound.unloadAsync();
              durations.push(
                status.isLoaded ? (status.durationMillis ?? 0) : 0
              );
            } catch (error) {
              debugLog(
                `Failed to get duration for ${uri.slice(0, 30)}:`,
                error
              );
              durations.push(0);
            }
          }
          segmentDurationsRef.current = durations;
          debugLog(
            `📊 Loaded durations for ${durations.length} segments:`,
            durations.map((d) => Math.round(d / 1000)).join('s, ') + 's'
          );

          // Calculate segment ranges for each asset
          assetSegmentRangesRef.current.clear();
          let cumulativeStart = 0;
          for (const asset of assets) {
            const assetUris = allUris.filter(
              (uri) => assetUriMapRef.current.get(uri) === asset.id
            );
            if (assetUris.length === 0) continue;

            // Find the indices of this asset's URIs in the allUris array
            const assetUriIndices: number[] = [];
            for (let i = 0; i < allUris.length; i++) {
              const uri = allUris[i];
              if (uri && assetUriMapRef.current.get(uri) === asset.id) {
                assetUriIndices.push(i);
              }
            }

            // Calculate total duration for this asset's segments
            const assetDuration = assetUriIndices.reduce(
              (sum, idx) => sum + (durations[idx] || 0),
              0
            );

            const startMs = cumulativeStart;
            const endMs = cumulativeStart + assetDuration;

            assetSegmentRangesRef.current.set(asset.id, {
              startMs,
              endMs,
              durationMs: assetDuration
            });

            // Reset progress for this asset
            const progressShared = assetProgressSharedMapRef.current.get(
              asset.id
            );
            if (progressShared) {
              progressShared.value = 0;
              debugLog(`🔄 Reset progress for asset ${asset.id.slice(0, 8)}`);
            } else {
              debugLog(
                `⚠️ No progress SharedValue found for asset ${asset.id.slice(0, 8)} when setting up ranges`
              );
            }

            debugLog(
              `📊 Asset ${asset.id.slice(0, 8)} segments: ${assetUriIndices.length} segments, ${Math.round(assetDuration / 1000)}s total, range [${Math.round(startMs)}-${Math.round(endMs)}]ms`
            );

            cumulativeStart = endMs;
          }
        } catch (error) {
          debugLog('Failed to preload durations:', error);
          // Continue anyway - will use percentage-based fallback
        }

        // Set the first asset as currently playing and scroll to it
        if (assets.length > 0 && assets[0]) {
          const firstAssetId = assets[0].id;
          setCurrentlyPlayingAssetId(firstAssetId);
          lastScrolledAssetIdRef.current = null; // Reset to allow immediate scroll

          // Scroll to first asset immediately
          if (wheelRef.current) {
            debugLog(
              `📜 Scrolling to first asset at index 0 (asset ${firstAssetId.slice(0, 8)})`
            );
            // scrollItemToTop adds 1 internally, so subtract 1 to get correct position (0 -> -1 -> 0)
            wheelRef.current.scrollItemToTop(-1, true);
            lastScrolledAssetIdRef.current = firstAssetId;
          }
        }

        await audioContext.playSoundSequence(allUris, PLAY_ALL_AUDIO_ID);
      }
    } catch (error) {
      console.error('❌ Failed to play all assets:', error);
      setCurrentlyPlayingAssetId(null);
      assetUriMapRef.current.clear();
      segmentDurationsRef.current = [];
      assetSegmentRangesRef.current.clear();
      lastScrolledAssetIdRef.current = null;
      // Reset all asset progress
      for (const progressShared of assetProgressSharedMapRef.current.values()) {
        progressShared.value = 0;
      }
    }
  }, [audioContext, getAssetAudioUris, assets]);

  // ============================================================================
  // RECORDING HANDLERS
  // ============================================================================

  // Store insertion index in ref to prevent stale closure issues
  const insertionIndexRef = React.useRef(insertionIndex);
  React.useEffect(() => {
    insertionIndexRef.current = insertionIndex;
  }, [insertionIndex]);

  // Initialize VAD counter when VAD mode activates
  React.useEffect(() => {
    if (isVADLocked && vadCounterRef.current === null) {
      // CRITICAL: Use ref to get the LATEST insertionIndex value
      // This prevents issues when fullscreen overlay blocks the wheel and causes
      // insertionIndex state updates to be delayed or missed
      const currentInsertionIndex = insertionIndexRef.current;
      const currentAssets = assets;

      debugLog(
        `🎯 VAD initializing | insertionIndex (ref): ${currentInsertionIndex} | insertionIndex (state): ${insertionIndex} | assets.length: ${currentAssets.length}`
      );

      void (async () => {
        let targetOrder: number;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (USE_INSERTION_WHEEL) {
          // Respect insertion wheel position (same logic as manual recordings)
          // insertionIndex is the boundary BEFORE an item
          // When at bottom (insertionIndex === assets.length), append to end
          // When in middle, insert after the currently viewed item

          if (currentInsertionIndex >= currentAssets.length) {
            // At or past the end - append
            targetOrder =
              currentAssets.length > 0
                ? (currentAssets[currentAssets.length - 1]?.order_index ??
                    currentAssets.length - 1) + 1
                : 0;
            debugLog(
              `🎯 VAD: At bottom, appending with order_index: ${targetOrder}`
            );
          } else {
            // In the middle - insert after current item
            const actualInsertionIndex = currentInsertionIndex + 1;
            if (actualInsertionIndex < currentAssets.length) {
              targetOrder =
                currentAssets[actualInsertionIndex]?.order_index ??
                actualInsertionIndex;
            } else {
              targetOrder =
                currentAssets.length > 0
                  ? (currentAssets[currentAssets.length - 1]?.order_index ??
                      currentAssets.length - 1) + 1
                  : 0;
            }
            debugLog(
              `🎯 VAD: In middle at visual index ${currentInsertionIndex}, inserting at order_index: ${targetOrder}`
            );
          }
        } else {
          // Legacy: append to end
          targetOrder = await getNextOrderIndex(currentQuestId!);
          debugLog(`🎯 VAD counter initialized to end: ${targetOrder}`);
        }

        vadCounterRef.current = targetOrder;
      })();
    } else if (!isVADLocked) {
      vadCounterRef.current = null;
    }
    // IMPORTANT: Only depend on isVADLocked and currentQuestId
    // insertionIndex is read from ref to avoid stale closure issues
    // assets is captured from closure (intentional - we want the state at activation time)
  }, [isVADLocked, currentQuestId, assets, insertionIndex]);

  // Manual recording handlers
  const handleRecordingStart = React.useCallback(() => {
    if (isRecording) return;
    debugLog('🎬 Manual recording start');
    setIsRecording(true);

    // Set order index for manual recording
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (USE_INSERTION_WHEEL) {
      // IMPORTANT: insertionIndex is the boundary BEFORE an item
      // When user sees item 0 centered, insertionIndex = 0 (before item 0)
      // But they want to insert AFTER the item they're viewing
      // So we use insertionIndex + 1 for the actual insertion position
      const actualInsertionIndex = insertionIndex + 1;

      const targetOrder =
        actualInsertionIndex < assets.length
          ? (assets[actualInsertionIndex]?.order_index ?? actualInsertionIndex)
          : (assets[assets.length - 1]?.order_index ?? assets.length - 1) + 1;
      currentRecordingOrderRef.current = targetOrder;
      debugLog(
        `🎯 Recording will insert AFTER item at visual index ${insertionIndex} (boundary ${actualInsertionIndex}) with order_index ${targetOrder}`
      );
    } else {
      // Legacy: append to end
      const targetOrder =
        assets.length > 0
          ? (assets[assets.length - 1]?.order_index ?? 0) + 1
          : 0;
      currentRecordingOrderRef.current = targetOrder;
    }
  }, [isRecording, assets, insertionIndex]);

  const handleRecordingStop = React.useCallback(() => {
    debugLog('🛑 Manual recording stop');
    setIsRecording(false);
  }, []);

  const handleRecordingDiscarded = React.useCallback(() => {
    debugLog('🗑️ Recording discarded');
    setIsRecording(false);
  }, []);

  // Helper function to determine verse at insertion position when sorting by verse
  // O(1) lookup using the pre-computed wheelStructureMap
  const getVerseAtInsertionIndex =
    React.useCallback((): AssetMetadata | null => {
      if (sortOrder !== 'verse' || wheelStructureMap.length === 0) {
        return null;
      }

      // Clamp index to valid range
      const clampedIndex = Math.min(
        insertionIndex,
        wheelStructureMap.length - 1
      );
      const itemAtPosition = wheelStructureMap[clampedIndex];

      if (itemAtPosition?.verse) {
        return { verse: itemAtPosition.verse };
      }

      return null;
    }, [sortOrder, wheelStructureMap, insertionIndex]);

  const handleRecordingComplete = React.useCallback(
    async (uri: string, _duration: number, _waveformData: number[]) => {
      const targetOrder = currentRecordingOrderRef.current;

      try {
        debugLog('💾 Saving recording | order_index:', targetOrder);

        // Validate required data
        if (
          !currentProjectId ||
          !currentQuestId ||
          !currentProject ||
          !currentUser
        ) {
          console.error('❌ Missing required data');
          return;
        }

        // Generate name immediately and reserve it to prevent duplicates
        // In VAD mode: Use the VAD counter which is already incremented per segment
        // In manual mode: Use total count (existing + pending) for simple sequential naming
        const nextNumber = isVADLocked
          ? targetOrder + 1 // VAD: use order_index + 1 for naming (order is 0-based, names are 1-based)
          : assets.length + pendingAssetNamesRef.current.size + 1;
        const assetName = String(nextNumber).padStart(3, '0');
        pendingAssetNamesRef.current.add(assetName);
        debugLog(
          `🏷️ Reserved name: ${assetName} (${isVADLocked ? 'VAD mode' : 'manual mode'}) | order_index: ${targetOrder}, asset count: ${assets.length}, pending: ${pendingAssetNamesRef.current.size}`
        );

        // Native module flushes the file before sending onSegmentComplete event.
        // File should be ready, but iOS Simulator may need a moment (handled by retry logic in saveAudioLocally).

        // Save audio file locally (with retry logic for timing issues)
        const saveResult = await (async () => {
          try {
            const savedUri = await saveAudioLocally(uri);
            return { success: true as const, uri: savedUri };
          } catch (error) {
            // Release the reserved name on error
            pendingAssetNamesRef.current.delete(assetName);
            console.error('❌ Failed to save audio file locally:', error);
            return { success: false as const, error };
          }
        })();

        if (!saveResult.success) {
          // Re-throw to be caught by outer catch block
          throw saveResult.error;
        }

        const localUri = saveResult.uri;

        // Queue DB write (serialized to prevent race conditions)
        let newAssetId: string | undefined;
        dbWriteQueueRef.current = dbWriteQueueRef.current
          .then(async () => {
            if (!targetLanguoidId) {
              throw new Error('Target languoid not found for project');
            }
            const assetId = await saveRecording({
              questId: currentQuestId,
              projectId: currentProjectId,
              targetLanguoidId: targetLanguoidId,
              userId: currentUser.id,
              orderIndex: targetOrder,
              audioUri: localUri,
              assetName: assetName // Pass the reserved name
            });
            newAssetId = assetId;
            // Release the reserved name after successful save
            pendingAssetNamesRef.current.delete(assetName);
            debugLog(
              `✅ Released name: ${assetName} (pending: ${pendingAssetNamesRef.current.size})`
            );
          })
          .catch((err) => {
            console.error('❌ DB write failed:', err);
            // Release the reserved name on error
            pendingAssetNamesRef.current.delete(assetName);
            throw err;
          });

        await dbWriteQueueRef.current;

        // Apply verse metadata to the new asset if an active verse is set
        // Otherwise, use insertion index logic if sorting by verse
        if (newAssetId) {
          try {
            let verseMetadata: AssetMetadata | null = null;

            if (activeVerse) {
              // Use the active verse set by the bookmark button
              verseMetadata = { verse: activeVerse };
              debugLog(
                `✅ Applied active verse metadata to new asset: ${JSON.stringify(verseMetadata)}`
              );
            } else if (sortOrder === 'verse') {
              // Fallback: use insertion index logic
              verseMetadata = getVerseAtInsertionIndex();
              if (verseMetadata) {
                debugLog(
                  `✅ Applied verse metadata to new asset: ${JSON.stringify(verseMetadata)}`
                );
              }
            }

            if (verseMetadata) {
              await updateAssetMetadata(newAssetId, verseMetadata);
            }
          } catch (error) {
            console.error('❌ Failed to apply verse metadata:', error);
            // Don't throw - asset was created successfully, metadata is optional
          }
        }

        // Invalidate queries to refresh asset list
        if (!isVADLocked) {
          await queryClient.invalidateQueries({
            queryKey: ['assets', 'by-quest', currentQuestId],
            exact: false
          });
        }

        debugLog('🏁 Recording saved');
        setIsRecording(false);
      } catch (error) {
        console.error('❌ Failed to save recording:', error);
        setIsRecording(false);
      }
    },
    [
      currentProjectId,
      currentQuestId,
      currentProject,
      currentUser,
      queryClient,
      isVADLocked,
      assets,
      targetLanguoidId,
      sortOrder,
      getVerseAtInsertionIndex,
      activeVerse
    ]
  );

  // VAD segment handlers
  const handleVADSegmentStart = React.useCallback(() => {
    if (vadCounterRef.current === null) {
      console.error('❌ VAD counter not initialized!');
      return;
    }

    const targetOrder = vadCounterRef.current;
    debugLog('🎬 VAD: Segment starting | order_index:', targetOrder);

    currentRecordingOrderRef.current = targetOrder;
    vadCounterRef.current = targetOrder + 1; // Increment for next segment
  }, []);

  const handleVADSegmentComplete = React.useCallback(
    (uri: string) => {
      if (!uri || uri === '') {
        debugLog('🗑️ VAD: Segment discarded');
        return;
      }

      debugLog('📼 VAD: Segment complete');
      void handleRecordingComplete(uri, 0, []);
    },
    [handleRecordingComplete]
  );

  // Hook up native VAD recording
  const {
    currentEnergy,
    isRecording: isVADRecording,
    energyShared,
    isRecordingShared
  } = useVADRecording({
    threshold: vadThreshold,
    silenceDuration: vadSilenceDuration,
    isVADActive: isVADLocked,
    onSegmentStart: handleVADSegmentStart,
    onSegmentComplete: handleVADSegmentComplete,
    isManualRecording: isRecording
  });

  // Invalidate queries when VAD mode ends
  React.useEffect(() => {
    if (!isVADLocked) {
      void queryClient.invalidateQueries({
        queryKey: ['assets', 'by-quest', currentQuestId],
        exact: false
      });
    }
  }, [isVADLocked, currentQuestId, queryClient]);

  // ============================================================================
  // LAZY LOAD SEGMENT COUNTS
  // ============================================================================

  // Stable reference to raw assets for segment count loading
  // Only extract what we need to avoid circular dependencies
  const assetMetadata = React.useMemo(
    () =>
      rawAssets
        .map((a) => {
          const obj = a as { id?: string } | null;
          return obj?.id;
        })
        .filter((id): id is string => !!id),
    [rawAssets]
  );

  const assetIds = React.useMemo(
    () => assetMetadata.join(','),
    [assetMetadata]
  );

  // Track which asset IDs we've loaded counts for to prevent re-loading
  const loadedAssetIdsRef = React.useRef(new Set<string>());

  // Clear loaded IDs when asset list changes significantly (e.g., after merge/delete)
  // This ensures segment counts are re-loaded for modified assets
  const previousAssetIdsRef = React.useRef(assetIds);
  React.useEffect(() => {
    if (previousAssetIdsRef.current !== assetIds) {
      // Asset list changed - clear cache for assets that no longer exist
      const currentAssetIdSet = new Set(assetMetadata);
      const toRemove = Array.from(loadedAssetIdsRef.current).filter(
        (id) => !currentAssetIdSet.has(id)
      );

      if (toRemove.length > 0) {
        debugLog(
          `🧹 Clearing ${toRemove.length} stale asset segment cache entries`
        );
        toRemove.forEach((id) => loadedAssetIdsRef.current.delete(id));

        // Also clear from state maps
        setAssetSegmentCounts((prev) => {
          const next = new Map(prev);
          toRemove.forEach((id) => next.delete(id));
          return next;
        });
        setAssetDurations((prev) => {
          const next = new Map(prev);
          toRemove.forEach((id) => next.delete(id));
          return next;
        });
      }

      previousAssetIdsRef.current = assetIds;
    }
  }, [assetIds, assetMetadata]);

  // OPTIMIZED: Load segment counts and durations in batches after UI is idle
  // This prevents blocking the UI thread during initial render and animations
  React.useEffect(() => {
    // Check both ref AND state to determine if we need to load
    // This ensures we reload when re-entering the view (state is cleared on unmount)
    const assetsToLoad = assetMetadata.filter((id) => {
      // Load if not in ref (never attempted) OR missing from state (needs reload)
      const notInRef = !loadedAssetIdsRef.current.has(id);
      const missingFromState =
        !assetSegmentCounts.has(id) || !assetDurations.has(id);
      return notInRef || missingFromState;
    });

    if (assetsToLoad.length === 0) {
      // Nothing new to load - don't even start the async work
      return;
    }

    // Defer until animations complete
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      const controller = new AbortController();

      // Process assets in batches to prevent blocking
      const processBatch = async (startIdx: number) => {
        if (controller.signal.aborted) return;

        const BATCH_SIZE = 5; // Process 5 assets at a time
        const batch = assetsToLoad.slice(startIdx, startIdx + BATCH_SIZE);

        if (batch.length === 0) {
          // All done!
          debugLog('✅ Finished loading all asset metadata');
          return;
        }

        debugLog(
          `📊 Loading batch ${Math.floor(startIdx / BATCH_SIZE) + 1}: ${batch.length} assets (${startIdx + 1}-${startIdx + batch.length} of ${assetsToLoad.length})`
        );

        try {
          const newCounts = new Map<string, number>();
          const newDurations = new Map<string, number>();

          for (const assetId of batch) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (controller.signal.aborted) break;

            try {
              // Query asset_content_link to get audio segments
              // ARCHITECTURE EXPLANATION:
              // - Each asset can have multiple segments (merged assets)
              // - Each segment is one row in asset_content_link
              // - Each segment can have one or more audio files in its audio[] array
              //
              // COUNTS:
              // - Segment count = number of content_link rows
              // - Audio file count = total audio files across all segments
              // - Duration = sum of all audio files' durations
              const contentLinks =
                await system.db.query.asset_content_link.findMany({
                  columns: {
                    id: true,
                    audio: true
                  },
                  where: eq(asset_content_link.asset_id, assetId),
                  orderBy: asc(asset_content_link.created_at)
                });

              // DEBUG: Log raw query result
              debugLog(
                `🔎 Query result for asset ${assetId.slice(0, 8)}:`,
                contentLinks.length,
                'rows found'
              );
              if (contentLinks.length > 0) {
                debugLog(
                  `   First row ID: ${contentLinks[0]?.id.slice(0, 8)}, audio count: ${contentLinks[0]?.audio?.length ?? 0}`
                );
                if (contentLinks.length > 1) {
                  debugLog(
                    `   Second row ID: ${contentLinks[1]?.id.slice(0, 8)}, audio count: ${contentLinks[1]?.audio?.length ?? 0}`
                  );
                }
              } else {
                console.warn(
                  `⚠️ NO content_link rows found for asset ${assetId.slice(0, 8)}!`
                );
              }

              // SEGMENT COUNT: Number of content_link rows (each row = one segment)
              const segmentCount = contentLinks.length || 1;
              newCounts.set(assetId, segmentCount);

              // DEBUG: Log segment count for this asset
              debugLog(
                `🔍 Asset ${assetId.slice(0, 8)} segment count: ${segmentCount} ${segmentCount > 1 ? '✅ MULTI-SEGMENT' : '(single)'}`
              );

              // AUDIO FILES: Extract all audio file references from all segments
              // This flattens the audio arrays from all content_link rows
              const audioValues = contentLinks
                .flatMap((link) => link.audio ?? [])
                .filter((value): value is string => !!value);

              // DEBUG: Log audio values found
              debugLog(
                `🎵 Asset ${assetId.slice(0, 8)} has ${audioValues.length} audio file(s) across ${segmentCount} segment(s) - loading durations...`
              );

              // DURATION: Load and sum all audio file durations
              let totalDuration = 0;

              for (const audioValue of audioValues) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (controller.signal.aborted) break;

                try {
                  // Get the full URI for this audio
                  let audioUri: string | null = null;
                  if (audioValue.startsWith('local/')) {
                    audioUri = await getLocalAttachmentUriWithOPFS(audioValue);
                  } else if (audioValue.startsWith('file://')) {
                    audioUri = audioValue;
                  } else if (system.permAttachmentQueue) {
                    // It's an attachment ID
                    const attachment = await system.powersync.getOptional<{
                      id: string;
                      local_uri: string | null;
                    }>(
                      `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`,
                      [audioValue]
                    );
                    if (attachment?.local_uri) {
                      audioUri = system.permAttachmentQueue.getLocalUri(
                        attachment.local_uri
                      );
                    }
                  }

                  if (audioUri) {
                    // Load audio file to get duration
                    const { sound } = await Audio.Sound.createAsync({
                      uri: audioUri
                    });
                    const status = await sound.getStatusAsync();
                    await sound.unloadAsync();

                    if (status.isLoaded && status.durationMillis) {
                      totalDuration += status.durationMillis;
                    }
                  }
                } catch (err) {
                  // Skip this segment if we can't load it
                  console.warn(`Failed to load duration for segment:`, err);
                }
              }

              if (totalDuration > 0) {
                newDurations.set(assetId, totalDuration);
                debugLog(
                  `⏱️ Asset ${assetId.slice(0, 8)} total duration: ${Math.round(totalDuration / 1000)}s`
                );
              } else {
                // Set duration to 0 to mark as loaded (prevents infinite retries)
                // AssetCard will only show duration if it's > 0, so 0 won't be displayed
                newDurations.set(assetId, 0);
                debugLog(
                  `⚠️ Asset ${assetId.slice(0, 8)} has no duration (${audioValues.length} audio files found) - marked as loaded`
                );
              }

              loadedAssetIdsRef.current.add(assetId);
            } catch (err) {
              // If query fails for any asset, default to 1 segment and 0 duration
              // This marks it as loaded (prevents infinite retries)
              console.warn(`Failed to load data for asset ${assetId}:`, err);
              newCounts.set(assetId, 1);
              newDurations.set(assetId, 0);
              loadedAssetIdsRef.current.add(assetId);
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (controller.signal.aborted) {
            return;
          } else {
            if (newCounts.size > 0) {
              // Merge with existing counts
              setAssetSegmentCounts((prev) => {
                const merged = new Map(prev);
                for (const [id, count] of newCounts) {
                  merged.set(id, count);
                }
                return merged;
              });
              debugLog(
                `✅ Batch loaded segment counts for ${newCounts.size} asset${newCounts.size > 1 ? 's' : ''}`
              );
            }

            if (newDurations.size > 0) {
              // Merge with existing durations
              setAssetDurations((prev) => {
                const merged = new Map(prev);
                for (const [id, duration] of newDurations) {
                  merged.set(id, duration);
                }
                return merged;
              });
              debugLog(
                `✅ Batch loaded durations for ${newDurations.size} asset${newDurations.size > 1 ? 's' : ''}`
              );
            }

            // Schedule next batch with a frame delay to keep UI responsive
            setTimeout(() => {
              void processBatch(startIdx + BATCH_SIZE);
            }, 16); // One frame delay (60fps)
          }
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (controller.signal.aborted) {
            return;
          } else {
            console.error('Failed to load asset metadata batch:', error);
            // Continue with next batch even if this one failed
            setTimeout(() => {
              void processBatch(startIdx + BATCH_SIZE);
            }, 16);
          }
        }
      };

      // Start processing from first batch
      void processBatch(0);

      return () => {
        controller.abort();
      };
    });

    return () => {
      interactionHandle.cancel();
    };
    // Depend on assetIds, assetMetadata, and state maps
    // State maps are included so we detect when durations are missing (e.g., after remount)
    // The effect safely handles updates by only loading missing assets
  }, [assetIds, assetMetadata, assetSegmentCounts, assetDurations]);

  // ============================================================================
  // ASSET OPERATIONS (Delete, Merge)
  // ============================================================================

  const handleDeleteLocalAsset = React.useCallback(
    async (assetId: string) => {
      try {
        await audioSegmentService.deleteAudioSegment(assetId);
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'by-quest', currentQuestId],
          exact: false
        });
      } catch (e) {
        console.error('Failed to delete local asset', e);
      }
    },
    [queryClient, currentQuestId]
  );

  const handleMergeDownLocal = React.useCallback(
    async (index: number) => {
      try {
        const first = assets[index];
        const second = assets[index + 1];
        if (!first || !second || !currentUser) return;
        if (first.source === 'cloud' || second.source === 'cloud') return;

        const contentLocal = resolveTable('asset_content_link', {
          localOverride: true
        });
        const secondContent = await system.db
          .select()
          .from(contentLocal)
          .where(eq(contentLocal.asset_id, second.id));

        for (const c of secondContent) {
          if (!c.audio) continue;
          await system.db.insert(contentLocal).values({
            asset_id: first.id,
            source_language_id: c.source_language_id, // Deprecated field, kept for backward compatibility
            languoid_id: c.languoid_id ?? c.source_language_id ?? null, // Use languoid_id if available, fallback to source_language_id
            text: c.text || '',
            audio: c.audio,
            download_profiles: [currentUser.id]
          });
        }

        await audioSegmentService.deleteAudioSegment(second.id);

        // Force re-load of segment count for the merged asset
        debugLog(
          `🔄 Forcing segment count reload for merged asset: ${first.id}`
        );
        loadedAssetIdsRef.current.delete(first.id);
        setAssetSegmentCounts((prev) => {
          const next = new Map(prev);
          next.delete(first.id);
          return next;
        });
        setAssetDurations((prev) => {
          const next = new Map(prev);
          next.delete(first.id);
          return next;
        });

        await queryClient.invalidateQueries({
          queryKey: ['assets', 'by-quest', currentQuestId],
          exact: false
        });
      } catch (e) {
        console.error('Failed to merge local assets', e);
      }
    },
    [assets, currentUser, queryClient, currentQuestId]
  );

  const handleBatchMergeSelected = React.useCallback(() => {
    const selectedOrdered = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );
    if (selectedOrdered.length < 2) return;

    RNAlert.alert(
      'Merge Assets',
      `Are you sure you want to merge ${selectedOrdered.length} assets? The audio segments will be combined into the first selected asset, and the others will be deleted.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Merge',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                if (!currentUser) return;

                const target = selectedOrdered[0]!;
                const rest = selectedOrdered.slice(1);
                const contentLocal = resolveTable('asset_content_link', {
                  localOverride: true
                });

                for (const src of rest) {
                  const srcContent = await system.db
                    .select()
                    .from(contentLocal)
                    .where(eq(contentLocal.asset_id, src.id));

                  for (const c of srcContent) {
                    if (!c.audio) continue;
                    await system.db.insert(contentLocal).values({
                      asset_id: target.id,
                      source_language_id: c.source_language_id, // Deprecated field, kept for backward compatibility
                      languoid_id:
                        c.languoid_id ?? c.source_language_id ?? null, // Use languoid_id if available, fallback to source_language_id
                      text: c.text || '',
                      audio: c.audio,
                      download_profiles: [currentUser.id]
                    });
                  }

                  await audioSegmentService.deleteAudioSegment(src.id);
                }

                // Force re-load of segment count for the merged target asset
                debugLog(
                  `🔄 Forcing segment count reload for merged asset: ${target.id}`
                );
                loadedAssetIdsRef.current.delete(target.id);
                setAssetSegmentCounts((prev) => {
                  const next = new Map(prev);
                  next.delete(target.id);
                  return next;
                });
                setAssetDurations((prev) => {
                  const next = new Map(prev);
                  next.delete(target.id);
                  return next;
                });

                cancelSelection();
                await queryClient.invalidateQueries({
                  queryKey: ['assets', 'by-quest', currentQuestId],
                  exact: false
                });

                debugLog('✅ Batch merge completed');
              } catch (e) {
                console.error('Failed to batch merge local assets', e);
                RNAlert.alert(
                  'Error',
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
    currentQuestId
  ]);

  const handleBatchDeleteSelected = React.useCallback(() => {
    const selectedOrdered = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );
    if (selectedOrdered.length < 1) return;

    RNAlert.alert(
      'Delete Assets',
      `Are you sure you want to delete ${selectedOrdered.length} asset${selectedOrdered.length > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                for (const asset of selectedOrdered) {
                  await audioSegmentService.deleteAudioSegment(asset.id);
                }

                cancelSelection();
                await queryClient.invalidateQueries({
                  queryKey: ['assets', 'by-quest', currentQuestId],
                  exact: false
                });

                debugLog(
                  `✅ Batch delete completed: ${selectedOrdered.length} assets`
                );
              } catch (e) {
                console.error('Failed to batch delete local assets', e);
                RNAlert.alert(
                  'Error',
                  'Failed to delete assets. Please try again.'
                );
              }
            })();
          }
        }
      ]
    );
  }, [assets, selectedAssetIds, cancelSelection, queryClient, currentQuestId]);

  // Collect existing verse labels from all assets
  const existingLabels = React.useMemo(() => {
    const labelsMap = new Map<string, { from: number; to: number }>();

    for (const asset of assets) {
      if (!asset.metadata) continue;

      try {
        const metadata: unknown =
          typeof asset.metadata === 'string'
            ? JSON.parse(asset.metadata)
            : asset.metadata;

        if (metadata && typeof metadata === 'object' && 'verse' in metadata) {
          const verseObj = (metadata as { verse?: unknown }).verse;
          if (
            verseObj &&
            typeof verseObj === 'object' &&
            'from' in verseObj &&
            'to' in verseObj
          ) {
            const verse = verseObj as { from: unknown; to: unknown };
            if (
              typeof verse.from === 'number' &&
              typeof verse.to === 'number'
            ) {
              const key = `${verse.from}-${verse.to}`;
              if (!labelsMap.has(key)) {
                labelsMap.set(key, { from: verse.from, to: verse.to });
              }
            }
          }
        }
      } catch {
        // Skip invalid metadata
      }
    }

    return Array.from(labelsMap.values()).sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      return a.to - b.to;
    });
  }, [assets]);

  // Array of booleans tracking which verses are occupied (1-indexed, so index 0 is unused)
  // Size = verseCount + 1 to allow direct indexing by verse number
  const verseOccupiedRef = React.useRef<boolean[]>([]);

  // Structured verse labels with unique numeric IDs, sorted by 'from', with index map
  // Also maps each asset to its corresponding labelId
  const { sortedLabels, labelIndexMap, assetLabelMap, verseOccupied } =
    React.useMemo(() => {
      // 1. Create array with all unique labels (deduplicated by from-to range)
      const labelsMap = new Map<string, { from: number; to: number }>();

      for (const asset of assets) {
        if (!asset.metadata) continue;

        try {
          const metadata: unknown =
            typeof asset.metadata === 'string'
              ? JSON.parse(asset.metadata)
              : asset.metadata;

          if (metadata && typeof metadata === 'object' && 'verse' in metadata) {
            const verseObj = (metadata as { verse?: unknown }).verse;
            if (
              verseObj &&
              typeof verseObj === 'object' &&
              'from' in verseObj &&
              'to' in verseObj
            ) {
              const verse = verseObj as { from: unknown; to: unknown };
              if (
                typeof verse.from === 'number' &&
                typeof verse.to === 'number'
              ) {
                // Use from-to as key to deduplicate
                const key = `${verse.from}-${verse.to}`;
                if (!labelsMap.has(key)) {
                  labelsMap.set(key, { from: verse.from, to: verse.to });
                }
              }
            }
          }
        } catch {
          // Skip invalid metadata
        }
      }

      // 2. Convert to array with numeric IDs and sort by 'from' (and 'to' as secondary)
      const sorted = Array.from(labelsMap.entries())
        .map(([key, label]) => ({
          key, // Keep the "from-to" key for mapping
          id: 0, // Will be reassigned after sorting
          from: label.from,
          to: label.to
        }))
        .sort((a, b) => {
          if (a.from !== b.from) return a.from - b.from;
          return a.to - b.to;
        });

      // 3. Reassign IDs based on sorted order (so ID matches index)
      // Also create a Map: "from-to" key -> labelId
      const keyToLabelId = new Map<string, number>();
      sorted.forEach((label, index) => {
        label.id = index;
        keyToLabelId.set(label.key, index);
      });

      // 4. Create Map: labelId -> index in sorted array
      const indexMap = new Map<number, number>();
      sorted.forEach((label, index) => {
        indexMap.set(label.id, index);
      });

      // 5. Create Map: assetId -> labelId
      const assetToLabel = new Map<string, number>();
      for (const asset of assets) {
        if (!asset.metadata) continue;

        try {
          const metadata: unknown =
            typeof asset.metadata === 'string'
              ? JSON.parse(asset.metadata)
              : asset.metadata;

          if (metadata && typeof metadata === 'object' && 'verse' in metadata) {
            const verseObj = (metadata as { verse?: unknown }).verse;
            if (
              verseObj &&
              typeof verseObj === 'object' &&
              'from' in verseObj &&
              'to' in verseObj
            ) {
              const verse = verseObj as { from: unknown; to: unknown };
              if (
                typeof verse.from === 'number' &&
                typeof verse.to === 'number'
              ) {
                const key = `${verse.from}-${verse.to}`;
                const labelId = keyToLabelId.get(key);
                if (labelId !== undefined) {
                  assetToLabel.set(asset.id, labelId);
                }
              }
            }
          }
        } catch {
          // Skip invalid metadata
        }
      }

      // 6. Create boolean array for verse occupation (1-indexed)
      // Index 0 is unused, verse 1 is at index 1, etc.
      const occupied: boolean[] = Array.from<boolean>({
        length: verseCount + 1
      }).fill(false);
      for (const label of sorted) {
        for (let v = label.from; v <= label.to; v++) {
          if (v >= 1 && v <= verseCount) {
            occupied[v] = true;
          }
        }
      }

      // Update ref for external access
      verseOccupiedRef.current = occupied;

      // Remove the temporary 'key' property from sorted labels before returning
      const cleanedSorted = sorted.map(({ id, from, to }) => ({
        id,
        from,
        to
      }));

      return {
        sortedLabels: cleanedSorted,
        labelIndexMap: indexMap,
        assetLabelMap: assetToLabel,
        verseOccupied: occupied
      };
    }, [assets, verseCount]);

  // Enrich assets with labelId property
  const assetsWithLabelId = React.useMemo(() => {
    return assets.map((asset) => ({
      ...asset,
      labelId: assetLabelMap.get(asset.id)
    }));
  }, [assets, assetLabelMap]);

  // Create a stable key for logging - only changes when label count changes
  const labelsKey = `${sortedLabels.length}-${assets.length}`;

  // Log enriched assets (only when labels or assets actually change)
  React.useEffect(() => {
    console.log('📋 === ASSETS WITH LABEL ID ===');
    for (const asset of assetsWithLabelId) {
      const metadataStr =
        typeof asset.metadata === 'string'
          ? asset.metadata
          : JSON.stringify(asset.metadata);
      console.log(
        `  📌 name: ${asset.name}, metadata: ${metadataStr}, id: ${asset.id}, labelId: ${asset.labelId ?? 'none'}`
      );
    }
    console.log('📋 Sorted Labels:', sortedLabels);
    console.log('📋 Label Index Map:', labelIndexMap);
    console.log('📋 Verse Occupied:', verseOccupied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelsKey]); // Only re-run when the key changes

  // Calculate available verses (excluding occupied ones)
  const availableVerses = React.useMemo(() => {
    if (verseCount === 0) return [];

    // Create a set of occupied verses
    const occupiedVerses = new Set<number>();
    for (const label of existingLabels) {
      for (let verse = label.from; verse <= label.to; verse++) {
        occupiedVerses.add(verse);
      }
    }

    // Return array of available verses (1 to verseCount, excluding occupied)
    const available: number[] = [];
    for (let verse = 1; verse <= verseCount; verse++) {
      if (!occupiedVerses.has(verse)) {
        available.push(verse);
      }
    }

    return available;
  }, [existingLabels, verseCount]);

  // Calculate the next available verse for the bookmark button
  // Based on the current position in the wheel - shows the next verse available
  // after the verse at the current insertion position
  // Uses O(1) lookup via wheelStructureMap
  // Uses realTimeIndex for responsive updates during scroll
  const nextAvailableVerse = React.useMemo(() => {
    if (
      verseCount === 0 ||
      sortOrder !== 'verse' ||
      wheelStructureMap.length === 0
    ) {
      return null;
    }

    // Use realTimeIndex for responsive updates during scroll
    const clampedIndex = Math.min(realTimeIndex, wheelStructureMap.length - 1);
    const itemAtPosition = wheelStructureMap[clampedIndex];

    // Don't show button when positioned on a separator
    if (itemAtPosition?.type === 'separator') {
      return null;
    }

    // Get the verse at the current position
    const currentVerseNumber = itemAtPosition?.verse?.to ?? 0;

    // The next verse is current + 1
    const nextVerseNumber = currentVerseNumber + 1;

    // Check if next verse is within valid range
    if (nextVerseNumber > verseCount) return null;

    // Check if the immediately next verse is available (not occupied)
    // If it's occupied, return null (button will be hidden)
    if (!availableVerses.includes(nextVerseNumber)) return null;

    return nextVerseNumber;
  }, [
    availableVerses,
    verseCount,
    sortOrder,
    realTimeIndex,
    wheelStructureMap
  ]);

  // Callback to apply a verse (set it as active)
  const handleApplyVerse = React.useCallback(
    (verse: { from: number; to: number }) => {
      setActiveVerse(verse);
    },
    []
  );

  // Given a selected 'from' value, find the maximum 'to' value allowed
  // This prevents overlapping ranges by limiting to the next occupied verse
  const getMaxToForFrom = React.useCallback(
    (selectedFrom: number) => {
      // Find the index of selectedFrom in available verses
      const fromIndex = availableVerses.indexOf(selectedFrom);
      if (fromIndex === -1) {
        // If selectedFrom is not available, return selectedFrom
        return selectedFrom;
      }

      // Find the first existing label that starts after selectedFrom
      const sortedLabels = [...existingLabels].sort((a, b) => a.from - b.from);
      const nextLabel = sortedLabels.find((label) => label.from > selectedFrom);

      if (nextLabel) {
        // Return the verse just before the next label starts
        return nextLabel.from - 1;
      }

      // No label after selectedFrom, can go to the end
      return verseCount || 1;
    },
    [existingLabels, verseCount, availableVerses]
  );

  // Check if selected assets have verse labels
  const hasSelectedAssetsWithLabels = React.useMemo(() => {
    const selectedAssets = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );
    return selectedAssets.some((asset) => {
      if (!asset.metadata) return false;
      try {
        const metadata: unknown =
          typeof asset.metadata === 'string'
            ? JSON.parse(asset.metadata)
            : asset.metadata;
        if (
          metadata &&
          typeof metadata === 'object' &&
          'verse' in metadata &&
          metadata.verse &&
          typeof metadata.verse === 'object' &&
          'from' in metadata.verse &&
          'to' in metadata.verse
        ) {
          return true;
        }
      } catch {
        // Skip invalid metadata
      }
      return false;
    });
  }, [assets, selectedAssetIds]);

  // Handle verse assignment to selected assets
  const handleAssignVerse = React.useCallback(
    (from: number, to: number) => {
      const selectedOrdered = assets.filter(
        (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
      );
      if (selectedOrdered.length < 1) return;

      void (async () => {
        try {
          const updates = selectedOrdered.map((asset) => ({
            assetId: asset.id,
            metadata: { verse: { from, to } } as AssetMetadata
          }));

          await batchUpdateAssetMetadata(updates);

          cancelSelection();
          setShowVerseAssignerModal(false);
          await queryClient.invalidateQueries({
            queryKey: ['assets', 'by-quest', currentQuestId],
            exact: false
          });

          debugLog(
            `✅ Verse assignment completed: ${selectedOrdered.length} assets assigned verse ${from}-${to}`
          );
        } catch (e) {
          console.error('Failed to assign verse to assets', e);
          RNAlert.alert(
            'Error',
            'Failed to assign verse to assets. Please try again.'
          );
        }
      })();
    },
    [assets, selectedAssetIds, cancelSelection, queryClient, currentQuestId]
  );

  // Handle verse label removal from selected assets
  const handleRemoveVerse = React.useCallback(() => {
    const selectedOrdered = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );
    if (selectedOrdered.length < 1) return;

    void (async () => {
      try {
        // Remove verse metadata while preserving other metadata properties
        const updates = selectedOrdered.map((asset) => {
          let newMetadata: AssetMetadata | null = null;

          // Parse existing metadata if it exists
          if (asset.metadata) {
            try {
              const existingMetadata: unknown =
                typeof asset.metadata === 'string'
                  ? JSON.parse(asset.metadata)
                  : asset.metadata;

              if (existingMetadata && typeof existingMetadata === 'object') {
                // Create new metadata object without the verse property
                const { verse: _verse, ...rest } = existingMetadata as {
                  verse?: unknown;
                  [key: string]: unknown;
                };
                // Only keep metadata if there are other properties, otherwise set to null
                newMetadata =
                  Object.keys(rest).length > 0 ? (rest as AssetMetadata) : null;
              }
            } catch {
              // If parsing fails, set to null
              newMetadata = null;
            }
          }

          return {
            assetId: asset.id,
            metadata: newMetadata
          };
        });

        await batchUpdateAssetMetadata(updates);

        cancelSelection();
        setShowVerseAssignerModal(false);
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'by-quest', currentQuestId],
          exact: false
        });

        debugLog(
          `✅ Verse removal completed: ${selectedOrdered.length} assets had verse labels removed`
        );
      } catch (e) {
        console.error('Failed to remove verse from assets', e);
        RNAlert.alert(
          'Error',
          'Failed to remove verse labels from assets. Please try again.'
        );
      }
    })();
  }, [assets, selectedAssetIds, cancelSelection, queryClient, currentQuestId]);

  // ============================================================================
  // RENAME ASSET
  // ============================================================================

  const handleRenameAsset = React.useCallback(
    (assetId: string, currentName: string | null) => {
      setRenameAssetId(assetId);
      setRenameAssetName(currentName ?? '');
      setShowRenameModal(true);
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
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'by-quest', currentQuestId],
          exact: false
        });

        debugLog('✅ Asset renamed successfully');
      } catch (error) {
        console.error('❌ Failed to rename asset:', error);
        if (error instanceof Error) {
          console.warn('⚠️ Rename blocked:', error.message);
          RNAlert.alert('Error', error.message);
        }
      }
    },
    [renameAssetId, queryClient, currentQuestId]
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Stable callbacks for AssetCard (don't change unless handlers change)
  const stableHandlePlayAsset = React.useCallback(handlePlayAsset, [
    handlePlayAsset
  ]);
  const stableToggleSelect = React.useCallback(toggleSelect, [toggleSelect]);
  const stableEnterSelection = React.useCallback(enterSelection, [
    enterSelection
  ]);
  const stableHandleDeleteLocalAsset = React.useCallback(
    handleDeleteLocalAsset,
    [handleDeleteLocalAsset]
  );
  const stableHandleMergeDownLocal = React.useCallback(handleMergeDownLocal, [
    handleMergeDownLocal
  ]);
  const stableHandleRenameAsset = React.useCallback(handleRenameAsset, [
    handleRenameAsset
  ]);

  // Memoized render function for LegendList
  // OPTIMIZED: No audioContext.position dependency - progress now uses SharedValues!
  // This eliminates 10 re-renders/second during audio playback
  const renderAssetItem = React.useCallback(
    ({ item, index }: { item: UIAsset; index: number }) => {
      // Check if this asset is playing individually OR if it's the currently playing asset during play-all
      const isThisAssetPlayingIndividually =
        audioContext.isPlaying && audioContext.currentAudioId === item.id;
      const isThisAssetPlayingInPlayAll =
        audioContext.isPlaying &&
        audioContext.currentAudioId === PLAY_ALL_AUDIO_ID &&
        currentlyPlayingAssetId === item.id;
      const isThisAssetPlaying =
        isThisAssetPlayingIndividually || isThisAssetPlayingInPlayAll;
      const isSelected = selectedAssetIds.has(item.id);
      const canMergeDown =
        index < assets.length - 1 && assets[index + 1]?.source !== 'cloud';

      // Duration from lazy-loaded metadata
      const duration = item.duration;

      // Get custom progress for play-all mode
      const customProgress =
        audioContext.isPlaying &&
        audioContext.currentAudioId === PLAY_ALL_AUDIO_ID
          ? assetProgressSharedMapRef.current.get(item.id)
          : undefined;

      return (
        <LabeledAssetCard
          asset={item}
          index={index}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
          isPlaying={isThisAssetPlaying}
          duration={duration}
          canMergeDown={canMergeDown}
          segmentCount={item.segmentCount}
          customProgress={customProgress}
          showVerseLabel={sortOrder !== 'verse'}
          bookChapterLabel={bookChapterLabelRef.current}
          onPress={() => {
            if (isSelectionMode) {
              stableToggleSelect(item.id);
            } else {
              void stableHandlePlayAsset(item.id);
            }
          }}
          onLongPress={() => {
            stableEnterSelection(item.id);
          }}
          onPlay={() => {
            void stableHandlePlayAsset(item.id);
          }}
          onDelete={stableHandleDeleteLocalAsset}
          onMerge={stableHandleMergeDownLocal}
          onRename={stableHandleRenameAsset}
        />
      );
    },
    [
      audioContext.isPlaying,
      audioContext.currentAudioId,
      currentlyPlayingAssetId,
      // audioContext.position REMOVED - uses SharedValues now!
      // audioContext.duration REMOVED - not needed for render
      selectedAssetIds,
      isSelectionMode,
      assets,
      sortOrder,
      stableHandlePlayAsset,
      stableToggleSelect,
      stableEnterSelection,
      stableHandleDeleteLocalAsset,
      stableHandleMergeDownLocal,
      stableHandleRenameAsset
    ]
  );

  // Memoized children for ArrayInsertionWheel
  // OPTIMIZED: No audioContext.position/duration dependencies - progress now uses SharedValues!
  // This eliminates re-creating all children 10+ times per second during audio playback
  const wheelChildren = React.useMemo(() => {
    // Map assets to wheel items
    return assetsForLegendList
      .map((item, index) => {
        // Check if this asset is playing individually OR if it's the currently playing asset during play-all
        const isThisAssetPlayingIndividually =
          audioContext.isPlaying && audioContext.currentAudioId === item.id;
        const isThisAssetPlayingInPlayAll =
          audioContext.isPlaying &&
          audioContext.currentAudioId === PLAY_ALL_AUDIO_ID &&
          currentlyPlayingAssetId === item.id;
        const isThisAssetPlaying =
          isThisAssetPlayingIndividually || isThisAssetPlayingInPlayAll;
        const isSelected = selectedAssetIds.has(item.id);
        const canMergeDown =
          index < assetsForLegendList.length - 1 &&
          assetsForLegendList[index + 1]?.source !== 'cloud';

        // Duration from lazy-loaded metadata
        const duration = item.duration;

        // Get custom progress for play-all mode
        const customProgress =
          audioContext.isPlaying &&
          audioContext.currentAudioId === PLAY_ALL_AUDIO_ID
            ? assetProgressSharedMapRef.current.get(item.id)
            : undefined;

        // Check if we need to show VerseSeparator (when sorting by verse)
        let shouldShowVerseSeparator = false;
        let currentVerse: { from?: number; to?: number } | null = null;

        if (sortOrder === 'verse') {
          currentVerse = getVerseFromMetadata(item.metadata);
          const prevItem = index > 0 ? assetsForLegendList[index - 1] : null;
          const prevVerse = prevItem
            ? getVerseFromMetadata(prevItem.metadata)
            : null;

          // Check if this is the start of a new verse group
          if (index === 0) {
            // First item - always show separator
            shouldShowVerseSeparator = true;
          } else if (!currentVerse && prevVerse) {
            // Transition from verse to no verse
            shouldShowVerseSeparator = true;
          } else if (currentVerse && !prevVerse) {
            // Transition from no verse to verse
            shouldShowVerseSeparator = true;
          } else if (currentVerse && prevVerse) {
            // Both have verses - check if they're different
            shouldShowVerseSeparator =
              currentVerse.from !== prevVerse.from ||
              (currentVerse.to ?? currentVerse.from) !==
                (prevVerse.to ?? prevVerse.from);
          }
        }

        // Return array with separator (if needed) and card as separate items
        const items: React.ReactNode[] = [];

        // Add separator as a separate list item if needed
        if (shouldShowVerseSeparator) {
          items.push(
            <VerseSeparator
              key={`verse-sep-${item.id}`}
              from={currentVerse?.from}
              to={currentVerse?.to}
              label={bookChapterLabelRef.current}
              largeText={true}
            />
          );
        }

        // Add asset card as a separate list item
        items.push(
          <LabeledAssetCard
            key={item.id}
            asset={item}
            index={index}
            isSelected={isSelected}
            isSelectionMode={isSelectionMode}
            isPlaying={isThisAssetPlaying}
            duration={duration}
            canMergeDown={canMergeDown}
            segmentCount={item.segmentCount}
            customProgress={customProgress}
            showVerseLabel={sortOrder !== 'verse'}
            bookChapterLabel={bookChapterLabelRef.current}
            onPress={() => {
              if (isSelectionMode) {
                stableToggleSelect(item.id);
              } else {
                void stableHandlePlayAsset(item.id);
              }
            }}
            onLongPress={() => {
              stableEnterSelection(item.id);
            }}
            onPlay={() => {
              void stableHandlePlayAsset(item.id);
            }}
            onDelete={stableHandleDeleteLocalAsset}
            onMerge={stableHandleMergeDownLocal}
            onRename={stableHandleRenameAsset}
          />
        );

        return items;
      })
      .flat();
  }, [
    assetsForLegendList,
    sortOrder,
    getVerseFromMetadata,
    audioContext.isPlaying,
    audioContext.currentAudioId,
    currentlyPlayingAssetId,
    // assetProgressSharedMap REMOVED - it's a ref, accessed directly in render
    // audioContext.position REMOVED - uses SharedValues now!
    // audioContext.duration REMOVED - not needed for render
    selectedAssetIds,
    isSelectionMode,
    stableHandlePlayAsset,
    stableToggleSelect,
    stableEnterSelection,
    stableHandleDeleteLocalAsset,
    stableHandleMergeDownLocal,
    stableHandleRenameAsset
  ]);

  // Render loading state
  if (isOfflineLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">
          {t('loading') || 'Loading assets...'}
        </Text>
      </View>
    );
  }

  // Render error state
  if (isError && offlineError) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-destructive">Error loading assets</Text>
        <Text className="text-xs text-muted-foreground">
          {offlineError.message}
        </Text>
      </View>
    );
  }

  // Show full-screen overlay when VAD is locked and display mode is fullscreen
  const showFullScreenOverlay = isVADLocked && vadDisplayMode === 'fullscreen';

  return (
    <View className="flex-1 bg-background">
      {/* Full-screen VAD overlay - takes over entire screen */}
      {showFullScreenOverlay && (
        <FullScreenVADOverlay
          isVisible={true}
          energyShared={energyShared}
          vadThreshold={vadThreshold}
          isRecordingShared={isRecordingShared}
          onCancel={() => {
            // Cancel VAD mode
            setIsVADLocked(false);
          }}
        />
      )}

      {/* Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center gap-3">
          <Button variant="ghost" size="icon" onPress={onBack}>
            <Icon as={ArrowLeft} />
          </Button>
          <Text className="text-2xl font-bold text-foreground">
            {t('doRecord')}
          </Text>
          <Text className="text-xl font-bold text-foreground">
            {t('assets')} ({assets.length})
          </Text>
        </View>
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
              size={24}
            />
          </Button>
        )}
      </View>

      {/* Scrollable list area - full height with padding for controls */}
      <View className="relative h-full flex-1 p-2">
        {/* Sort button - positioned absolutely at the top */}
        <View className="absolute left-0 right-0 top-2 z-10 flex-row items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            className="flex-row items-center gap-2 px-4"
            onPress={() => {
              setSortOrder((prev) =>
                prev === 'original' ? 'verse' : 'original'
              );
            }}
          >
            <Icon as={ArrowUpDown} size={16} />
            <Text className="text-xs">
              {sortOrder === 'original' ? 'Original order' : 'Sort by verse'}
            </Text>
          </Button>
        </View>

        {assets.length === 0 && (
          <View className="items-center justify-center py-16">
            <Text className="text-center text-muted-foreground">
              No assets yet. Start recording to create your first asset.
            </Text>
          </View>
        )}

        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {USE_INSERTION_WHEEL ? (
          // ArrayInsertionWheel mode - always show wheel, even when empty
          <ArrayInsertionWheel
            ref={wheelRef}
            value={insertionIndex}
            onChange={(index) => {
              setInsertionIndex(index);
              setRealTimeIndex(index); // Sync when scroll ends
            }}
            rowHeight={ROW_HEIGHT}
            className="h-full flex-1"
            bottomInset={footerHeight}
            onIndexChanging={(_previousIndex, currentIndex) => {
              // Update index in real-time for button calculation
              setRealTimeIndex(currentIndex);

              // Hide button immediately when scrolling starts
              setIsWheelScrolling(true);

              // Cancel any previous timeout
              if (wheelScrollDebounceRef.current) {
                clearTimeout(wheelScrollDebounceRef.current);
              }

              // Start debounce - button reappears after delay if scrolling stops
              wheelScrollDebounceRef.current = setTimeout(() => {
                setIsWheelScrolling(false);
              }, WHEEL_SCROLL_DEBOUNCE_MS);
            }}
          >
            {wheelChildren}
          </ArrayInsertionWheel>
        ) : (
          // LegendList mode (legacy)
          assetsForLegendList.length > 0 && (
            <LegendList
              ref={listRef}
              data={assetsForLegendList}
              renderItem={renderAssetItem}
            />
          )
        )}
      </View>

      {/* Bottom controls - absolutely positioned */}
      <View className="absolute bottom-0 left-0 right-0">
        {isSelectionMode ? (
          <View className="px-4" style={{ paddingBottom: insets.bottom }}>
            <SelectionControls
              selectedCount={selectedAssetIds.size}
              onCancel={cancelSelection}
              onMerge={handleBatchMergeSelected}
              onDelete={handleBatchDeleteSelected}
              onAssignVerse={() => setShowVerseAssignerModal(true)}
            />
          </View>
        ) : (
          <>
            {/* Floating bookmark button - positioned above RecordingControls */}
            {nextAvailableVerse != null &&
              !isRecording &&
              !isVADLocked &&
              !isWheelScrolling && (
                <View
                  className="absolute left-0 right-0 items-center justify-center"
                  style={{ bottom: footerHeight + insets.bottom + 4 }}
                >
                  <Button
                    variant={activeVerse ? 'default' : 'secondary'}
                    size="sm"
                    onPress={() => {
                      handleApplyVerse({
                        from: nextAvailableVerse,
                        to: nextAvailableVerse
                      });
                    }}
                    className="flex-row items-center gap-1 rounded-full px-4 py-1"
                  >
                    <Icon as={BookmarkPlusIcon} size={16} />
                    <Text className="whitespace-nowrap text-[10px]">
                      {`${bookChapterLabel}:${nextAvailableVerse}`}
                    </Text>
                  </Button>
                </View>
              )}
            <RecordingControls
              isRecording={isRecording || isVADRecording}
              onRecordingStart={handleRecordingStart}
              onRecordingStop={handleRecordingStop}
              onRecordingComplete={handleRecordingComplete}
              onRecordingDiscarded={handleRecordingDiscarded}
              onLayout={setFooterHeight}
              isVADLocked={isVADLocked}
              onVADLockChange={setIsVADLocked}
              onSettingsPress={() => setShowVADSettings(true)}
              onAutoCalibratePress={() => {
                setAutoCalibrateOnOpen(true);
                setShowVADSettings(true);
              }}
              currentEnergy={currentEnergy}
              vadThreshold={vadThreshold}
              energyShared={energyShared}
              isRecordingShared={isRecordingShared}
              displayMode={vadDisplayMode}
            />
          </>
        )}
      </View>

      {/* Rename modal */}
      <RenameAssetModal
        isVisible={showRenameModal}
        currentName={renameAssetName}
        onClose={() => setShowRenameModal(false)}
        onSave={handleSaveRename}
      />

      {/* Verse Assigner Drawer */}
      <Drawer
        open={showVerseAssignerModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowVerseAssignerModal(false);
          }
        }}
        snapPoints={['50%']}
        enableDynamicSizing={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Assign Verse Label</DrawerTitle>
          </DrawerHeader>
          <View className="p-4">
            <VerseAssigner
              existingLabels={existingLabels}
              availableVerses={availableVerses}
              getMaxToForFrom={getMaxToForFrom}
              ScrollViewComponent={GHScrollView}
              onApply={handleAssignVerse}
              onRemove={handleRemoveVerse}
              hasSelectedAssetsWithLabels={hasSelectedAssetsWithLabels}
              onCancel={() => setShowVerseAssignerModal(false)}
            />
          </View>
        </DrawerContent>
      </Drawer>

      {/* VAD Settings Drawer */}
      <VADSettingsDrawer
        isOpen={showVADSettings}
        onOpenChange={(open) => {
          setShowVADSettings(open);
          // Reset auto-calibrate flag when drawer closes
          if (!open) {
            setAutoCalibrateOnOpen(false);
          }
        }}
        threshold={vadThreshold}
        onThresholdChange={setVadThreshold}
        silenceDuration={vadSilenceDuration}
        onSilenceDurationChange={setVadSilenceDuration}
        isVADLocked={isVADLocked}
        displayMode={vadDisplayMode}
        onDisplayModeChange={setVadDisplayMode}
        autoCalibrateOnOpen={autoCalibrateOnOpen}
      />
    </View>
  );
};

export default RecordingViewSimplified;
