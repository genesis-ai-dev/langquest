/**
 * RecordingView - Audio recording with visual insertion point
 *
 * Main orchestrator - delegates to hooks and components
 */

import type { ArrayInsertionListHandle } from '@/components/ArrayInsertionList';
import ArrayInsertionList from '@/components/ArrayInsertionList';
import type { ArrayInsertionWheelHandle } from '@/components/ArrayInsertionWheel';
import ArrayInsertionWheel from '@/components/ArrayInsertionWheel';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { resolveTable, toMergeCompilableQuery } from '@/utils/dbUtils';
import { useQueryClient } from '@tanstack/react-query';
import { eq, sql } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Animated, View } from 'react-native';
import uuid from 'react-native-uuid';
import { useHybridData } from '../useHybridData';
import { AssetCard } from './components/AssetCard';
import { PendingCard } from './components/PendingCard';
import { RecordingControls } from './components/RecordingControls';
import { SegmentCard } from './components/SegmentCard';
import { SelectionControls } from './components/SelectionControls';
import { VerseSegmentModal } from './components/VerseSegmentModal';
import type { OptimisticAsset } from './hooks/useOptimisticAssets';
import { useOptimisticAssets } from './hooks/useOptimisticAssets';
import { useRecordingState } from './hooks/useRecordingState';
import { useSelectionMode } from './hooks/useSelectionMode';

interface RecordingViewProps {
  onBack: () => void;
}

export default function RecordingView({ onBack }: RecordingViewProps) {
  const queryClient = useQueryClient();
  const navigation = useCurrentNavigation();
  const { currentUser } = useAuth();
  const { project: currentProject } = useProjectById(
    navigation.currentProjectId
  );
  const audioContext = useAudio();

  // Segment modal (for assets with multiple segments)
  const [showSegmentModal, setShowSegmentModal] = React.useState(false);
  const [modalAssetId, setModalAssetId] = React.useState<string | null>(null);
  const [modalAssetName, setModalAssetName] = React.useState<string>('');
  const {
    playSound,
    playSoundSequence,
    stopCurrentSound,
    isPlaying,
    currentAudioId,
    position,
    duration
  } = audioContext;
  const { t } = useLocalization();

  // Early return if navigation context isn't ready
  if (!navigation.currentQuestId || !navigation.currentProjectId) {
    return (
      <View className="flex-1 bg-background">
        <Text className="p-4 text-center text-muted-foreground">
          Loading...
        </Text>
      </View>
    );
  }

  const { currentQuestId, currentProjectId } = navigation;

  // Hooks for feature modules
  const {
    isRecording,
    pendingSegments,
    pendingAnimsRef,
    startRecording,
    stopRecording,
    removePending
  } = useRecordingState();

  const {
    isSelectionMode,
    selectedAssetIds,
    enterSelection,
    toggleSelect,
    cancelSelection
  } = useSelectionMode();

  // Load existing assets - using raw SQL that will be auto-merged by useHybridData
  const { data: rawAssets } = useHybridData({
    dataType: 'assets',
    queryKeyParams: [currentQuestId],
    offlineQuery: `
      SELECT a.*, qal.quest_id
      FROM (
        SELECT *, 'synced' as source FROM asset
        UNION
        SELECT *, 'local' as source FROM asset_local
      ) a
      INNER JOIN (
        SELECT * FROM quest_asset_link
        UNION
        SELECT * FROM quest_asset_link_local
      ) qal ON a.id = qal.asset_id
      WHERE qal.quest_id = '${currentQuestId}'
      ORDER BY a.order_index ASC, a.created_at ASC
    `,
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select('asset:asset_id(*)')
        .eq('quest_id', currentQuestId);
      if (error) throw error;

      // Extract assets from join result
      interface QuestAssetJoin {
        asset: unknown;
      }
      return ((data as QuestAssetJoin[]) || [])
        .map((d) => d.asset)
        .filter(Boolean);
    },
    enableOfflineQuery: true,
    enableCloudQuery: true,
    getItemId: (item) => (item as unknown as { id: string }).id
  });

  // Assets come directly from the query (no nested structure)
  const { optimisticAssets, addOptimistic, removeOptimistic } =
    useOptimisticAssets(rawAssets);

  // Merge and sort assets
  const assets = React.useMemo(() => {
    interface UIAsset {
      id: string;
      name: string;
      created_at?: string;
      order_index?: number;
      source?: string;
    }

    const valid = rawAssets.filter((a) => {
      const obj = a as { id?: string; name?: string } | null | undefined;
      return obj?.id && obj.name;
    }) as UIAsset[];

    const combined = [...valid, ...optimisticAssets];

    return combined.sort((a, b) => {
      if (
        typeof a.order_index === 'number' &&
        typeof b.order_index === 'number' &&
        a.order_index !== b.order_index
      ) {
        return a.order_index - b.order_index;
      }
      const ad = a.created_at ? String(a.created_at) : '';
      const bd = b.created_at ? String(b.created_at) : '';
      if (ad !== bd) return ad.localeCompare(bd);
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }, [rawAssets, optimisticAssets]);

  // Insertion tracking - start at end of list by default
  const [insertionIndex, setInsertionIndex] = React.useState(() =>
    Math.max(0, assets.length)
  );
  const currentRecordingOrderRef = React.useRef<number>(0);
  const currentRecordingTempIdRef = React.useRef<string | null>(null);

  type InsertionHandle = ArrayInsertionListHandle | ArrayInsertionWheelHandle;
  const listRef = React.useRef<InsertionHandle>(null);

  const setWheelRef = React.useCallback(
    (inst: ArrayInsertionWheelHandle | null) => {
      listRef.current = inst || null;
    },
    []
  );

  const setListRef = React.useCallback(
    (inst: ArrayInsertionListHandle | null) => {
      listRef.current = inst || null;
    },
    []
  );

  const [footerHeight, setFooterHeight] = React.useState(0);
  const ROW_HEIGHT = 84;
  const isWheel = true; //process.env.EXPO_PUBLIC_USE_NATIVE_WHEEL === '1';

  // Animated spacer for insertion point
  const spacerHeight = React.useRef(new Animated.Value(6)).current;
  const spacerPulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(spacerPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true
        }),
        Animated.timing(spacerPulse, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [spacerPulse]);

  // Reset audio playback on mount only
  React.useEffect(() => {
    void stopCurrentSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Keep insertionIndex in valid range and optionally stick to end
  const prevAssetsLengthRef = React.useRef(assets.length);
  React.useEffect(() => {
    const prevLength = prevAssetsLengthRef.current;
    const newLength = assets.length;

    // Update ref for next time
    prevAssetsLengthRef.current = newLength;

    // Case 1: List grew and we were at the old end -> move to new end
    if (newLength > prevLength && insertionIndex === prevLength) {
      setInsertionIndex(newLength);
    }
    // Case 2: insertionIndex is beyond valid range -> clamp it
    else if (insertionIndex > newLength) {
      setInsertionIndex(newLength);
    }
  }, [assets.length, insertionIndex]);

  const handleInsertionChange = React.useCallback((newIndex: number) => {
    setInsertionIndex(newIndex);
  }, []);

  // Auto-scroll to currently playing asset (disabled - was for Play All feature)
  // TODO: Re-enable when Play All is working properly
  // const lastScrolledAssetRef = React.useRef<string | null>(null);
  // React.useEffect(() => {
  //   if (!currentAudioId) {
  //     lastScrolledAssetRef.current = null;
  //     return;
  //   }
  //   if (!isPlaying) return;
  //   if (lastScrolledAssetRef.current === currentAudioId) return;
  //   const assetIndex = assets.findIndex((a) => a.id === currentAudioId);
  //   if (assetIndex >= 0) {
  //     listRef.current?.scrollItemToTop(assetIndex, true);
  //     lastScrolledAssetRef.current = currentAudioId;
  //   }
  // }, [currentAudioId, assets, isPlaying]);

  // Cleanup stuck pending cards after timeout
  React.useEffect(() => {
    if (pendingSegments.length === 0) return;

    // If a pending card has been in 'saving' state for >10 seconds, clean it up
    const STUCK_TIMEOUT = 10000;
    const now = Date.now();

    const timer = setTimeout(() => {
      pendingSegments.forEach((p) => {
        const age = now - p.createdAt;
        if (p.status === 'saving' && age > STUCK_TIMEOUT) {
          console.warn(
            '⚠️ Cleaning up stuck pending card:',
            p.tempId,
            'age:',
            age
          );
          removePending(p.tempId);
        }
      });
    }, STUCK_TIMEOUT);

    return () => clearTimeout(timer);
  }, [pendingSegments, removePending]);

  // Recording lifecycle
  const handleRecordingStart = React.useCallback(() => {
    console.log('🎬 handleRecordingStart - insertionIndex:', insertionIndex);

    // Clean up any stuck pending cards from previous recordings
    if (currentRecordingTempIdRef.current) {
      console.log(
        '🧹 Cleaning up previous pending card:',
        currentRecordingTempIdRef.current
      );
      removePending(currentRecordingTempIdRef.current);
    }

    // The new item will get order_index = insertionIndex (not +1)
    const targetOrder = insertionIndex;
    const tempId = startRecording(insertionIndex);

    console.log(
      '📝 Created pending card:',
      tempId,
      'will insert at order_index:',
      targetOrder
    );

    // Store for use in handleRecordingComplete
    currentRecordingOrderRef.current = targetOrder;
    currentRecordingTempIdRef.current = tempId;

    // Scroll to show the pending card (but don't advance insertionIndex yet)
    listRef.current?.scrollToInsertionIndex(insertionIndex, true);

    // Briefly expand spacer
    try {
      Animated.sequence([
        Animated.timing(spacerHeight, {
          toValue: 12,
          duration: 120,
          useNativeDriver: false
        }),
        Animated.timing(spacerHeight, {
          toValue: 6,
          duration: 160,
          useNativeDriver: false
        })
      ]).start();
    } catch {
      // ignore animation errors
    }

    return tempId;
  }, [insertionIndex, startRecording, removePending, spacerHeight]);

  const handleRecordingStop = React.useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleRecordingComplete = React.useCallback(
    async (uri: string, _duration: number, _waveformData: number[]) => {
      const newId = uuid.v4();
      const targetOrder = currentRecordingOrderRef.current;

      try {
        console.log('💾 Starting to save recording...');
        console.log(`📍 Inserting at order_index ${targetOrder}`);

        if (
          !currentProjectId ||
          !currentQuestId ||
          !currentProject ||
          !currentUser
        ) {
          console.error('❌ Missing required data');

          // Clean up pending card on error
          const pendingTempId = currentRecordingTempIdRef.current;
          if (pendingTempId) {
            removePending(pendingTempId);
            currentRecordingTempIdRef.current = null;
          }
          return;
        }

        // 1. Add optimistic asset immediately
        const tempId = uuid.v4() + '_optimistic';
        const optimisticAsset: OptimisticAsset = {
          id: newId,
          name: `Segment ${targetOrder}`,
          order_index: targetOrder,
          source: 'optimistic',
          created_at: new Date().toISOString(),
          tempId
        };

        addOptimistic(optimisticAsset);

        // 2. Remove pending card after a small delay to ensure it was visible
        // This gives React time to render the pending card before removing it
        const pendingTempId = currentRecordingTempIdRef.current;
        setTimeout(() => {
          if (pendingTempId) {
            console.log('🧹 Removing pending card:', pendingTempId);
            removePending(pendingTempId);
            currentRecordingTempIdRef.current = null; // Clear it
          } else {
            console.warn(
              '⚠️ No pending tempId found, cleaning all pending cards'
            );
            removePending(null); // Fallback: remove all recording/saving cards
          }
        }, 100); // Small delay ensures UI renders the pending card

        // 3. Save to database in background
        if (!newId) {
          console.error('❌ newId is null in unstructured mode');
          return;
        }

        const attachmentRecord =
          await system.permAttachmentQueue?.saveAudio(uri);

        await system.db.transaction(async (tx) => {
          const linkLocal = resolveTable('quest_asset_link', {
            localOverride: true
          });
          const assetLocal = resolveTable('asset', { localOverride: true });

          const idsInQuest = tx
            .select({ asset_id: linkLocal.asset_id })
            .from(linkLocal)
            .where(eq(linkLocal.quest_id, currentQuestId));

          await tx.run(
            sql`UPDATE ${assetLocal} SET order_index = order_index + 1 WHERE ${assetLocal.id} IN (${idsInQuest}) AND ${assetLocal.order_index} >= ${targetOrder}`
          );

          const [newAsset] = await tx
            .insert(assetLocal)
            .values({
              name: optimisticAsset.name,
              id: newId,
              order_index: targetOrder,
              source_language_id: currentProject.target_language_id,
              creator_id: currentUser.id,
              download_profiles: [currentUser.id]
            })
            .returning();

          if (!newAsset) throw new Error('Failed to insert asset');

          await tx.insert(linkLocal).values({
            id: `${currentQuestId}_${newAsset.id}`,
            quest_id: currentQuestId,
            asset_id: newAsset.id,
            download_profiles: [currentUser.id]
          });

          await tx
            .insert(resolveTable('asset_content_link', { localOverride: true }))
            .values({
              asset_id: newAsset.id,
              source_language_id: currentProject.target_language_id,
              text: optimisticAsset.name,
              audio_id: attachmentRecord?.id ?? newId,
              download_profiles: [currentUser.id]
            });
        });

        console.log(
          '✅ Asset saved to database:',
          newId,
          'at order_index:',
          targetOrder
        );

        // 5. Remove optimistic asset
        removeOptimistic(newId);

        // 6. Advance insertion index (now that save is successful)
        const newInsertionIndex = targetOrder + 1;
        setInsertionIndex(newInsertionIndex);
        console.log(`📍 Advanced insertion index to ${newInsertionIndex}`);

        // 7. Invalidate queries
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'infinite', currentQuestId, ''],
          exact: false
        });

        console.log('✅ Queries invalidated, asset should appear now');
      } catch (error) {
        console.error('❌ Failed to save recording:', error);

        // On error: remove optimistic asset (only in unstructured mode)
        if (newId) {
          removeOptimistic(newId);
        }

        // Clean up stuck pending card if it exists
        const pendingTempId = currentRecordingTempIdRef.current;
        if (pendingTempId) {
          removePending(pendingTempId);
          currentRecordingTempIdRef.current = null;
        }
      }
    },
    [
      currentProjectId,
      currentQuestId,
      currentProject,
      currentUser,
      addOptimistic,
      removePending,
      removeOptimistic,
      queryClient
    ]
  );

  // Audio playback
  const getAssetAudioUris = React.useCallback(
    async (assetId: string): Promise<string[]> => {
      try {
        // Query both local and synced asset_content_link tables
        const query = `
          SELECT id, asset_id, audio_id, source_language_id
          FROM (
            SELECT * FROM asset_content_link
            UNION
            SELECT * FROM asset_content_link_local
          )
          WHERE asset_id = '${assetId}'
          ORDER BY created_at ASC
        `;

        const result = await system.powersync.execute(query);
        const uris: string[] = [];

        if (system.permAttachmentQueue && result.rows) {
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            if (row?.audio_id) {
              const attachment = await system.powersync.getOptional<{
                id: string;
                local_uri: string | null;
                filename: string | null;
              }>(
                `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`,
                [row.audio_id]
              );

              if (attachment?.local_uri) {
                const uri = system.permAttachmentQueue.getLocalUri(
                  attachment.local_uri
                );
                if (uri) {
                  uris.push(uri);
                }
              }
            }
          }
        }

        console.log(
          `📎 Retrieved ${uris.length} URI(s) for asset ${assetId.slice(0, 8)}`
        );
        return uris;
      } catch (e) {
        console.error('Failed to get audio URIs for asset', e);
        return [];
      }
    },
    []
  );

  const handlePlayAsset = React.useCallback(
    async (assetId: string) => {
      try {
        const isThisAssetPlaying = isPlaying && currentAudioId === assetId;

        if (isThisAssetPlaying) {
          console.log('⏸️ Stopping asset:', assetId.slice(0, 8));
          await stopCurrentSound();
        } else {
          const uris = await getAssetAudioUris(assetId);
          console.log(
            `🔊 Asset ${assetId.slice(0, 8)} has ${uris.length} segment(s)`
          );

          if (uris.length === 0) {
            console.error('❌ No audio URIs found for asset:', assetId);
            return;
          }

          if (uris.length === 1 && uris[0]) {
            console.log(
              '▶️ Playing single segment, URI:',
              uris[0].slice(0, 60)
            );
            await playSound(uris[0], assetId);
            console.log('✅ playSound call completed');
          } else if (uris.length > 1) {
            console.log(`▶️ Playing ${uris.length} segments in sequence`);
            console.log('First URI:', uris[0]?.slice(0, 60));
            // Play all audio segments in sequence for merged assets
            await audioContext.playSoundSequence(uris, assetId);
            console.log('✅ playSoundSequence call completed');
          }
        }
      } catch (error) {
        console.error('❌ Failed to play audio:', error);
      }
    },
    [
      isPlaying,
      currentAudioId,
      playSound,
      playSoundSequence,
      stopCurrentSound,
      getAssetAudioUris,
      audioContext
    ]
  );

  const handlePlayAll = React.useCallback(async () => {
    try {
      if (isPlaying) {
        await stopCurrentSound();
        return;
      }

      console.log('🔊 Starting Play All...');

      const playableAssets = assets.filter((a) => a.source !== 'optimistic');

      if (playableAssets.length === 0) {
        console.error('No audio found to play');
        return;
      }

      // Collect all clips with asset IDs
      const playlist: { uri: string; assetId: string }[] = [];

      for (const asset of playableAssets) {
        const uris = await getAssetAudioUris(asset.id);
        for (const uri of uris) {
          playlist.push({ uri, assetId: asset.id });
        }
      }

      console.log(
        `🔊 Playing ${playlist.length} clips from ${playableAssets.length} assets`
      );

      // Play each clip, waiting for completion
      for (let i = 0; i < playlist.length; i++) {
        const { uri, assetId } = playlist[i]!;

        try {
          console.log(`🔊 [${i + 1}/${playlist.length}] Starting clip`);

          // Step 1: Start playback
          await playSound(uri, assetId);

          // Step 2: Wait for sound to load and begin playing
          await new Promise((r) => setTimeout(r, 200));

          // Step 3: Wait for playback to complete
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              if (!audioContext.isPlaying) {
                clearInterval(checkInterval);
                console.log(`✅ [${i + 1}/${playlist.length}] Done`);
                resolve();
              }
            }, 100);

            // Safety timeout
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 120000);
          });

          // Step 4: Pause before next clip
          await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
          console.error(`❌ Error playing clip ${i + 1}:`, err);
          // Continue to next clip even on error
          await stopCurrentSound();
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      console.log('✅ All playback complete');
    } catch (error) {
      console.error('Failed to play all:', error);
    }
  }, [
    isPlaying,
    assets,
    stopCurrentSound,
    getAssetAudioUris,
    playSound,
    audioContext
  ]);

  // Track segment counts and data for each asset
  const [assetSegmentCounts, setAssetSegmentCounts] = React.useState<
    Map<string, number>
  >(new Map());

  const [assetSegments, setAssetSegments] = React.useState<
    Map<string, { id: string; audio_id: string | null }[]>
  >(new Map());

  // Load segments for all assets (from both local and synced tables)
  React.useEffect(() => {
    const loadSegments = async () => {
      const counts = new Map<string, number>();
      const segments = new Map<
        string,
        { id: string; audio_id: string | null }[]
      >();

      for (const asset of assets) {
        if (asset.source === 'optimistic') {
          counts.set(asset.id, 1);
          continue;
        }

        // Use toMergeCompilableQuery to build a safe, composable query
        const queryInput = {
          sql: `
            SELECT id, asset_id, audio_id, text, source_language_id
            FROM (
              SELECT *, 'synced' as source FROM asset_content_link
              UNION
              SELECT *, 'local' as source FROM asset_content_link_local
            )
            WHERE asset_id = ?
            ORDER BY created_at ASC
          `,
          parameters: [asset.id]
        };

        // Use the util to get a compilable query
        const compilableQuery = toMergeCompilableQuery(queryInput);

        let result: any;
        try {
          result = await system.powersync.execute(
            compilableQuery.compile().sql,
            compilableQuery.compile().parameters
          );
        } catch (err) {
          console.error('Failed to load segments for asset', asset.id, err);
          counts.set(asset.id, 0);
          continue;
        }

        const contents: { id: string; audio_id: string | null }[] = [];

        if (result?.rows) {
          for (let i = 0; i < result.rows.length; i++) {
            // Defensive: result.rows.item may be any
            const row: unknown = result.rows.item(i);
            if (
              row &&
              typeof row === 'object' &&
              'id' in row &&
              'audio_id' in row
            ) {
              contents.push({
                id: (row as { id: string }).id,
                audio_id: (row as { audio_id: string | null }).audio_id
              });
            }
          }
        }

        counts.set(asset.id, contents.length);

        // Store full segment data for assets with multiple segments
        if (contents.length > 1) {
          segments.set(asset.id, contents);
        }
      }

      setAssetSegmentCounts(counts);
      setAssetSegments(segments);
    };

    if (assets.length > 0) {
      void loadSegments();
    }
  }, [assets]);

  // Calculate progress percentage for current playing asset
  const playbackProgress = React.useMemo(() => {
    if (!isPlaying || !currentAudioId) return 0;
    if (duration === 0) return 0;

    // Calculate and ensure it reaches 100% at the end
    const raw = (position / duration) * 100;

    // If we're within 50ms of the end, snap to 100%
    if (duration - position < 50) return 100;

    return Math.min(100, Math.max(0, raw));
  }, [isPlaying, currentAudioId, position, duration]);

  // Handle edit button - opens segment management modal
  const handleEditSegments = React.useCallback(
    (assetId: string, assetName: string) => {
      setModalAssetId(assetId);
      setModalAssetName(assetName);
      setShowSegmentModal(true);
    },
    []
  );

  // Delete segment
  const handleDeleteSegment = React.useCallback(
    async (segmentId: string) => {
      try {
        await system.db
          .delete(resolveTable('asset_content_link', { localOverride: true }))
          .where(
            eq(
              resolveTable('asset_content_link', { localOverride: true }).id,
              segmentId
            )
          );

        console.log('✅ Segment deleted');

        // Invalidate queries
        await queryClient.invalidateQueries({
          queryKey: ['assets'],
          exact: false
        });
      } catch (error) {
        console.error('Failed to delete segment:', error);
      }
    },
    [queryClient]
  );

  // Get segment URI from attachment queue (checks both local and synced)
  const getSegmentUri = React.useCallback(
    async (audioId: string | null): Promise<string | null> => {
      if (!audioId || !system.permAttachmentQueue) return null;

      try {
        const attachment = await system.powersync.getOptional<{
          id: string;
          local_uri: string | null;
        }>(`SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`, [
          audioId
        ]);

        if (!attachment?.local_uri) {
          console.warn('⚠️ No local_uri found for audio_id:', audioId);
          return null;
        }

        const uri = system.permAttachmentQueue.getLocalUri(
          attachment.local_uri
        );
        console.log(
          '📎 Got segment URI:',
          uri ? 'success' : 'failed',
          'for',
          audioId.slice(0, 8)
        );
        return uri;
      } catch (error) {
        console.error('Failed to get segment URI:', error);
        return null;
      }
    },
    []
  );

  // Play segment
  const handlePlaySegment = React.useCallback(
    async (uri: string, segmentId: string) => {
      try {
        console.log(
          '🔊 Playing segment:',
          segmentId.slice(0, 8),
          'URI:',
          uri.slice(0, 50)
        );
        const isThisSegmentPlaying = isPlaying && currentAudioId === segmentId;
        if (isThisSegmentPlaying) {
          console.log('⏸️ Stopping currently playing segment');
          await stopCurrentSound();
        } else {
          console.log('▶️ Starting playback...');
          await playSound(uri, segmentId);
          console.log('✅ Playback started');
        }
      } catch (error) {
        console.error('❌ Failed to play segment:', error);
      }
    },
    [isPlaying, currentAudioId, playSound, stopCurrentSound]
  );

  // Mock unmerge
  const handleUnmerge = React.useCallback(() => {
    console.log('🔪 Mock: Unmerge verse');
    // TODO: Implement unmerge logic
    alert('Unmerge functionality - Coming soon!');
  }, []);

  // Asset operations
  const handleDeleteLocalAsset = React.useCallback(
    async (assetId: string) => {
      try {
        await audioSegmentService.deleteAudioSegment(assetId);
        await queryClient.invalidateQueries({
          queryKey: ['assets'],
          exact: false
        });
      } catch (e) {
        console.error('Failed to delete local asset', e);
      }
    },
    [queryClient]
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
          if (!c.audio_id) continue;
          await system.db.insert(contentLocal).values({
            asset_id: first.id,
            source_language_id: c.source_language_id,
            text: c.text || '',
            audio_id: c.audio_id,
            download_profiles: [currentUser.id]
          });
        }

        await audioSegmentService.deleteAudioSegment(second.id);
        await queryClient.invalidateQueries({
          queryKey: ['assets'],
          exact: false
        });
      } catch (e) {
        console.error('Failed to merge local assets', e);
      }
    },
    [assets, currentUser, queryClient]
  );

  const handleBatchMergeSelected = React.useCallback(async () => {
    try {
      const selectedOrdered = assets.filter(
        (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
      );
      if (selectedOrdered.length < 2 || !currentUser) return;

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
          if (!c.audio_id) continue;
          await system.db.insert(contentLocal).values({
            asset_id: target.id,
            source_language_id: c.source_language_id,
            text: c.text || '',
            audio_id: c.audio_id,
            download_profiles: [currentUser.id]
          });
        }

        await audioSegmentService.deleteAudioSegment(src.id);
      }

      cancelSelection();
      await queryClient.invalidateQueries({
        queryKey: ['assets'],
        exact: false
      });
    } catch (e) {
      console.error('Failed to batch merge local assets', e);
    }
  }, [assets, selectedAssetIds, currentUser, cancelSelection, queryClient]);

  // Render content
  const scrollViewContent = React.useMemo(() => {
    const content: React.ReactNode[] = [];

    if (assets.length === 0 && pendingSegments.length === 0) {
      content.push(
        <View key="empty" className="items-center justify-center py-16">
          <Text className="text-center text-muted-foreground">
            No assets yet. Start recording to create your first asset.
          </Text>
        </View>
      );
      return content;
    }

    // Organize pending by placement index
    const pendingByIndex = new Map<number, typeof pendingSegments>();
    const sortedPending = [...pendingSegments].sort((a, b) => {
      if (a.placementIndex !== b.placementIndex) {
        return a.placementIndex - b.placementIndex;
      }
      return a.createdAt - b.createdAt;
    });

    for (const p of sortedPending) {
      const arr = pendingByIndex.get(p.placementIndex) ?? [];
      arr.push(p);
      pendingByIndex.set(p.placementIndex, arr);
    }

    // Debug: log pending state
    if (pendingSegments.length > 0) {
      console.log(
        '🔍 Pending segments:',
        pendingSegments
          .map(
            (p) => `${p.name} at index ${p.placementIndex}, status: ${p.status}`
          )
          .join(', ')
      );
    }

    // Render spacer
    const renderSpacer = (key: string) => {
      if (isWheel) return null;
      const scale = spacerPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.3]
      });
      const opacity = spacerPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 1]
      });
      return (
        <View key={key} className="items-center justify-center">
          <Animated.View
            style={{ height: spacerHeight, width: '100%' }}
            className="items-center justify-center"
          >
            <Animated.View
              style={{ transform: [{ scale }], opacity }}
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
          </Animated.View>
        </View>
      );
    };

    // Render pending cards
    const renderPending = (group: typeof pendingSegments | undefined) => {
      if (!group) return;
      for (const p of group) {
        const anim = pendingAnimsRef.current.get(p.tempId);
        content.push(
          <PendingCard key={p.tempId} pending={p} animation={anim} />
        );
      }
    };

    // Leading spacer
    if (!isWheel && assets.length > 0 && insertionIndex === 0) {
      content.push(renderSpacer('spacer-leading'));
    }

    for (let i = 0; i <= assets.length; i++) {
      // Pending before asset i
      renderPending(pendingByIndex.get(i));

      // Asset at i
      if (i < assets.length) {
        const asset = assets[i]!;
        const isSelected = selectedAssetIds.has(asset.id);
        const isThisPlaying = isPlaying && currentAudioId === asset.id;
        const canMergeDown =
          i < assets.length - 1 && assets[i + 1]?.source !== 'cloud';

        const segmentCount = assetSegmentCounts.get(asset.id);

        content.push(
          <AssetCard
            key={asset.id}
            asset={asset}
            index={i}
            isSelected={isSelected}
            isSelectionMode={isSelectionMode}
            isPlaying={isThisPlaying}
            canMergeDown={canMergeDown}
            progress={isThisPlaying ? playbackProgress : undefined}
            segmentCount={segmentCount}
            onPress={() => (isSelectionMode ? toggleSelect(asset.id) : {})}
            onLongPress={() => enterSelection(asset.id)}
            onPlay={handlePlayAsset}
            onDelete={handleDeleteLocalAsset}
            onMerge={handleMergeDownLocal}
            onEdit={handleEditSegments}
          />
        );

        // Render segments nested below if asset has multiple segments
        const hasMultipleSegments = (segmentCount ?? 0) > 1;
        if (hasMultipleSegments && !isSelectionMode) {
          const segments = assetSegments.get(asset.id) || [];
          for (let segIdx = 0; segIdx < segments.length; segIdx++) {
            const segment = segments[segIdx]!;
            const isSegmentPlaying = isPlaying && currentAudioId === segment.id;

            content.push(
              <SegmentCard
                key={segment.id}
                segment={segment}
                index={segIdx}
                isPlaying={isSegmentPlaying}
                onPlay={async () => {
                  const uri = await getSegmentUri(segment.audio_id);
                  if (uri) {
                    await handlePlaySegment(uri, segment.id);
                  }
                }}
                onDelete={async () => {
                  await handleDeleteSegment(segment.id);
                }}
              />
            );
          }
        }

        // Spacer after active pre-insertion item
        if (!isWheel && i === Math.max(0, insertionIndex - 1)) {
          content.push(renderSpacer(`spacer-${asset.id}`));
        }
      }
    }

    // Render any pending cards beyond the last asset (e.g., "insert at end")
    // Check for pending cards at indices beyond assets.length
    for (let i = assets.length + 1; i <= assets.length + 10; i++) {
      const pending = pendingByIndex.get(i);
      if (pending) {
        renderPending(pending);
      }
    }

    return content;
  }, [
    assets,
    pendingSegments,
    selectedAssetIds,
    isSelectionMode,
    isPlaying,
    currentAudioId,
    insertionIndex,
    isWheel,
    spacerHeight,
    spacerPulse,
    pendingAnimsRef,
    playbackProgress,
    assetSegmentCounts,
    assetSegments,
    toggleSelect,
    enterSelection,
    handlePlayAsset,
    handleDeleteLocalAsset,
    handleMergeDownLocal,
    handleEditSegments,
    handlePlaySegment,
    handleDeleteSegment,
    getSegmentUri
  ]);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center gap-3">
          <Button variant="ghost" size="icon" onPress={onBack}>
            <Icon as={ArrowLeft} />
          </Button>
          <Text className="text-2xl font-bold text-foreground">
            {t('doRecord')}
          </Text>
        </View>
      </View>

      {/* Asset count */}
      <View className="flex-row items-center justify-between px-4 pb-2">
        <Text className="text-xl font-bold text-foreground">
          {t('assets')} ({assets.length})
        </Text>
        {/* Play All temporarily disabled */}
        {/* {assets.length > 0 && !isSelectionMode && (
          <Button
            variant="outline"
            size="sm"
            onPress={handlePlayAll}
            className="flex-row gap-2"
          >
            <Icon as={isPlaying ? Pause : Play} size={16} />
            <Text className="text-sm">{isPlaying ? 'Stop' : 'Play All'}</Text>
          </Button>
        )} */}
      </View>

      {/* Scrollable list */}
      {isWheel ? (
        <ArrayInsertionWheel
          ref={setWheelRef}
          className="flex-1"
          value={insertionIndex}
          onChange={handleInsertionChange}
          rowHeight={ROW_HEIGHT}
          bottomInset={footerHeight}
        >
          {scrollViewContent}
        </ArrayInsertionWheel>
      ) : (
        <ArrayInsertionList
          ref={setListRef}
          className="flex-1"
          value={insertionIndex}
          onChange={handleInsertionChange}
          rowHeight={ROW_HEIGHT}
          bottomInset={footerHeight}
        >
          {scrollViewContent}
        </ArrayInsertionList>
      )}

      {/* Bottom controls */}
      <View className="absolute bottom-0 left-0 right-0">
        {isSelectionMode ? (
          <View className="px-4">
            <SelectionControls
              selectedCount={selectedAssetIds.size}
              onCancel={cancelSelection}
              onMerge={handleBatchMergeSelected}
            />
          </View>
        ) : (
          <RecordingControls
            isRecording={isRecording}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
            onRecordingComplete={handleRecordingComplete}
            onLayout={setFooterHeight}
          />
        )}
      </View>

      {/* Segment management modal */}
      {modalAssetId && (
        <VerseSegmentModal
          isOpen={showSegmentModal}
          onClose={() => setShowSegmentModal(false)}
          assetId={modalAssetId}
          assetName={modalAssetName}
          isMerged={false} // TODO: Detect merged assets
          onPlay={handlePlaySegment}
          onDelete={handleDeleteSegment}
          onUnmerge={handleUnmerge}
          isPlaying={isPlaying}
          currentAudioId={currentAudioId}
        />
      )}
    </View>
  );
}
