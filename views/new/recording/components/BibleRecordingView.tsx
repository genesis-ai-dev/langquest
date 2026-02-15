import type { ArrayInsertionWheelHandle } from '@/components/ArrayInsertionWheel';
import ArrayInsertionWheel from '@/components/ArrayInsertionWheel';
import { RecordingHelpDialog } from '@/components/RecordingHelpDialog';
import { VersePill } from '@/components/VersePill';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getNextOrderIndex as getNextAclOrderIndex,
  renameAsset
} from '@/database_services/assetService';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import { asset_content_link, project_language_link } from '@/db/drizzleSchema';
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
import { toCompilableQuery } from '@powersync/drizzle-driver';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { and, asc, eq } from 'drizzle-orm';
import { Audio } from 'expo-av';
import {
  ArrowDownNarrowWide,
  ArrowLeft,
  ChevronLeft,
  ListVideo,
  Mic,
  PauseIcon,
  Plus
} from 'lucide-react-native';
import React, { useMemo } from 'react';
import { InteractionManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHybridData } from '../../useHybridData';
import { useSelectionMode } from '../hooks/useSelectionMode';
import { useVADRecording } from '../hooks/useVADRecording';
import { saveRecording } from '../services/recordingService';
import { AssetCard } from './AssetCard';
import { FullScreenVADOverlay } from './FullScreenVADOverlay';
import { RecordingControls } from './RecordingControls';
import { RenameAssetDrawer } from './RenameAssetDrawer';
import { SelectionControls } from './SelectionControls';
import { VADSettingsDrawer } from './VADSettingsDrawer';

// Feature flag: true = use ArrayInsertionWheel, false = use LegendList
// const USE_INSERTION_WHEEL = true;
const DEBUG_MODE = false;
function debugLog(...args: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

interface UIAsset {
  type: 'asset';
  id: string;
  name: string;
  created_at: string;
  order_index: number;
  source: 'local' | 'synced' | 'cloud';
  segmentCount: number;
  duration?: number; // Total duration in milliseconds
  verse?: { from: number; to: number } | null; // Verse metadata (can be a range like 1-3)
}

interface VersePillItem {
  type: 'pill';
  id: string; // Unique ID for the pill (e.g., 'pill-verse-5')
  order_index: number;
  verse: { from: number; to: number } | null; // Verse metadata
}

// Union type for items in the list (assets or verse pills)
type ListItem = UIAsset | VersePillItem;

// Type guard to check if item is an asset
const isAsset = (item: ListItem): item is UIAsset => item.type === 'asset';

// Type guard to check if item is a pill
const isPill = (item: ListItem): item is VersePillItem => item.type === 'pill';

// Default order_index for unassigned verses: (999 * 1000 + 1) * 1000 = 999001000
// Sequence starts at 1, not 0 (e.g., verse 7 → 7001000, 7002000...)
// The extra *1000 leaves space for future insertions between assets
const DEFAULT_ORDER_INDEX = 999001000;

// Verse metadata type
interface VerseRange {
  from: number;
  to: number;
}

// Asset metadata type (prefixed with _ to allow unused)
interface _AssetMetadata {
  verse?: VerseRange;
}

interface BibleRecordingViewProps {
  // Callback when user navigates back - receives array of verse numbers that were recorded
  // Used by parent to normalize order_index for those verses
  onBack: (recordedVerses?: number[]) => void;
  // Pass existing assets as initial data to avoid redundant query
  initialAssets?: unknown[];
  // Label for the recording session (e.g., verse reference like "5" or "5-7")
  label?: string;
  // Initial order_index for new recordings (default: 999001 for unassigned)
  initialOrderIndex?: number;
  // Verse metadata from the selected asset
  verse?: VerseRange;
  // Book chapter label for separators (short name, e.g., "Gen 1" or "Mat 3")
  bookChapterLabel?: string;
  // Book chapter label for header (full name from quest.name, e.g., "Genesis 1" or "Matthew 3")
  bookChapterLabelFull?: string;
  // Next verse number to record (for automatic progression)
  nextVerse?: number | null;
  // Limit verse number (for stopping automatic progression)
  limitVerse?: number | null;
}

const BibleRecordingView = ({
  onBack,
  initialAssets: _initialAssets, // Not used - session mode starts with empty list
  label: _label = '', // TODO: Display label in header
  initialOrderIndex: _initialOrderIndex = DEFAULT_ORDER_INDEX, // TODO: Use for order_index calculation
  verse: _verse, // TODO: Use for verse tracking and metadata
  bookChapterLabel = 'Verse', // Book chapter label for separators (short name, e.g., "Gen 1")
  bookChapterLabelFull, // Book chapter label for header (full name from quest, e.g., "Genesis 1")
  nextVerse = null, // Next verse number to record (for automatic progression)
  limitVerse = null // Limit verse number (for stopping automatic progression)
}: BibleRecordingViewProps) => {
  // Log props on mount
  React.useEffect(() => {
    console.log(
      `📥 BibleRecordingView props | initialOrderIndex: ${_initialOrderIndex} | label: "${_label}" | verse: ${_verse ? `${_verse.from}-${_verse.to}` : 'null'} | nextVerse: ${nextVerse} | limitVerse: ${limitVerse}`
    );
  }, [_initialOrderIndex, _label, _verse, nextVerse, limitVerse]);

  const queryClient = useQueryClient();
  const { t } = useLocalization();
  const navigation = useCurrentNavigation();
  const { currentQuestId, currentProjectId } = navigation;
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
  const [isVADActive, setIsVADActive] = React.useState(false);

  // VAD settings - persisted in local store for consistent UX
  // These settings are automatically saved to AsyncStorage and restored on app restart
  // Default: threshold=0.03 (normal sensitivity), silenceDuration=1000ms (1 second pause)
  const vadThreshold = useLocalStore((state) => state.vadThreshold);
  const setVadThreshold = useLocalStore((state) => state.setVadThreshold);
  const vadSilenceDuration = useLocalStore((state) => state.vadSilenceDuration);
  const setVadSilenceDuration = useLocalStore(
    (state) => state.setVadSilenceDuration
  );

  const vadMinSegmentLength = useLocalStore(
    (state) => state.vadMinSegmentLength
  );

  const setVadMinSegmentLength = useLocalStore(
    (state) => state.setVadMinSegmentLength
  );
  const vadDisplayMode = useLocalStore((state) => state.vadDisplayMode);
  const setVadDisplayMode = useLocalStore((state) => state.setVadDisplayMode);
  const enableMerge = useLocalStore((state) => state.enableMerge);
  const [showVADSettings, setShowVADSettings] = React.useState(false);
  const [autoCalibrateOnOpen, setAutoCalibrateOnOpen] = React.useState(false);

  // Track current recording order index and verse
  const currentRecordingOrderRef = React.useRef<number>(0);
  const currentRecordingVerseRef = React.useRef<{
    from: number;
    to: number;
  } | null>(null);
  const vadCounterRef = React.useRef<number | null>(null);
  const dbWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  // Track pending asset names to prevent duplicates when recording multiple assets quickly
  const pendingAssetNamesRef = React.useRef<Set<string>>(new Set());

  // Sequential name counter - persisted per quest in AsyncStorage
  // Key format: `bible_recording_counter_${questId}`
  // This counter is independent of order_index and VAD mode
  const nameCounterRef = React.useRef<number>(1);
  const nameCounterLoadedRef = React.useRef<boolean>(false);

  // Track which verses were recorded during this session
  // Used to normalize order_index when returning to BibleAssetsView
  const recordedVersesRef = React.useRef<Set<number>>(new Set());

  // Track if the user is allowed to add a new verse
  const allowAddVerseRef = React.useRef<boolean>(true);

  // Load name counter from AsyncStorage on mount
  React.useEffect(() => {
    if (!currentQuestId || nameCounterLoadedRef.current) return;

    const loadCounter = async () => {
      try {
        const key = `bible_recording_counter_${currentQuestId}`;
        const saved = await AsyncStorage.getItem(key);
        if (saved) {
          const value = parseInt(saved, 10);
          if (!isNaN(value) && value > 0) {
            nameCounterRef.current = value;
            console.log(
              `📊 Loaded name counter: ${value} for quest ${currentQuestId.slice(0, 8)}`
            );
          }
        }
        nameCounterLoadedRef.current = true;
      } catch (error) {
        console.error('Failed to load name counter:', error);
        nameCounterLoadedRef.current = true;
      }
    };

    void loadCounter();
  }, [currentQuestId]);

  // Helper to save counter to AsyncStorage
  const saveNameCounter = React.useCallback(
    async (value: number) => {
      if (!currentQuestId) return;
      try {
        const key = `bible_recording_counter_${currentQuestId}`;
        await AsyncStorage.setItem(key, String(value));
        console.log(
          `💾 Saved name counter: ${value} for quest ${currentQuestId.slice(0, 8)}`
        );
      } catch (error) {
        console.error('Failed to save name counter:', error);
      }
    },
    [currentQuestId]
  );

  // Track which asset is currently playing during play-all
  const [currentlyPlayingAssetId, setCurrentlyPlayingAssetId] = React.useState<
    string | null
  >(null);
  // Track if PlayAll is running (for button icon state)
  const [isPlayAllRunning, setIsPlayAllRunning] = React.useState(false);
  // Ref to track if handlePlayAll is running (for cancellation)
  const isPlayAllRunningRef = React.useRef(false);
  // Ref to track current playing sound for immediate cancellation
  const currentPlayAllSoundRef = React.useRef<Audio.Sound | null>(null);

  // Track setTimeout IDs for cleanup
  const timeoutIdsRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );

  // Track AbortController for batch loading cleanup
  const batchLoadingControllerRef = React.useRef<AbortController | null>(null);

  // Ref to hold latest audioContext for cleanup (avoids stale closure)
  const audioContextCurrentRef = React.useRef(audioContext);
  React.useEffect(() => {
    audioContextCurrentRef.current = audioContext;
  }, [audioContext]);

  // Insertion wheel state
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  const wheelRef = React.useRef<ArrayInsertionWheelHandle>(null);

  // Track footer height for proper scrolling
  const [footerHeight, setFooterHeight] = React.useState(0);
  const ROW_HEIGHT = 80;

  // Dynamic verse tracking for automatic progression
  // Starts as null - only set when user clicks "Add verse" button
  // This allows the initial verse (_verse) to be displayed first
  const [currentDynamicVerse, setCurrentDynamicVerse] = React.useState<
    number | null
  >(null);

  // Persist initial props in refs - these should NOT change during the recording session
  // even when invalidateQueries causes re-renders. We capture them once on mount.
  // Using useState with initializer function ensures this only runs once
  const [persistedProps] = React.useState(() => ({
    nextVerse,
    limitVerse,
    verse: _verse
  }));
  const persistedNextVerseRef = React.useRef(persistedProps.nextVerse);
  const persistedLimitVerseRef = React.useRef(persistedProps.limitVerse);
  const persistedVerseRef = React.useRef(persistedProps.verse);

  // Debounced insertion index to prevent button flickering when scrolling fast
  const [debouncedIsAtEnd, setDebouncedIsAtEnd] = React.useState(false);

  // Selection mode for batch operations (merge, delete)
  const {
    isSelectionMode,
    selectedAssetIds,
    enterSelection,
    toggleSelect,
    cancelSelection,
    selectMultiple
  } = useSelectionMode();

  // Rename drawer state
  const [showRenameDrawer, setShowRenameDrawer] = React.useState(false);
  const [renameAssetId, setRenameAssetId] = React.useState<string | null>(null);
  const [renameAssetName, setRenameAssetName] = React.useState<string>('');

  // Track segment counts for each asset (loaded lazily)
  const [assetSegmentCounts, setAssetSegmentCounts] = React.useState<
    Map<string, number>
  >(new Map());

  // Track durations for each asset (loaded lazily)
  const [assetDurations, setAssetDurations] = React.useState<
    Map<string, number>
  >(new Map());

  // SESSION-ONLY ITEMS: Assets and verse pills created during this recording session
  // When user exits and returns, the list starts with just the initial verse pill
  // Assets are still saved to database, but we don't load existing ones
  const [sessionItems, setSessionItems] = React.useState<ListItem[]>(() => {
    // Initialize with the initial verse pill
    if (!_verse) return [];
    const initialVerse = _verse;
    const initialPill: VersePillItem = {
      type: 'pill',
      id: `pill-initial-${_initialOrderIndex}`,
      order_index: _initialOrderIndex,
      verse: initialVerse
    };
    console.log(
      `🏷️ Initial pill created | order_index: ${_initialOrderIndex} | verse: ${initialVerse.from}-${initialVerse.to}`
    );
    return [initialPill];
  });

  // Track the "append" order_index (used when recording at the end of the list)
  // Initialized from props or DEFAULT_ORDER_INDEX, increments by 1 for each recording at end
  const appendOrderIndexRef = React.useRef<number>(_initialOrderIndex + 1);

  // Helper to add a new asset to the session list
  // Replicates the shift logic from recordingService.ts to keep UI in sync with DB
  const addSessionAsset = React.useCallback(
    (newAsset: {
      id: string;
      name: string;
      order_index: number;
      verse?: { from: number; to: number } | null;
    }) => {
      const targetOrderIndex = newAsset.order_index;

      setSessionItems((prev) => {
        // 1. Shift existing items (both assets and pills) with order_index >= targetOrderIndex
        // This mirrors the logic in recordingService.ts
        const shifted = prev.map((item) => {
          if (item.order_index >= targetOrderIndex) {
            const itemName = isAsset(item)
              ? item.name
              : `pill-${item.verse?.from ?? 'null'}`;
            console.log(
              `📊 UI Shift: "${itemName}" ${item.order_index} → ${item.order_index + 1}`
            );
            return { ...item, order_index: item.order_index + 1 };
          }
          return item;
        });

        // 2. Create new asset with the target order_index and verse
        const uiAsset: UIAsset = {
          type: 'asset',
          id: newAsset.id,
          name: newAsset.name,
          created_at: new Date().toISOString(),
          order_index: targetOrderIndex,
          source: 'local',
          segmentCount: 1,
          duration: undefined,
          verse: newAsset.verse ?? null
        };

        if (!newAsset.verse) {
          allowAddVerseRef.current = false;
        }

        console.log(
          `➕ Adding "${newAsset.name}" with order_index: ${targetOrderIndex} | verse: ${newAsset.verse ? `${newAsset.verse.from}-${newAsset.verse.to}` : 'null'}`
        );

        // 3. Add new asset and sort by order_index
        const newList = [...shifted, uiAsset];
        return newList.sort((a, b) => {
          if (a.order_index === b.order_index) {
            // Pills come before assets at the same order_index
            if (isPill(a) && isAsset(b)) return -1;
            if (isAsset(a) && isPill(b)) return 1;
            // Both are same type - sort by created_at for assets, keep order for pills
            if (isAsset(a) && isAsset(b)) {
              return a.created_at.localeCompare(b.created_at);
            }
            return 0;
          }
          return a.order_index > b.order_index ? 1 : -1;
        });
      });
    },
    []
  );

  // Helper to add a new verse pill to the session list
  const addVersePill = React.useCallback(
    (verse: number, orderIndex: number) => {
      const newPill: VersePillItem = {
        type: 'pill',
        id: `pill-verse-${verse}-${Date.now()}`,
        order_index: orderIndex,
        verse: { from: verse, to: verse }
      };

      console.log(
        `🏷️ Adding pill for verse ${verse} with order_index: ${orderIndex}`
      );

      setSessionItems((prev) => {
        const newList = [...prev, newPill];
        return newList.sort((a, b) => {
          if (a.order_index === b.order_index) {
            // Pills come before assets at the same order_index
            if (isPill(a) && isAsset(b)) return -1;
            if (isAsset(a) && isPill(b)) return 1;
            if (isAsset(a) && isAsset(b)) {
              return a.created_at.localeCompare(b.created_at);
            }
            return 0;
          }
          return a.order_index > b.order_index ? 1 : -1;
        });
      });
    },
    []
  );

  // Use session items - filter to get only assets for backward compatibility
  const rawAssets = React.useMemo(
    () => sessionItems.filter(isAsset),
    [sessionItems]
  );

  // All items (assets + pills) for the wheel
  const allItems = sessionItems;

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
          verse?: { from: number; to: number } | null;
        };
        // Get segment count and duration from lazy-loaded maps
        // Default to 1 segment if not loaded yet, undefined for duration (shows loading state)
        const segmentCount = assetSegmentCounts.get(obj.id) ?? 1;
        const duration = assetDurations.get(obj.id); // undefined if not loaded yet

        // DEBUG: Log assets with multiple segments
        if (segmentCount > 1) {
          debugLog(
            `📊 Asset "${obj.name}" (${obj.id.slice(0, 8)}) has ${segmentCount} segments`
          );
        }

        return {
          type: 'asset' as const,
          id: obj.id,
          name: obj.name,
          created_at: obj.created_at,
          order_index:
            typeof obj.order_index === 'number' ? obj.order_index : index,
          source: obj.source,
          segmentCount,
          duration,
          verse: obj.verse ?? null
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

  // Check if we're at the end of the list (for add verse button behavior)
  const isAtEndOfList = React.useMemo(
    () => allItems.length === 0 || insertionIndex >= allItems.length,
    [allItems.length, insertionIndex]
  );

  // Get the item at the current insertion position (center of wheel)
  // This can be either an asset or a verse pill
  const highlightedItem = React.useMemo(() => {
    if (allItems.length === 0) return null;
    // insertionIndex can be 0 to allItems.length (inclusive)
    // When at the end (insertionIndex >= allItems.length), we still want to show the last item
    const idx = Math.min(insertionIndex, allItems.length - 1);
    return allItems[idx] ?? null;
  }, [allItems, insertionIndex]);

  // Get the highlighted item as an asset (null if it's a pill)
  // Prefixed with _ as it may not be used directly but kept for potential future use
  const _highlightedAsset = React.useMemo(() => {
    if (!highlightedItem || isPill(highlightedItem)) return null;
    return highlightedItem;
  }, [highlightedItem]);

  // Get verse metadata from highlighted item (works for both assets and pills)
  // This can be a range like { from: 1, to: 3 }
  const highlightedItemVerse = React.useMemo(() => {
    if (!highlightedItem) return null;
    return highlightedItem.verse ?? null;
  }, [highlightedItem]);

  // Legacy alias for backward compatibility
  const highlightedAssetVerse = highlightedItemVerse;

  // Helper to format verse range as text
  const formatVerseRange = React.useCallback(
    (verse: { from: number; to: number } | null | undefined) => {
      if (!verse?.from) return null;
      const verseText =
        verse.from === verse.to ? `${verse.from}` : `${verse.from}-${verse.to}`;
      return `${bookChapterLabel}:${verseText}`;
    },
    [bookChapterLabel]
  );

  // Build verse pill text based on context:
  // - Always show the verse of the asset in the center of the wheel (highlightedAsset)
  // - EXCEPT when user clicked "Add verse" button - then show the new verse
  // - If no assets exist, show the initial verse from props or "No Label Assigned"
  const versePillText = React.useMemo(() => {
    // If user clicked "Add verse" button, show the new dynamic verse
    if (currentDynamicVerse !== null) {
      return (
        formatVerseRange({
          from: currentDynamicVerse,
          to: currentDynamicVerse
        }) ?? 'No Label Assigned'
      );
    }

    // If there are assets, show the verse of the asset in the center
    if (highlightedAssetVerse) {
      return formatVerseRange(highlightedAssetVerse) ?? 'No Label Assigned';
    }

    // No assets yet - show the initial verse from props
    if (persistedVerseRef.current) {
      return formatVerseRange(persistedVerseRef.current) ?? 'No Label Assigned';
    }

    return 'No Label Assigned';
  }, [highlightedAssetVerse, formatVerseRange, currentDynamicVerse]);

  // Debounce logic for showing add verse button
  // Uses isAtEndOfList calculated above
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedIsAtEnd(isAtEndOfList);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeout);
  }, [isAtEndOfList]);

  // Calculate the next verse to add (what the button will show)
  // Uses persisted refs to avoid issues with query invalidation re-renders
  // If user already clicked Add, show currentDynamicVerse + 1 (if within limit)
  // If user hasn't clicked yet, show persisted nextVerse
  const verseToAdd = React.useMemo(() => {
    const limit = persistedLimitVerseRef.current;

    if (currentDynamicVerse !== null) {
      // User already clicked Add - next verse is current + 1
      const next = currentDynamicVerse + 1;
      // Check if next is within limit
      if (limit !== null && next > limit) {
        return null; // No more verses to add
      }
      return next;
    }
    // User hasn't clicked Add yet - use persisted nextVerse
    return persistedNextVerseRef.current;
  }, [currentDynamicVerse]);

  // Show add verse button if:
  // 1. At the end of the list (debounced)
  // 2. There's a verse available to add (verseToAdd not null)
  const showAddVerseButton = React.useMemo(
    () => debouncedIsAtEnd && verseToAdd !== null,
    [debouncedIsAtEnd, verseToAdd]
  );

  // Log for debugging button visibility and verse pill
  React.useEffect(() => {
    const highlightedVerseStr = highlightedAssetVerse
      ? `${highlightedAssetVerse.from}-${highlightedAssetVerse.to}`
      : 'null';
    console.log(
      `🔘 State | insertionIdx: ${insertionIndex} | assetsLen: ${assets.length} | isAtEnd: ${isAtEndOfList} | debouncedIsAtEnd: ${debouncedIsAtEnd} | highlightedVerse: ${highlightedVerseStr} | verseToAdd: ${verseToAdd} | currentDynamic: ${currentDynamicVerse} | pillText: ${versePillText}`
    );
  }, [
    insertionIndex,
    assets.length,
    isAtEndOfList,
    debouncedIsAtEnd,
    highlightedAssetVerse,
    verseToAdd,
    currentDynamicVerse,
    showAddVerseButton,
    versePillText
  ]);

  // Handle adding next verse metadata
  // When clicked, adds a pill at the end of the list
  // The button will then show the next verse (verseToAdd + 1)
  const handleAddNextVerse = React.useCallback(() => {
    if (verseToAdd === null) return;

    console.log(`➕ Adding verse ${verseToAdd} as pill to list`);

    // Calculate order_index for the first asset of this verse
    // Formula: (verse * 1000 + 1) * 1000
    // This positions it at the beginning of the verse range
    const newOrderIndex = (verseToAdd * 1000 + 1) * 1000;

    // Update appendOrderIndexRef to point to after this new pill
    appendOrderIndexRef.current = newOrderIndex + 1;

    console.log(
      `📊 Adding pill for verse ${verseToAdd} | order_index: ${newOrderIndex} | next append: ${appendOrderIndexRef.current}`
    );

    // Mark that a pill was added (so auto-scroll moves to end)
    wasPillAddedRef.current = true;

    // Add the verse pill to the list
    addVersePill(verseToAdd, newOrderIndex);

    // Set currentDynamicVerse to this verse (for button calculation)
    setCurrentDynamicVerse(verseToAdd);

    // Move insertion index to the end (where the pill was added)
    // This is done in the next useEffect that monitors allItems.length change

    // If VAD is active, update recording context to use the new pill
    if (isVADActive) {
      const newVerse = { from: verseToAdd, to: verseToAdd };
      currentRecordingVerseRef.current = newVerse;
      vadCounterRef.current = newOrderIndex + 1;
      console.log(
        `🎯 VAD: Updated to verse ${verseToAdd} | order_index: ${newOrderIndex + 1}`
      );
    }
  }, [verseToAdd, isVADActive, addVersePill]);

  // Stable item list that only updates when content actually changes
  // We intentionally use assetContentKey instead of allItems to prevent re-renders
  // when items array reference changes but content is identical
  const itemsForWheel = React.useMemo(() => allItems, [allItems]);

  // Clamp insertion index when item count changes
  React.useEffect(() => {
    const maxIndex = allItems.length; // Can insert at 0..N (after last item)
    if (insertionIndex > maxIndex) {
      setInsertionIndex(maxIndex);
    }
  }, [allItems.length, insertionIndex]);

  // Track item count to detect new insertions
  const previousItemCountRef = React.useRef(allItems.length);

  // Track if the last recording was in the middle (not at end)
  // Used to determine if we should move insertionIndex to the new item
  const wasRecordingInMiddleRef = React.useRef<boolean>(false);

  // Track if a pill was just added (to distinguish from asset recording)
  const wasPillAddedRef = React.useRef<boolean>(false);

  // Auto-scroll behavior differs between list and wheel
  React.useEffect(() => {
    const currentCount = allItems.length;
    const previousCount = previousItemCountRef.current;

    // Only scroll if a new item was added (count increased)
    if (currentCount > previousCount && currentCount > 0) {
      console.log(
        `📜 Item added | prevCount: ${previousCount} → ${currentCount} | insertionIndex: ${insertionIndex} | wasInMiddle: ${wasRecordingInMiddleRef.current} | wasPillAdded: ${wasPillAddedRef.current}`
      );

      console.log(
        '[recording in the middle]>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>',
        wasRecordingInMiddleRef.current
      );

      const wasInMiddle = wasRecordingInMiddleRef.current;
      const wasPillAdded = wasPillAddedRef.current;

      // Reset the flags
      wasRecordingInMiddleRef.current = false;
      wasPillAddedRef.current = false;

      if (wasPillAdded) {
        // A pill was added - move to the end
        console.log(
          `📍 Pill added - moving to end: ${insertionIndex} → ${currentCount}`
        );
        setInsertionIndex(currentCount);

        // Scroll to the end
        const timeoutId = setTimeout(() => {
          try {
            wheelRef.current?.scrollToInsertionIndex(currentCount, true);
          } catch (error) {
            console.error('Failed to scroll after pill added:', error);
          }
          timeoutIdsRef.current.delete(timeoutId);
        }, 100);
        timeoutIdsRef.current.add(timeoutId);
      } else if (wasInMiddle) {
        // Recorded in the middle - move to the new asset
        const newIndex = insertionIndex + 1;
        console.log(
          `📍 Moving to new asset (recorded in middle): ${insertionIndex} → ${newIndex}`
        );
        setInsertionIndex(newIndex);

        // Scroll to the new item
        const timeoutId = setTimeout(() => {
          try {
            wheelRef.current?.scrollToInsertionIndex(newIndex, true);
          } catch (error) {
            console.error('Failed to scroll:', error);
          }
          timeoutIdsRef.current.delete(timeoutId);
        }, 100);
        timeoutIdsRef.current.add(timeoutId);
      } else {
        // Asset appended at the end - move to stay at end
        console.log(
          `📍 Moving to end (appended): ${insertionIndex} → ${currentCount}`
        );
        setInsertionIndex(currentCount);

        // Scroll to the end
        const timeoutId = setTimeout(() => {
          try {
            wheelRef.current?.scrollToInsertionIndex(currentCount, true);
          } catch (error) {
            console.error('Failed to scroll:', error);
          }
          timeoutIdsRef.current.delete(timeoutId);
        }, 100);
        timeoutIdsRef.current.add(timeoutId);
      }
    }

    previousItemCountRef.current = currentCount;
  }, [allItems.length, insertionIndex]);

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

  // Handle play all assets - optimized version with direct control
  const handlePlayAll = React.useCallback(async () => {
    try {
      // Check if already playing - toggle to stop
      if (isPlayAllRunningRef.current) {
        isPlayAllRunningRef.current = false;
        setIsPlayAllRunning(false);

        // Stop current sound immediately
        if (currentPlayAllSoundRef.current) {
          try {
            await currentPlayAllSoundRef.current.stopAsync();
            await currentPlayAllSoundRef.current.unloadAsync();
            currentPlayAllSoundRef.current = null;
          } catch (error) {
            console.error('Error stopping sound:', error);
          }
        }

        setCurrentlyPlayingAssetId(null);
        debugLog('⏸️ Stopped play all');
        return;
      }

      if (itemsForWheel.length === 0) {
        console.warn('⚠️ No items to play');
        return;
      }

      // Mark as running
      isPlayAllRunningRef.current = true;
      setIsPlayAllRunning(true);

      debugLog(`🎵 Starting play all from wheel position ${insertionIndex}`);

      let assetsPlayed = 0;

      // Iterate directly through itemsForWheel starting from insertionIndex
      for (
        let wheelIndex = insertionIndex;
        wheelIndex < itemsForWheel.length;
        wheelIndex++
      ) {
        // Check if cancelled
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isPlayAllRunningRef.current) {
          debugLog('⏸️ Play all cancelled');
          setCurrentlyPlayingAssetId(null);
          return;
        }

        const item = itemsForWheel[wheelIndex];

        // Skip if no item or if it's a pill
        if (!item || isPill(item)) {
          debugLog(`⏭️ Position ${wheelIndex}: skipping pill`);
          continue;
        }

        // It's an asset - play it
        const asset = item;

        // Get URIs for this asset
        const uris = await getAssetAudioUris(asset.id);
        if (uris.length === 0) {
          debugLog(
            `⚠️ Position ${wheelIndex}: no URIs for asset ${asset.name}`
          );
          continue;
        }

        // HIGHLIGHT THIS ASSET
        setCurrentlyPlayingAssetId(asset.id);

        // Scroll to this position in the wheel (wheelIndex is the direct position)
        if (wheelRef.current) {
          wheelRef.current.scrollItemToTop(wheelIndex - 1, true);
        }

        assetsPlayed++;
        debugLog(
          `▶️ Position ${wheelIndex}: Playing asset ${asset.name} (${uris.length} segments)`
        );

        // Play all URIs for this asset sequentially
        for (const uri of uris) {
          // Check if cancelled
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!isPlayAllRunningRef.current) {
            setCurrentlyPlayingAssetId(null);
            return;
          }

          // Play this URI and wait for it to finish
          await new Promise<void>((resolve) => {
            Audio.Sound.createAsync({ uri }, { shouldPlay: true })
              .then(({ sound }) => {
                currentPlayAllSoundRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                  if (!status.isLoaded) return;

                  if (status.didJustFinish) {
                    currentPlayAllSoundRef.current = null;
                    void sound.unloadAsync().then(() => {
                      resolve();
                    });
                  }
                });
              })
              .catch((error) => {
                console.error('Failed to play audio:', error);
                currentPlayAllSoundRef.current = null;
                resolve();
              });
          });
        }
      }

      if (assetsPlayed === 0) {
        console.warn('⚠️ No assets found to play from current position');
      }

      // Done playing all
      debugLog('✅ Finished playing all assets');
      setCurrentlyPlayingAssetId(null);
      isPlayAllRunningRef.current = false;
      setIsPlayAllRunning(false);
      currentPlayAllSoundRef.current = null;
    } catch (error) {
      console.error('❌ Failed to play all assets:', error);
      setCurrentlyPlayingAssetId(null);
      isPlayAllRunningRef.current = false;
      setIsPlayAllRunning(false);
      currentPlayAllSoundRef.current = null;
    }
  }, [getAssetAudioUris, insertionIndex, itemsForWheel]);

  // ============================================================================
  // RECORDING HANDLERS
  // ============================================================================

  /**
   * CENTRALIZED INSERTION CONTEXT
   * This function calculates where and how to insert new recordings
   * based on the current wheel position and list state.
   *
   * Returns:
   * - orderIndex: The order_index to use for the new recording
   * - verse: The verse metadata to use for the new recording
   * - isAtEnd: Whether we're inserting at the end of the list
   */
  const getInsertionContext = React.useCallback(
    (currentIndex: number = insertionIndex) => {
      const isAtEnd = allItems.length === 0 || currentIndex >= allItems.length;
      console.log(
        '🔍 getInsertionContext | currentIndex:',
        currentIndex,
        '| allItems.length:',
        allItems.length,
        '| isAtEnd:',
        isAtEnd
      );

      if (isAtEnd) {
        // At end: calculate order_index based on last item, not appendOrderIndexRef
        // appendOrderIndexRef is only used as a cache and gets updated after recording
        const lastItem = allItems[allItems.length - 1];
        const orderIndex = lastItem
          ? lastItem.order_index + 1
          : appendOrderIndexRef.current; // Fallback for empty list
        const verse = lastItem?.verse ?? persistedVerseRef.current ?? null;

        console.log(
          '🔍 At END | lastItem order_index:',
          lastItem?.order_index,
          '| calculated orderIndex:',
          orderIndex,
          '| appendOrderIndexRef:',
          appendOrderIndexRef.current
        );

        return { orderIndex, verse, isAtEnd: true };
      } else {
        // In middle: use selected item's context
        const selectedItem = allItems[currentIndex];
        const orderIndex = selectedItem
          ? selectedItem.order_index + 1
          : currentIndex + 1;
        const verse = selectedItem?.verse ?? null;

        return { orderIndex, verse, isAtEnd: false };
      }
    },
    [allItems, insertionIndex]
  );

  // Store insertion index in ref to prevent stale closure issues
  const insertionIndexRef = React.useRef(insertionIndex);
  React.useEffect(() => {
    insertionIndexRef.current = insertionIndex;
  }, [insertionIndex]);

  // Track if we're currently in the middle of the list (for VAD continuous recording)
  // When VAD starts, we capture the position and use same order_index for all segments
  // until VAD stops or user moves the wheel
  const vadInsertionIndexRef = React.useRef<number | null>(null);
  // Track if VAD was started at the end of the list (append mode)
  // This is captured once when VAD activates and doesn't change during the session
  const vadIsAtEndRef = React.useRef<boolean>(false);

  // Initialize VAD counter and verse when VAD mode activates
  React.useEffect(() => {
    if (isVADActive && vadCounterRef.current === null) {
      // Capture current position when VAD starts
      vadInsertionIndexRef.current = insertionIndexRef.current;

      // Get insertion context based on current position
      const {
        orderIndex,
        verse,
        isAtEnd: contextIsAtEnd
      } = getInsertionContext(insertionIndexRef.current);

      vadCounterRef.current = orderIndex;
      currentRecordingVerseRef.current = verse;

      const selectedItem = contextIsAtEnd
        ? allItems[allItems.length - 1]
        : allItems[insertionIndexRef.current];
      const itemName = selectedItem
        ? isPill(selectedItem)
          ? `pill-${selectedItem.verse?.from ?? 'null'}`
          : selectedItem.name
        : 'none';

      debugLog(
        `🎯 VAD initialized ${contextIsAtEnd ? 'at END' : 'in MIDDLE'} | index: ${insertionIndexRef.current} | item: "${itemName}" | order_index: ${orderIndex} | verse: ${verse ? `${verse.from}-${verse.to}` : 'null'}`
      );
    } else if (!isVADActive) {
      vadCounterRef.current = null;
      vadInsertionIndexRef.current = null;
      console.log(
        '[INSERTION INDEX REF 000X VAD]>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>',
        vadInsertionIndexRef.current,
        insertionIndexRef.current
      );
      vadIsAtEndRef.current = false;
    }
  }, [
    isVADActive,
    allItems,
    currentDynamicVerse,
    assets.length,
    getInsertionContext
  ]);

  // Manual recording handlers
  const handleRecordingStart = React.useCallback(() => {
    if (isRecording) return;

    const currentInsertionIndex = insertionIndexRef.current;

    console.log(
      `🎬 Recording START | insertionIndex: ${currentInsertionIndex} | allItems.length: ${allItems.length}`
    );

    // Get insertion context (order_index and verse) based on current position
    const { orderIndex, verse, isAtEnd } = getInsertionContext(
      currentInsertionIndex
    );

    // Store values for use during recording
    currentRecordingOrderRef.current = orderIndex;
    currentRecordingVerseRef.current = verse;

    // Track if we're recording in the middle (for auto-scroll behavior)
    wasRecordingInMiddleRef.current = !isAtEnd;

    // Update appendOrderIndexRef to point to next position after this recording
    // This serves as a fallback for empty lists or initial state
    if (isAtEnd) {
      appendOrderIndexRef.current = orderIndex + 1;
      console.log(
        '📊 Updated appendOrderIndexRef:',
        appendOrderIndexRef.current,
        '(for next recording at end)'
      );
    }

    // If starting recording without verse, disable adding new verses
    if (!verse) {
      allowAddVerseRef.current = false;
    }

    setIsRecording(true);

    const selectedItem = isAtEnd
      ? allItems[allItems.length - 1]
      : allItems[currentInsertionIndex];
    const itemName = selectedItem
      ? isPill(selectedItem)
        ? `pill-${selectedItem.verse?.from ?? 'null'}`
        : selectedItem.name
      : 'none';

    console.log(
      `🎯 Recording ${isAtEnd ? 'at END' : 'in MIDDLE'} | index: ${currentInsertionIndex} | item: "${itemName}" | order_index: ${orderIndex} | verse: ${verse ? `${verse.from}-${verse.to}` : 'null'}`
    );
  }, [isRecording, allItems, getInsertionContext]);

  const handleRecordingStop = React.useCallback(() => {
    debugLog('🛑 Manual recording stop');
    setIsRecording(false);
  }, []);

  const handleRecordingDiscarded = React.useCallback(() => {
    debugLog('🗑️ Recording discarded');
    setIsRecording(false);
  }, []);

  const handleRecordingComplete = React.useCallback(
    async (uri: string, _duration: number, _waveformData: number[]) => {
      // Recalculate order_index based on current list state
      // This ensures each consecutive recording gets a unique incremented order_index
      const currentContext = getInsertionContext(insertionIndexRef.current);
      const targetOrder = currentContext.orderIndex;
      const verseToUse = currentContext.verse;

      // Update refs for next recording in same session
      currentRecordingOrderRef.current = targetOrder;
      currentRecordingVerseRef.current = verseToUse;

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

        // Generate name using persistent counter (independent of order_index and VAD mode)
        // Counter is persisted per quest in AsyncStorage and increments continuously
        const nextNumber = nameCounterRef.current;
        nameCounterRef.current++; // Increment immediately to reserve this number
        const assetName = String(nextNumber).padStart(3, '0');
        pendingAssetNamesRef.current.add(assetName);
        console.log(
          `🏷️ Reserved name: ${assetName} | counter: ${nextNumber} → ${nameCounterRef.current} | order_index: ${targetOrder}`
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
        dbWriteQueueRef.current = dbWriteQueueRef.current
          .then(async () => {
            if (!targetLanguoidId) {
              throw new Error('Target languoid not found for project');
            }
            // Use the verse that was captured when recording started
            // This ensures we use the correct verse for middle-of-list recordings
            const verseToUse = currentRecordingVerseRef.current;

            const newAssetId = await saveRecording({
              questId: currentQuestId,
              projectId: currentProjectId,
              targetLanguoidId: targetLanguoidId,
              userId: currentUser.id,
              orderIndex: targetOrder,
              audioUri: localUri,
              assetName: assetName, // Pass the reserved name
              metadata: verseToUse ? { verse: verseToUse } : null // Pass verse metadata if provided
            });

            // Log the saved asset details
            console.log(
              `📼 Asset saved | name: "${assetName}" | order_index: ${targetOrder} | verse: ${verseToUse ? `${verseToUse.from}-${verseToUse.to}` : 'null'}`
            );

            // Add to session assets list (UI only - not loaded from DB)
            addSessionAsset({
              id: newAssetId,
              name: assetName,
              order_index: targetOrder,
              verse: verseToUse
            });

            // Track which verse was recorded (for order_index normalization on return)
            // If no verse is assigned, use 999 (UNASSIGNED_VERSE_BASE)
            const verseToTrack = verseToUse?.from ?? 999;
            recordedVersesRef.current.add(verseToTrack);
            debugLog(
              `📋 Tracked verse ${verseToTrack} for normalization (total: ${recordedVersesRef.current.size})`
            );

            // Save the updated name counter to AsyncStorage
            await saveNameCounter(nameCounterRef.current);

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

        // Invalidate queries to sync order_index after insertions in the middle
        // This is needed because recordingService shifts order_index values
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'by-quest', currentQuestId],
          exact: false
        });

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
      targetLanguoidId,
      addSessionAsset,
      saveNameCounter,
      getInsertionContext
    ]
  );

  // VAD segment handlers
  const handleVADSegmentStart = React.useCallback(() => {
    if (vadCounterRef.current === null) {
      console.error('❌ VAD counter not initialized!');
      return;
    }

    const targetOrder = vadCounterRef.current;
    // Use the captured isAtEnd state from when VAD was activated
    // This prevents issues where assets.length changes during recording
    const isAtEnd = vadIsAtEndRef.current;

    // Track if we're recording in the middle (for auto-scroll behavior)
    wasRecordingInMiddleRef.current = !isAtEnd;

    debugLog(
      `🎬 VAD: Segment starting | order_index: ${targetOrder} | isAtEnd: ${isAtEnd}`
    );

    currentRecordingOrderRef.current = targetOrder;

    // Increment VAD counter for next segment ONLY if appending at end
    // If inserting in middle, all recordings get the same order_index
    if (isAtEnd) {
      vadCounterRef.current = targetOrder + 1;
      appendOrderIndexRef.current = vadCounterRef.current; // Keep append ref in sync
    }
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
    isVADActive: isVADActive,
    onSegmentStart: handleVADSegmentStart,
    onSegmentComplete: handleVADSegmentComplete,
    isManualRecording: isRecording
  });

  // Invalidate queries when VAD mode ends
  React.useEffect(() => {
    if (!isVADActive) {
      void queryClient.invalidateQueries({
        queryKey: ['assets', 'by-quest', currentQuestId],
        exact: false
      });
    }
  }, [isVADActive, currentQuestId, queryClient]);

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
      batchLoadingControllerRef.current = controller;

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
                  orderBy: [
                    asc(asset_content_link.order_index),
                    asc(asset_content_link.created_at)
                  ]
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
            const timeoutId = setTimeout(() => {
              timeoutIdsRef.current.delete(timeoutId);
              void processBatch(startIdx + BATCH_SIZE);
            }, 16); // One frame delay (60fps)
            timeoutIdsRef.current.add(timeoutId);
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
      // Abort controller if it exists
      if (batchLoadingControllerRef.current) {
        batchLoadingControllerRef.current.abort();
        batchLoadingControllerRef.current = null;
      }
      // Clear any pending timeouts
      const timeoutIds = timeoutIdsRef.current;
      timeoutIds.forEach((id) => clearTimeout(id));
      timeoutIds.clear();
    };
    // Only depend on assetIds and assetMetadata - NOT on the state Maps
    // The Maps are checked inside the effect with .has(), so we don't need them as dependencies
    // Including them causes the effect to re-run every time durations are updated, which
    // triggers unnecessary re-checks even though loadedAssetIdsRef prevents actual re-loading
  }, [assetIds, assetMetadata]);

  // ============================================================================
  // ASSET OPERATIONS (Delete, Merge)
  // ============================================================================

  const handleDeleteLocalAsset = React.useCallback(
    async (assetId: string) => {
      try {
        await audioSegmentService.deleteAudioSegment(assetId);

        // Remove from session assets list
        setSessionItems((prev) => prev.filter((a) => a.id !== assetId));

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
          .where(eq(contentLocal.asset_id, second.id))
          .orderBy(asc(contentLocal.order_index), asc(contentLocal.created_at));

        // Get next available order_index for the target asset
        let nextOrder = await getNextAclOrderIndex(first.id);

        for (const c of secondContent) {
          if (!c.audio) continue;
          await system.db.insert(contentLocal).values({
            asset_id: first.id,
            source_language_id: c.source_language_id, // Deprecated field, kept for backward compatibility
            languoid_id: c.languoid_id ?? c.source_language_id ?? null, // Use languoid_id if available, fallback to source_language_id
            text: c.text || '',
            audio: c.audio,
            download_profiles: [currentUser.id],
            order_index: nextOrder++
          });
        }

        await audioSegmentService.deleteAudioSegment(second.id);

        // Remove merged asset from session list (second one gets deleted)
        setSessionItems((prev) => prev.filter((a) => a.id !== second.id));

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
                    .where(eq(contentLocal.asset_id, src.id))
                    .orderBy(asc(contentLocal.order_index), asc(contentLocal.created_at));

                  // Get next available order_index for the target asset
                  let nextOrder = await getNextAclOrderIndex(target.id);

                  for (const c of srcContent) {
                    if (!c.audio) continue;
                    await system.db.insert(contentLocal).values({
                      asset_id: target.id,
                      source_language_id: c.source_language_id, // Deprecated field, kept for backward compatibility
                      languoid_id:
                        c.languoid_id ?? c.source_language_id ?? null, // Use languoid_id if available, fallback to source_language_id
                      text: c.text || '',
                      audio: c.audio,
                      download_profiles: [currentUser.id],
                      order_index: nextOrder++
                    });
                  }

                  await audioSegmentService.deleteAudioSegment(src.id);
                }

                // Remove merged assets from session list (all except target get deleted)
                const deletedIds = new Set(rest.map((a) => a.id));
                setSessionItems((prev) =>
                  prev.filter((a) => !deletedIds.has(a.id))
                );

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

                // Remove deleted assets from session list
                const deletedIds = new Set(selectedOrdered.map((a) => a.id));
                setSessionItems((prev) =>
                  prev.filter((a) => !deletedIds.has(a.id))
                );

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

  // ============================================================================
  // SELECT ALL / DESELECT ALL
  // ============================================================================

  // Calculate if all local assets are selected
  const allSelected = React.useMemo(() => {
    if (!isSelectionMode || assets.length === 0) return false;
    const selectableAssets = assets.filter((a) => a.source !== 'cloud');
    if (selectableAssets.length === 0) return false;
    return selectableAssets.every((a) => selectedAssetIds.has(a.id));
  }, [isSelectionMode, assets, selectedAssetIds]);

  // Handle select all / deselect all
  const handleSelectAll = React.useCallback(() => {
    if (allSelected) {
      // Deselect all
      selectMultiple([]);
    } else {
      // Select all local assets (exclude cloud assets)
      const selectableIds = assets
        .filter((a) => a.source !== 'cloud')
        .map((a) => a.id);
      selectMultiple(selectableIds);
    }
  }, [allSelected, assets, selectMultiple]);

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

        // Update the name directly in sessionAssets to reflect in UI immediately
        // This is safe because the database was already updated successfully
        setSessionItems((prev) =>
          prev.map((asset) =>
            asset.id === renameAssetId ? { ...asset, name: newName } : asset
          )
        );

        // Invalidate queries to refresh the list in parent view
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
  // CLEANUP ON UNMOUNT
  // ============================================================================

  // Cleanup effect: Clear all refs and stop audio when component unmounts
  // This prevents memory leaks when navigating away from the recording view
  React.useEffect(() => {
    // Capture refs in variables to avoid stale closure warnings
    const pendingAssetNames = pendingAssetNamesRef.current;
    const loadedAssetIds = loadedAssetIdsRef.current;
    const timeoutIds = timeoutIdsRef.current;

    return () => {
      // Stop audio playback if playing (access via ref for latest state)
      if (audioContextCurrentRef.current.isPlaying) {
        void audioContextCurrentRef.current.stopCurrentSound();
      }

      // Stop PlayAll if running
      if (isPlayAllRunningRef.current) {
        isPlayAllRunningRef.current = false;

        // Stop current sound immediately
        if (currentPlayAllSoundRef.current) {
          void currentPlayAllSoundRef.current
            .stopAsync()
            .then(() => {
              void currentPlayAllSoundRef.current?.unloadAsync();
              currentPlayAllSoundRef.current = null;
            })
            .catch(() => {
              // Ignore errors during cleanup
              currentPlayAllSoundRef.current = null;
            });
        }
      }

      // Clear all refs to free memory
      pendingAssetNames.clear();
      loadedAssetIds.clear();

      // Abort any ongoing batch loading
      if (batchLoadingControllerRef.current) {
        batchLoadingControllerRef.current.abort();
        batchLoadingControllerRef.current = null;
      }

      // Clear all pending timeouts
      timeoutIds.forEach((id) => clearTimeout(id));
      timeoutIds.clear();

      // Reset state maps (they'll be recreated on remount)
      setAssetSegmentCounts(new Map());
      setAssetDurations(new Map());
      setCurrentlyPlayingAssetId(null);
      setIsPlayAllRunning(false);

      debugLog('🧹 Cleaned up BibleRecordingView on unmount');
    };
  }, []);

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

  // ============================================================================
  // OPTIMIZED CALLBACKS MAP - Prevents creating new functions in wheelChildren
  // ============================================================================

  // Create a memoized factory for asset callbacks
  // This prevents creating new inline functions in wheelChildren useMemo
  const createAssetCallbacks = React.useCallback(
    (assetId: string) => ({
      onPress: () => {
        if (isSelectionMode) {
          stableToggleSelect(assetId);
        } else {
          void stableHandlePlayAsset(assetId);
        }
      },
      onLongPress: () => {
        stableEnterSelection(assetId);
      },
      onPlay: () => {
        void stableHandlePlayAsset(assetId);
      }
    }),
    [
      isSelectionMode,
      stableToggleSelect,
      stableHandlePlayAsset,
      stableEnterSelection
    ]
  );

  // Create a Map of callbacks per asset (only recreates when dependencies change)
  // This is much more efficient than creating new functions in the render loop
  const assetCallbacksMap = React.useMemo(() => {
    const map = new Map<
      string,
      {
        onPress: () => void;
        onLongPress: () => void;
        onPlay: () => void;
      }
    >();

    itemsForWheel.forEach((item) => {
      if (isAsset(item)) {
        map.set(item.id, createAssetCallbacks(item.id));
      }
    });

    return map;
  }, [itemsForWheel, createAssetCallbacks]);

  // Lazy renderItem for ArrayInsertionWheel
  // OPTIMIZED: Only renders items when they become visible (virtualização)
  // No audioContext.position/duration dependencies - progress now uses SharedValues!
  // This is much more efficient than pre-creating all children
  const renderWheelItem = React.useCallback(
    (item: ListItem, index: number) => {
      // Render verse pill items differently from asset items
      if (isPill(item)) {
        const pillText = item.verse
          ? (formatVerseRange(item.verse) ?? 'No Label')
          : 'No Label';
        return (
          <View
            key={item.id}
            className="flex-row items-center justify-center py-2"
          >
            <VersePill text={pillText} />
          </View>
        );
      }

      // Asset item rendering
      // Check if this asset is playing individually OR if it's the currently playing asset during play-all
      const isThisAssetPlayingIndividually =
        audioContext.isPlaying && audioContext.currentAudioId === item.id;
      const isThisAssetPlayingInPlayAll =
        isPlayAllRunning && currentlyPlayingAssetId === item.id;
      const isThisAssetPlaying =
        isThisAssetPlayingIndividually || isThisAssetPlayingInPlayAll;
      const isSelected = selectedAssetIds.has(item.id);

      // Check if next item is an asset (not a pill) and not from cloud
      const nextItem = itemsForWheel[index + 1];
      const canMergeDown =
        index < itemsForWheel.length - 1 &&
        nextItem &&
        isAsset(nextItem) &&
        nextItem.source !== 'cloud';

      // Duration from lazy-loaded metadata
      const duration = item.duration;

      // Get stable callbacks from Map (avoids creating new functions)
      const callbacks = assetCallbacksMap.get(item.id);

      // Fallback if callbacks not found (shouldn't happen, but defensive)
      if (!callbacks) {
        console.warn(`Missing callbacks for asset ${item.id}`);
        return <View key={item.id} style={{ height: ROW_HEIGHT }} />;
      }

      return (
        <AssetCard
          key={item.id}
          asset={item}
          index={index}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
          isPlaying={isThisAssetPlaying}
          duration={duration}
          canMergeDown={canMergeDown}
          segmentCount={item.segmentCount}
          onPress={callbacks.onPress}
          onLongPress={callbacks.onLongPress}
          onPlay={callbacks.onPlay}
          onDelete={stableHandleDeleteLocalAsset}
          onMerge={stableHandleMergeDownLocal}
          onRename={stableHandleRenameAsset}
        />
      );
    },
    [
      formatVerseRange,
      audioContext.isPlaying,
      audioContext.currentAudioId,
      isPlayAllRunning,
      currentlyPlayingAssetId,
      selectedAssetIds,
      isSelectionMode,
      itemsForWheel,
      assetCallbacksMap,
      stableHandleDeleteLocalAsset,
      stableHandleMergeDownLocal,
      stableHandleRenameAsset
    ]
  );

  // SESSION-ONLY MODE: No loading/error states needed
  // The list starts empty and only shows assets recorded in this session

  // Show full-screen overlay when VAD is active and display mode is fullscreen
  const showFullScreenOverlay = isVADActive && vadDisplayMode === 'fullscreen';

  const addButtonComponent = useMemo(() => {
    // Apply same conditions as floating button (line 3050)
    const shouldShow =
      !isSelectionMode &&
      showAddVerseButton &&
      verseToAdd !== null &&
      !isVADRecording &&
      allowAddVerseRef.current;

    if (!shouldShow) return null;

    return (
      <View className="left-0 right-0 flex w-full items-center">
        <View className="flex flex-row items-center gap-2">
          <Icon as={ChevronLeft} size={20} className="text-primary" />
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-primary bg-primary/10 text-sm"
            onPress={handleAddNextVerse}
          >
            <Icon as={Plus} size={20} className="text-primary" />
            <Text className="font-semibold text-primary">
              {/* {bookChapterLabel}:{verseToAdd} */}
              {verseToAdd}
            </Text>
          </Button>
        </View>
      </View>
    );
  }, [
    isSelectionMode,
    showAddVerseButton,
    verseToAdd,
    isVADRecording,
    handleAddNextVerse
  ]);

  const boundaryComponent = useMemo(
    () => (
      <View
        style={{ height: ROW_HEIGHT }}
        className="flex-row items-center justify-center px-4"
      >
        <View className="flex-1" />
        <View
          className="flex-row items-center gap-2"
          style={{ flex: 1, justifyContent: 'center' }}
        >
          {/* Language-agnostic visual: mic + circle-plus = "add recording here" */}
          <View
            className="flex-row items-center justify-center rounded-full border border-dashed border-primary/50 bg-primary/10 p-2"
            style={{
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Icon as={Mic} size={20} className="text-secondary-foreground/50" />
            <Icon
              as={ArrowDownNarrowWide}
              size={20}
              style={{ marginLeft: 4 }}
              className="text-secondary-foreground/50"
            />
          </View>
        </View>
        <View className="flex-1">{addButtonComponent}</View>
      </View>
    ),
    [addButtonComponent]
  );

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
            setIsVADActive(false);
          }}
        />
      )}

      {/* Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onPress={() => {
              // Pass recorded verses to parent for order_index normalization
              const recordedVerses = Array.from(recordedVersesRef.current);
              if (recordedVerses.length > 0) {
                console.log(
                  `📤 Returning with ${recordedVerses.length} recorded verse(s): [${recordedVerses.join(', ')}]`
                );
              }
              onBack(recordedVerses.length > 0 ? recordedVerses : undefined);
            }}
          >
            <Icon as={ArrowLeft} />
          </Button>
          <Text className="text-2xl font-bold text-foreground">
            {bookChapterLabelFull || bookChapterLabel}
          </Text>
          {/* <Text className="text-xl font-bold text-foreground">
            {t('doRecord')}
          </Text> */}
        </View>
        <View className="flex-row items-center gap-3">
          {assets.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onPress={handlePlayAll}
              className="h-10 w-10"
            >
              <Icon
                as={isPlayAllRunning ? PauseIcon : ListVideo}
                size={20}
                className="text-primary"
              />
            </Button>
          )}
          <Text className="text-base font-semibold text-muted-foreground">
            {assets.length} {t('assets').toLowerCase()}
          </Text>
        </View>
      </View>
      <View
        className={`flex-0 w-full items-center justify-center py-2 ${isVADActive ? 'bg-destructive' : 'bg-primary/70'}`}
      >
        {/* {(isRecording || isVADRecording)? ( */}
        {isVADActive ? (
          <Text className="text-center text-sm font-semibold text-white">
            {highlightedItemVerse
              ? `${t('recording')}: ${formatVerseRange(highlightedItemVerse)}`
              : t('recording')}
          </Text>
        ) : (
          <Text className="text-center text-sm font-semibold text-destructive-foreground">
            {highlightedItemVerse
              ? `${t('recordTo')}: ${formatVerseRange(highlightedItemVerse)}`
              : `${t('noLabelSelected')}`}
          </Text>
        )}
      </View>
      {/* Scrollable list area - full height with padding for controls */}
      <View className="h-full flex-1 p-2">
        <View className="relative h-full flex-1">
          <ArrayInsertionWheel<ListItem>
            ref={wheelRef}
            value={insertionIndex}
            onChange={(newIndex) => {
              const item = itemsForWheel[newIndex];
              const itemDesc = item
                ? isPill(item)
                  ? `pill-${item.verse?.from ?? 'null'}`
                  : item.name
                : 'end';
              console.log(
                `🎡 Wheel onChange: ${insertionIndex} → ${newIndex} | ${itemDesc} ${item?.order_index}`
              );
              setInsertionIndex(newIndex);
            }}
            rowHeight={ROW_HEIGHT}
            className="h-full flex-1"
            bottomInset={footerHeight}
            boundaryComponent={boundaryComponent}
            data={itemsForWheel}
            renderItem={renderWheelItem}
          />
        </View>
      </View>

      {/* Bottom controls - absolutely positioned */}
      <View className="absolute bottom-0 left-0 right-0 z-40">
        {isSelectionMode ? (
          <View className="px-4" style={{ paddingBottom: insets.bottom }}>
            <SelectionControls
              selectedCount={selectedAssetIds.size}
              onCancel={cancelSelection}
              onMerge={handleBatchMergeSelected}
              onDelete={handleBatchDeleteSelected}
              allowSelectAll={true}
              allSelected={allSelected}
              onSelectAll={handleSelectAll}
              showMerge={enableMerge}
            />
          </View>
        ) : (
          <RecordingControls
            isRecording={isRecording || isVADRecording}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
            onRecordingComplete={handleRecordingComplete}
            onRecordingDiscarded={handleRecordingDiscarded}
            onLayout={setFooterHeight}
            isVADActive={isVADActive}
            onVADActiveChange={setIsVADActive}
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
        )}
      </View>

      {/* Rename drawer */}
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
        minSegmentLength={vadMinSegmentLength}
        onMinSegmentLengthChange={setVadMinSegmentLength}
        threshold={vadThreshold}
        onThresholdChange={setVadThreshold}
        silenceDuration={vadSilenceDuration}
        onSilenceDurationChange={setVadSilenceDuration}
        isVADActive={isVADActive}
        displayMode={vadDisplayMode}
        onDisplayModeChange={setVadDisplayMode}
        autoCalibrateOnOpen={autoCalibrateOnOpen}
        energyShared={energyShared}
      />

      {/* Recording Help Dialog - shown once on first visit */}
      <RecordingHelpDialog />
    </View>
  );
};

export default BibleRecordingView;
