import type { ArrayInsertionWheelHandle } from '@/components/ArrayInsertionWheel';
import ArrayInsertionWheel from '@/components/ArrayInsertionWheel';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { renameAsset } from '@/database_services/assetService';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import {
    asset,
    asset_content_link,
    quest_asset_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { resolveTable } from '@/utils/dbUtils';
import {
    getLocalAttachmentUriWithOPFS,
    saveAudioLocally
} from '@/utils/fileUtils';
import type { LegendListRef } from '@legendapp/list';
import { LegendList } from '@legendapp/list';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQueryClient } from '@tanstack/react-query';
import { asc, eq, getTableColumns } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Alert, InteractionManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHybridData } from '../../useHybridData';
import { useSelectionMode } from '../hooks/useSelectionMode';
import { useVADRecording } from '../hooks/useVADRecording';
import { getNextOrderIndex, saveRecording } from '../services/recordingService';
import { AssetCard } from './AssetCard';
import { FullScreenVADOverlay } from './FullScreenVADOverlay';
import { RecordingControls } from './RecordingControls';
import { RenameAssetModal } from './RenameAssetModal';
import { SelectionControls } from './SelectionControls';
import { VADSettingsDrawer } from './VADSettingsDrawer';

// Feature flag: true = use ArrayInsertionWheel, false = use LegendList
const USE_INSERTION_WHEEL = true;

interface UIAsset {
  id: string;
  name: string;
  created_at: string;
  order_index: number;
  source: 'local' | 'synced' | 'cloud';
  segmentCount: number;
  duration?: number; // Total duration in milliseconds
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
  const { currentQuestId, currentProjectId } = navigation;
  const { currentUser } = useAuth();
  const { project: currentProject } = useProjectById(currentProjectId);
  const audioContext = useAudio();
  const insets = useSafeAreaInsets();

  // Recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [isVADLocked, setIsVADLocked] = React.useState(false);

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

  // Track current recording order index
  const currentRecordingOrderRef = React.useRef<number>(0);
  const vadCounterRef = React.useRef<number | null>(null);
  const dbWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  // Track pending asset names to prevent duplicates when recording multiple assets quickly
  const pendingAssetNamesRef = React.useRef<Set<string>>(new Set());

  // Insertion wheel state
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  const wheelRef = React.useRef<ArrayInsertionWheelHandle>(null);

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

  // Track segment counts for each asset (loaded lazily)
  const [assetSegmentCounts, setAssetSegmentCounts] = React.useState<
    Map<string, number>
  >(new Map());

  // Track durations for each asset (loaded lazily)
  const [assetDurations, setAssetDurations] = React.useState<
    Map<string, number>
  >(new Map());

  // Load assets from database
  // Use initialAssets if provided to avoid redundant query and instant render
  const {
    data: rawAssets,
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
        };
        // Get segment count and duration from lazy-loaded maps
        // Default to 1 segment if not loaded yet, undefined for duration (shows loading state)
        const segmentCount = assetSegmentCounts.get(obj.id) ?? 1;
        const duration = assetDurations.get(obj.id); // undefined if not loaded yet

        // DEBUG: Log assets with multiple segments
        if (segmentCount > 1) {
          console.log(
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
          duration
        };
      });

    // DEBUG: Summary of segment counts
    const multiSegmentAssets = result.filter((a) => a.segmentCount > 1);
    if (multiSegmentAssets.length > 0) {
      console.log(
        `📊 Total assets with multiple segments: ${multiSegmentAssets.length}`
      );
    }

    return result;
  }, [rawAssets, assetSegmentCounts, assetDurations]);

  // Track actual content changes to prevent unnecessary re-renders
  // LegendList will only re-render items when this key changes
  // NOTE: Duration is NOT included here to avoid cascading re-renders when durations lazy-load
  // Duration updates will be handled by React.memo in AssetCard (only that card re-renders)
  // INCLUDE: name (for rename), order_index (for reorder), segmentCount (for merge)
  const assetContentKey = React.useMemo(
    () =>
      assets
        .map((a) => `${a.id}:${a.name}:${a.order_index}:${a.segmentCount}`)
        .join('|'),
    [assets]
  );

  // Stable asset list that only updates when content actually changes
  // We intentionally use assetContentKey instead of assets to prevent re-renders
  // when assets array reference changes but content is identical
  const assetsForLegendList = React.useMemo(() => assets, [assetContentKey]);

  // Clamp insertion index when asset count changes
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (USE_INSERTION_WHEEL) {
      const maxIndex = assets.length; // Can insert at 0..N (after last item)
      if (insertionIndex > maxIndex) {
        console.log(
          `📍 Clamping insertion index from ${insertionIndex} to ${maxIndex}`
        );
        setInsertionIndex(maxIndex);
      }
    }
  }, [assets.length, insertionIndex]);

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
      console.log('📜 Auto-scrolling to new asset');

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
  const getAssetAudioUris = React.useCallback(
    async (assetId: string): Promise<string[]> => {
      try {
        // Get audio content links for this asset
        const contentLinks = await system.db
          .select()
          .from(asset_content_link)
          .where(eq(asset_content_link.asset_id, assetId));

        console.log(
          `📀 Found ${contentLinks.length} content link(s) for asset ${assetId.slice(0, 8)}`
        );

        if (contentLinks.length === 0) {
          console.log('No content links found for asset:', assetId);
          return [];
        }

        // Get audio values from content links (can be URIs or attachment IDs)
        const audioValues = contentLinks
          .flatMap((link) => {
            const audioArray = link.audio ?? [];
            console.log(
              `  📎 Content link has ${audioArray.length} audio file(s):`,
              audioArray
            );
            return audioArray;
          })
          .filter((value): value is string => !!value);

        console.log(`📊 Total audio files for asset: ${audioValues.length}`);

        if (audioValues.length === 0) {
          console.log('No audio values found in content links');
          return [];
        }

        // Process each audio value - can be either a local URI or an attachment ID
        const uris: string[] = [];
        for (const audioValue of audioValues) {
          // Check if this is already a local URI (starts with 'local/' or 'file://')
          if (audioValue.startsWith('local/')) {
            // It's a direct local URI from saveAudioLocally()
            // Use getLocalAttachmentUriWithOPFS to construct the full path
            const localUri = getLocalAttachmentUriWithOPFS(audioValue);
            uris.push(localUri);
            console.log('✅ Using direct local URI:', localUri.slice(0, 80));
          } else if (audioValue.startsWith('file://')) {
            // Already a full file URI
            uris.push(audioValue);
            console.log('✅ Using full file URI:', audioValue.slice(0, 80));
          } else {
            // It's an attachment ID - look it up in the attachment queue
            if (!system.permAttachmentQueue) continue;

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
              uris.push(localUri);
              console.log('✅ Found attachment URI:', localUri.slice(0, 60));
            } else {
              console.log(`⚠️ Audio ${audioValue} not downloaded yet`);
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
          console.log('⏸️ Stopping asset:', assetId.slice(0, 8));
          await audioContext.stopCurrentSound();
        } else {
          console.log('▶️ Playing asset:', assetId.slice(0, 8));
          const uris = await getAssetAudioUris(assetId);

          if (uris.length === 0) {
            console.error('❌ No audio URIs found for asset:', assetId);
            return;
          }

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
      }
    },
    [audioContext, getAssetAudioUris]
  );

  // ============================================================================
  // RECORDING HANDLERS
  // ============================================================================

  // Initialize VAD counter when VAD mode activates
  React.useEffect(() => {
    if (isVADLocked && vadCounterRef.current === null) {
      void (async () => {
        const nextOrder = await getNextOrderIndex(currentQuestId!);
        vadCounterRef.current = nextOrder;
        console.log('🎯 VAD counter initialized to:', nextOrder);
      })();
    } else if (!isVADLocked) {
      vadCounterRef.current = null;
    }
  }, [isVADLocked, currentQuestId]);

  // Manual recording handlers
  const handleRecordingStart = React.useCallback(() => {
    if (isRecording) return;
    console.log('🎬 Manual recording start');
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
      console.log(
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
    console.log('🛑 Manual recording stop');
    setIsRecording(false);
  }, []);

  const handleRecordingDiscarded = React.useCallback(() => {
    console.log('🗑️ Recording discarded');
    setIsRecording(false);
  }, []);

  const handleRecordingComplete = React.useCallback(
    async (uri: string, _duration: number, _waveformData: number[]) => {
      const targetOrder = currentRecordingOrderRef.current;

      try {
        console.log('💾 Saving recording | order_index:', targetOrder);

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
        console.log(
          `🏷️ Reserved name: ${assetName} (${isVADLocked ? 'VAD mode' : 'manual mode'}) | order_index: ${targetOrder}, asset count: ${assets.length}, pending: ${pendingAssetNamesRef.current.size}`
        );

        // Save audio file locally
        const localUri = await saveAudioLocally(uri);

        // Queue DB write (serialized to prevent race conditions)
        dbWriteQueueRef.current = dbWriteQueueRef.current
          .then(async () => {
            await saveRecording({
              questId: currentQuestId,
              projectId: currentProjectId,
              targetLanguageId: currentProject.target_language_id,
              userId: currentUser.id,
              orderIndex: targetOrder,
              audioUri: localUri,
              assetName: assetName // Pass the reserved name
            });
            // Release the reserved name after successful save
            pendingAssetNamesRef.current.delete(assetName);
            console.log(
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

        // Invalidate queries to refresh asset list
        if (!isVADLocked) {
          await queryClient.invalidateQueries({
            queryKey: ['assets', 'by-quest', currentQuestId],
            exact: false
          });
        }

        console.log('🏁 Recording saved');
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
      assets
    ]
  );

  // VAD segment handlers
  const handleVADSegmentStart = React.useCallback(() => {
    if (vadCounterRef.current === null) {
      console.error('❌ VAD counter not initialized!');
      return;
    }

    const targetOrder = vadCounterRef.current;
    console.log('🎬 VAD: Segment starting | order_index:', targetOrder);

    currentRecordingOrderRef.current = targetOrder;
    vadCounterRef.current = targetOrder + 1; // Increment for next segment
  }, []);

  const handleVADSegmentComplete = React.useCallback(
    (uri: string) => {
      if (!uri || uri === '') {
        console.log('🗑️ VAD: Segment discarded');
        return;
      }

      console.log('📼 VAD: Segment complete');
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
        console.log(
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
    // Early exit if no assets to load (prevents effect from running constantly)
    const assetsToLoad = assetMetadata.filter(
      (id) => !loadedAssetIdsRef.current.has(id)
    );

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
          console.log('✅ Finished loading all asset metadata');
          return;
        }

        console.log(
          `📊 Loading batch ${Math.floor(startIdx / BATCH_SIZE) + 1}: ${batch.length} assets (${startIdx + 1}-${startIdx + batch.length} of ${assetsToLoad.length})`
        );

        try {
          // Dynamically import Audio only when needed
          const { Audio } = await import('expo-av');

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
              console.log(
                `🔎 Query result for asset ${assetId.slice(0, 8)}:`,
                contentLinks.length,
                'rows found'
              );
              if (contentLinks.length > 0) {
                console.log(
                  `   First row ID: ${contentLinks[0]?.id.slice(0, 8)}, audio count: ${contentLinks[0]?.audio?.length ?? 0}`
                );
                if (contentLinks.length > 1) {
                  console.log(
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
              console.log(
                `🔍 Asset ${assetId.slice(0, 8)} segment count: ${segmentCount} ${segmentCount > 1 ? '✅ MULTI-SEGMENT' : '(single)'}`
              );

              // AUDIO FILES: Extract all audio file references from all segments
              // This flattens the audio arrays from all content_link rows
              const audioValues = contentLinks
                .flatMap((link) => link.audio ?? [])
                .filter((value): value is string => !!value);

              // DEBUG: Log audio values found
              console.log(
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
                    audioUri = getLocalAttachmentUriWithOPFS(audioValue);
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
                console.log(
                  `⏱️ Asset ${assetId.slice(0, 8)} total duration: ${Math.round(totalDuration / 1000)}s`
                );
              } else {
                console.log(
                  `⚠️ Asset ${assetId.slice(0, 8)} has no duration (${audioValues.length} audio files found)`
                );
              }

              loadedAssetIdsRef.current.add(assetId);
            } catch (err) {
              // If query fails for any asset, default to 1 segment
              console.warn(`Failed to load data for asset ${assetId}:`, err);
              newCounts.set(assetId, 1);
              loadedAssetIdsRef.current.add(assetId);
            }
          }

          if (!controller.signal.aborted) {
            if (newCounts.size > 0) {
              // Merge with existing counts
              setAssetSegmentCounts((prev) => {
                const merged = new Map(prev);
                for (const [id, count] of newCounts) {
                  merged.set(id, count);
                }
                return merged;
              });
              console.log(
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
              console.log(
                `✅ Batch loaded durations for ${newDurations.size} asset${newDurations.size > 1 ? 's' : ''}`
              );
            }

            // Schedule next batch with a frame delay to keep UI responsive
            setTimeout(() => {
              void processBatch(startIdx + BATCH_SIZE);
            }, 16); // One frame delay (60fps)
          }
        } catch (error) {
          if (!controller.signal.aborted) {
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
    // Depend on assetIds string (only changes when asset IDs change, not on every render)
    // This prevents the effect from running hundreds of times when array reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetIds]);

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
            source_language_id: c.source_language_id,
            text: c.text || '',
            audio: c.audio,
            download_profiles: [currentUser.id]
          });
        }

        await audioSegmentService.deleteAudioSegment(second.id);

        // Force re-load of segment count for the merged asset
        console.log(
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

    Alert.alert(
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
                      source_language_id: c.source_language_id,
                      text: c.text || '',
                      audio: c.audio,
                      download_profiles: [currentUser.id]
                    });
                  }

                  await audioSegmentService.deleteAudioSegment(src.id);
                }

                // Force re-load of segment count for the merged target asset
                console.log(
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

                console.log('✅ Batch merge completed');
              } catch (e) {
                console.error('Failed to batch merge local assets', e);
                Alert.alert(
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

    Alert.alert(
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

                console.log(
                  `✅ Batch delete completed: ${selectedOrdered.length} assets`
                );
              } catch (e) {
                console.error('Failed to batch delete local assets', e);
                Alert.alert(
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

        console.log('✅ Asset renamed successfully');
      } catch (error) {
        console.error('❌ Failed to rename asset:', error);
        if (error instanceof Error) {
          console.warn('⚠️ Rename blocked:', error.message);
          Alert.alert('Error', error.message);
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
      const isThisAssetPlaying =
        audioContext.isPlaying && audioContext.currentAudioId === item.id;
      const isSelected = selectedAssetIds.has(item.id);
      const canMergeDown =
        index < assets.length - 1 && assets[index + 1]?.source !== 'cloud';

      // Duration from lazy-loaded metadata
      const duration = item.duration;

      return (
        <AssetCard
          asset={item}
          index={index}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
          isPlaying={isThisAssetPlaying}
          duration={duration}
          canMergeDown={canMergeDown}
          segmentCount={item.segmentCount}
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
      // audioContext.position REMOVED - uses SharedValues now!
      // audioContext.duration REMOVED - not needed for render
      selectedAssetIds,
      isSelectionMode,
      assets,
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
    return assetsForLegendList.map((item, index) => {
      const isThisAssetPlaying =
        audioContext.isPlaying && audioContext.currentAudioId === item.id;
      const isSelected = selectedAssetIds.has(item.id);
      const canMergeDown =
        index < assetsForLegendList.length - 1 &&
        assetsForLegendList[index + 1]?.source !== 'cloud';

      // Duration from lazy-loaded metadata
      const duration = item.duration;

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
    });
  }, [
    assetsForLegendList,
    audioContext.isPlaying,
    audioContext.currentAudioId,
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
      </View>

      {/* Scrollable list area - full height with padding for controls */}
      <View className="h-full flex-1 p-2">
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
            onChange={setInsertionIndex}
            rowHeight={ROW_HEIGHT}
            className="h-full flex-1"
            bottomInset={footerHeight}
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
            isVADLocked={isVADLocked}
            onVADLockChange={setIsVADLocked}
            onSettingsPress={() => setShowVADSettings(true)}
            currentEnergy={currentEnergy}
            vadThreshold={vadThreshold}
            energyShared={energyShared}
            isRecordingShared={isRecordingShared}
            displayMode={vadDisplayMode}
          />
        )}
      </View>

      {/* Rename modal */}
      <RenameAssetModal
        isVisible={showRenameModal}
        currentName={renameAssetName}
        onClose={() => setShowRenameModal(false)}
        onSave={handleSaveRename}
      />

      {/* VAD Settings Drawer */}
      <VADSettingsDrawer
        isOpen={showVADSettings}
        onOpenChange={setShowVADSettings}
        threshold={vadThreshold}
        onThresholdChange={setVadThreshold}
        silenceDuration={vadSilenceDuration}
        onSilenceDurationChange={setVadSilenceDuration}
        isVADLocked={isVADLocked}
        displayMode={vadDisplayMode}
        onDisplayModeChange={setVadDisplayMode}
      />
    </View>
  );
};

export default RecordingViewSimplified;
