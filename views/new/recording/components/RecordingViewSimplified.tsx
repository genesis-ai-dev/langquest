import type { ArrayInsertionWheelHandle } from '@/components/ArrayInsertionWheel';
import ArrayInsertionWheel from '@/components/ArrayInsertionWheel';
import { RecordingHelpDialog } from '@/components/RecordingHelpDialog';
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
import { ArrowLeft, ListVideo, PauseIcon } from 'lucide-react-native';
import React from 'react';
import { InteractionManager, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHybridData } from '../../useHybridData';
import { useSelectionMode } from '../hooks/useSelectionMode';
import { useVADRecording } from '../hooks/useVADRecording';
import { getNextOrderIndex, saveRecording } from '../services/recordingService';
import { AssetCard } from './AssetCard';
import { FullScreenVADOverlay } from './FullScreenVADOverlay';
import { RecordingControls } from './RecordingControls';
import { RenameAssetDrawer } from './RenameAssetDrawer';
import { SelectionControls } from './SelectionControls';
import { TrimSegmentModal } from './TrimSegmentModal';
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

  // New PlayAll state (starts from insertionIndex)
  const [isPlayAllRunning, setIsPlayAllRunning] = React.useState(false);
  const isPlayAllRunningRef = React.useRef(false);
  const currentPlayAllSoundRef = React.useRef<Audio.Sound | null>(null);

  // Ref to hold latest audioContext for cleanup (avoids stale closure)
  const audioContextCurrentRef = React.useRef(audioContext);
  React.useEffect(() => {
    audioContextCurrentRef.current = audioContext;
  }, [audioContext]);

  // Track setTimeout IDs for cleanup
  const timeoutIdsRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );

  // Track AbortController for batch loading cleanup
  const batchLoadingControllerRef = React.useRef<AbortController | null>(null);

  // Single SharedValue for play-all progress (only 1 asset plays at a time)
  const playAllProgress = useSharedValue(0);

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

  const [isTrimModalOpen, setIsTrimModalOpen] = React.useState(false);
  const [trimTargetAssetId, setTrimTargetAssetId] = React.useState<
    string | null
  >(null);

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

  const [assetWaveformData, setAssetWaveformData] = React.useState<
    Map<string, number[]>
  >(new Map());

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
      debugLog(
        `📊 Total assets with multiple segments: ${multiSegmentAssets.length}`
      );
    }

    return result;
  }, [rawAssets, assetSegmentCounts, assetDurations]);

  // Stable asset list that only updates when content actually changes
  // We intentionally use assetContentKey instead of assets to prevent re-renders
  // when assets array reference changes but content is identical
  const assetsForLegendList = React.useMemo(() => assets, [assets]);

  // Clamp insertion index when asset count changes
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (USE_INSERTION_WHEEL) {
      const maxIndex = assets.length; // Can insert at 0..N (after last item)
      if (insertionIndex > maxIndex) {
        debugLog(
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
      debugLog('📜 Auto-scrolling to new asset');

      // Small delay to ensure the new item is rendered before scrolling
      const timeoutId = setTimeout(() => {
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
        timeoutIdsRef.current.delete(timeoutId);
      }, 100);
      timeoutIdsRef.current.add(timeoutId);
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

  // Handle play all - plays all assets sequentially starting from insertionIndex
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

        // Reset progress
        playAllProgress.value = 0;
        setCurrentlyPlayingAssetId(null);
        debugLog('⏸️ Stopped play all');
        return;
      }

      if (assets.length === 0) {
        console.warn('⚠️ No assets to play');
        return;
      }

      // Determine which assets to process starting from insertionIndex
      const startIndex = Math.min(insertionIndex, assets.length - 1);
      const assetsToProcess = assets.slice(startIndex);

      if (assetsToProcess.length === 0) {
        console.warn('⚠️ No assets to play from insertion index');
        return;
      }

      debugLog(
        `🎵 Starting play all from insertion index ${startIndex} (${assetsToProcess.length} assets)...`
      );

      // Mark as running
      isPlayAllRunningRef.current = true;
      setIsPlayAllRunning(true);

      // Build playlist: Array<{assetId, uris}>
      const playlist: { assetId: string; uris: string[] }[] = [];

      for (const asset of assetsToProcess) {
        // Check if cancelled
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isPlayAllRunningRef.current) {
          debugLog('⏸️ Play all cancelled during playlist build');
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

      debugLog(
        `▶️ Playing ${playlist.reduce((sum, p) => sum + p.uris.length, 0)} audio segments from ${playlist.length} assets`
      );

      // Play each asset sequentially
      for (let i = 0; i < playlist.length; i++) {
        // Check if cancelled
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isPlayAllRunningRef.current) {
          debugLog('⏸️ Play all cancelled');
          setCurrentlyPlayingAssetId(null);
          return;
        }

        const item = playlist[i]!;
        const actualAssetIndex = startIndex + i;

        // HIGHLIGHT THIS ASSET
        setCurrentlyPlayingAssetId(item.assetId);

        // Give React a chance to process the state update
        await Promise.resolve();

        // Scroll to this asset in the wheel
        // scrollItemToTop adds 1 internally, so subtract 1 to get correct position
        if (wheelRef.current) {
          wheelRef.current.scrollItemToTop(actualAssetIndex - 1, true);
        }

        debugLog(
          `▶️ [${i + 1}/${playlist.length}] Playing asset at index ${actualAssetIndex} (${item.assetId.slice(0, 8)}, ${item.uris.length} segments)`
        );

        // Reset progress for new asset
        playAllProgress.value = 0;

        // Play all URIs for this asset sequentially
        for (const uri of item.uris) {
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

                  // Update progress for current asset
                  if (status.durationMillis) {
                    playAllProgress.value =
                      (status.positionMillis / status.durationMillis) * 100;
                  }

                  if (status.didJustFinish) {
                    // Mark as complete
                    playAllProgress.value = 100;
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

      // Finished playing all - reset progress
      debugLog('✅ Finished playing all assets');
      playAllProgress.value = 0;
      setCurrentlyPlayingAssetId(null);
      isPlayAllRunningRef.current = false;
      setIsPlayAllRunning(false);
      currentPlayAllSoundRef.current = null;
    } catch (error) {
      console.error('❌ Error playing all assets:', error);
      playAllProgress.value = 0;
      setCurrentlyPlayingAssetId(null);
      isPlayAllRunningRef.current = false;
      setIsPlayAllRunning(false);
      currentPlayAllSoundRef.current = null;
    }
  }, [assets, getAssetAudioUris, insertionIndex, playAllProgress]);

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
    if (isVADActive && vadCounterRef.current === null) {
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
    } else if (!isVADActive) {
      vadCounterRef.current = null;
    }
    // IMPORTANT: Only depend on isVADActive and currentQuestId
    // insertionIndex is read from ref to avoid stale closure issues
    // assets is captured from closure (intentional - we want the state at activation time)
  }, [isVADActive, currentQuestId, assets, insertionIndex]);

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
        const nextNumber = isVADActive
          ? targetOrder + 1 // VAD: use order_index + 1 for naming (order is 0-based, names are 1-based)
          : assets.length + pendingAssetNamesRef.current.size + 1;
        const assetName = String(nextNumber).padStart(3, '0');
        pendingAssetNamesRef.current.add(assetName);
        debugLog(
          `🏷️ Reserved name: ${assetName} (${isVADActive ? 'VAD mode' : 'manual mode'}) | order_index: ${targetOrder}, asset count: ${assets.length}, pending: ${pendingAssetNamesRef.current.size}`
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
            const newAssetId = await saveRecording({
              questId: currentQuestId,
              projectId: currentProjectId,
              targetLanguoidId: targetLanguoidId,
              userId: currentUser.id,
              orderIndex: targetOrder,
              audioUri: localUri,
              assetName: assetName // Pass the reserved name
            });

            setAssetWaveformData((prev) => {
              const next = new Map(prev);
              next.set(newAssetId, _waveformData);
              return next;
            });
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

        // Invalidate queries to refresh asset list
        if (!isVADActive) {
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
      isVADActive,
      assets,
      targetLanguoidId
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
    // Don't increment yet - wait until it's confirmed not to be a transient
  }, []);

  const handleVADSegmentComplete = React.useCallback(
    (uri: string) => {
      if (!uri || uri === '') {
        debugLog('🗑️ VAD: Segment discarded');
        // Do NOT increment counter - the next segment will reuse currentRecordingOrderRef.current
        return;
      }

      debugLog('📼 VAD: Segment complete');
      // Increment counter only for valid segments
      if (vadCounterRef.current !== null) {
        vadCounterRef.current += 1;
      }
      void handleRecordingComplete(uri, 0, []);
    },
    [handleRecordingComplete]
  );

  // Hook up native VAD recording
  const {
    currentEnergy,
    isRecording: isVADRecording,
    energyShared,
    isRecordingShared,
    isDiscardedShared
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

        // CRITICAL: Preserve audio files when merging - they are now linked to the first asset
        await audioSegmentService.deleteAudioSegment(second.id, {
          preserveAudioFiles: true
        });

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
      t('mergeAssets'),
      t('mergeAssetsConfirmation', { count: selectedOrdered.length }),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('merge'),
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

                  // CRITICAL: Preserve audio files when merging - they are now linked to the target asset
                  await audioSegmentService.deleteAudioSegment(src.id, {
                    preserveAudioFiles: true
                  });
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
                RNAlert.alert(t('error'), t('failedToMergeAssets'));
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
      t('deleteAssets'),
      t('deleteAssetsConfirmation', { count: selectedOrdered.length }),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('delete'),
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
                RNAlert.alert(t('error'), t('failedToDeleteAssets'));
              }
            })();
          }
        }
      ]
    );
  }, [assets, selectedAssetIds, cancelSelection, queryClient, currentQuestId]);

  const handleOpenTrimModal = React.useCallback(() => {
    if (selectedAssetIds.size < 1) return;
    const selectedIds = Array.from(selectedAssetIds);
    const firstSelectedId = selectedIds[0];
    if (!firstSelectedId) return;
    if (selectedIds.length > 1) {
      console.warn(
        'Trim modal opened with multiple selected assets; using first selection.'
      );
    }
    setTrimTargetAssetId(firstSelectedId);
    setIsTrimModalOpen(true);
  }, [selectedAssetIds]);

  const handleCloseTrimModal = React.useCallback(() => {
    setIsTrimModalOpen(false);
    setTrimTargetAssetId(null);
  }, []);

  const trimTargetAsset = React.useMemo(() => {
    if (!trimTargetAssetId) return null;
    return assets.find((asset) => asset.id === trimTargetAssetId) ?? null;
  }, [assets, trimTargetAssetId]);

  const trimWaveformData = React.useMemo(() => {
    if (!trimTargetAssetId) return undefined;
    return assetWaveformData.get(trimTargetAssetId);
  }, [assetWaveformData, trimTargetAssetId]);

  const canTrimSelected = React.useMemo(
    () => !!trimWaveformData && trimWaveformData.length > 0,
    [trimWaveformData]
  );

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
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'by-quest', currentQuestId],
          exact: false
        });

        debugLog('✅ Asset renamed successfully');
      } catch (error) {
        console.error('❌ Failed to rename asset:', error);
        if (error instanceof Error) {
          console.warn('⚠️ Rename blocked:', error.message);
          RNAlert.alert(t('error'), error.message);
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
    const assetUriMap = assetUriMapRef.current;
    const segmentDurations = segmentDurationsRef.current;
    const assetSegmentRanges = assetSegmentRangesRef.current;
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
      assetUriMap.clear();
      segmentDurations.length = 0;
      assetSegmentRanges.clear();
      lastScrolledAssetIdRef.current = null;
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

      debugLog('🧹 Cleaned up RecordingViewSimplified on unmount');
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

  // Memoized render function for LegendList
  // OPTIMIZED: No audioContext.position dependency - progress now uses SharedValues!
  // This eliminates 10 re-renders/second during audio playback
  const renderAssetItem = React.useCallback(
    ({ item, index }: { item: UIAsset; index: number }) => {
      // Check if this asset is playing individually OR if it's the currently playing asset during play-all
      const isThisAssetPlayingIndividually =
        audioContext.isPlaying && audioContext.currentAudioId === item.id;
      const isThisAssetPlayingInPlayAll =
        isPlayAllRunning && currentlyPlayingAssetId === item.id;
      const isThisAssetPlaying =
        isThisAssetPlayingIndividually || isThisAssetPlayingInPlayAll;
      const isSelected = selectedAssetIds.has(item.id);
      const canMergeDown =
        index < assets.length - 1 && assets[index + 1]?.source !== 'cloud';

      // Duration from lazy-loaded metadata
      const duration = item.duration;

      // Get custom progress for play-all mode (only for the currently playing asset)
      const customProgress = isThisAssetPlayingInPlayAll
        ? playAllProgress
        : undefined;

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
          customProgress={customProgress}
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
      isPlayAllRunning,
      currentlyPlayingAssetId,
      playAllProgress,
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
      // Check if this asset is playing individually OR if it's the currently playing asset during play-all
      const isThisAssetPlayingIndividually =
        audioContext.isPlaying && audioContext.currentAudioId === item.id;
      const isThisAssetPlayingInPlayAll =
        isPlayAllRunning && currentlyPlayingAssetId === item.id;
      const isThisAssetPlaying =
        isThisAssetPlayingIndividually || isThisAssetPlayingInPlayAll;
      const isSelected = selectedAssetIds.has(item.id);
      const canMergeDown =
        index < assetsForLegendList.length - 1 &&
        assetsForLegendList[index + 1]?.source !== 'cloud';

      // Duration from lazy-loaded metadata
      const duration = item.duration;

      // Get custom progress for play-all mode (only for the currently playing asset)
      const customProgress = isThisAssetPlayingInPlayAll
        ? playAllProgress
        : undefined;

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
          customProgress={customProgress}
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
    isPlayAllRunning,
    currentlyPlayingAssetId,
    playAllProgress,
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
        <Text className="text-muted-foreground">{t('loading')}</Text>
      </View>
    );
  }

  // Render error state
  if (isError && offlineError) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-destructive">{t('errorLoadingAssets')}</Text>
        <Text className="text-xs text-muted-foreground">
          {offlineError.message}
        </Text>
      </View>
    );
  }

  // Show full-screen overlay when VAD is active and display mode is fullscreen
  const showFullScreenOverlay = isVADActive && vadDisplayMode === 'fullscreen';

  return (
    <View className="flex-1 bg-background">
      {/* Full-screen VAD overlay - takes over entire screen */}
      {showFullScreenOverlay && (
        <FullScreenVADOverlay
          isVisible={true}
          energyShared={energyShared}
          vadThreshold={vadThreshold}
          isRecordingShared={isRecordingShared}
          isDiscardedShared={isDiscardedShared}
          onCancel={() => {
            // Cancel VAD mode
            setIsVADActive(false);
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
          <>
            <Button
              variant="ghost"
              size="icon"
              onPress={handlePlayAll}
              className="h-10 w-10"
            >
              <Icon
                as={isPlayAllRunning ? PauseIcon : ListVideo}
                size={24}
                className="text-primary"
              />
            </Button>
          </>
        )}
      </View>

      {/* Scrollable list area - full height with padding for controls */}
      <View className="h-full flex-1 p-2">
        {assets.length === 0 && (
          <View className="items-center justify-center py-16">
            <Text className="text-center text-muted-foreground">
              {t('noAssetsYetStartRecording')}
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
              onTrim={canTrimSelected ? handleOpenTrimModal : undefined}
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
            isDiscardedShared={isDiscardedShared}
            displayMode={vadDisplayMode}
          />
        )}
      </View>

      <TrimSegmentModal
        isOpen={isTrimModalOpen}
        segmentName={trimTargetAsset?.name ?? null}
        waveformData={trimWaveformData}
        onClose={handleCloseTrimModal}
      />

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
        threshold={vadThreshold}
        onThresholdChange={setVadThreshold}
        silenceDuration={vadSilenceDuration}
        onSilenceDurationChange={setVadSilenceDuration}
        minSegmentLength={vadMinSegmentLength}
        onMinSegmentLengthChange={setVadMinSegmentLength}
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

export default RecordingViewSimplified;
