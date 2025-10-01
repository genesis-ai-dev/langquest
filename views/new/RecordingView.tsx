import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import WalkieTalkieRecorder from '@/components/WalkieTalkieRecorder';
// WaveformVisualizer removed for now
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import { system } from '@/db/powersync/system';
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { resolveTable } from '@/utils/dbUtils';
import { useQueryClient } from '@tanstack/react-query';
import { eq, sql } from 'drizzle-orm';
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  GitMerge,
  Loader2,
  Pause,
  Play,
  Trash2
} from 'lucide-react-native';
import React from 'react';
import { Animated, Easing, TouchableOpacity, View } from 'react-native';
import uuid from 'react-native-uuid';
import type { ArrayInsertionListHandle } from '../../components/ArrayInsertionList';
import ArrayInsertionList from '../../components/ArrayInsertionList';
import type { ArrayInsertionWheelHandle } from '../../components/ArrayInsertionWheel';
import ArrayInsertionWheel from '../../components/ArrayInsertionWheel';

interface AudioSegment {
  id: string;
  uri: string;
  duration: number;
  waveformData: number[];
  name: string;
}

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
  const { playSound, stopCurrentSound, isPlaying, currentAudioId } = useAudio();

  const { t } = useLocalization();
  const [isRecording, setIsRecording] = React.useState(false);
  // Waveform state removed
  const [_playingSegmentId, setPlayingSegmentId] = React.useState<
    string | null
  >(null);
  // Removed waveform cache

  // Simple insertion index tracking (controlled for wheel picker)
  const [insertionIndex, setInsertionIndex] = React.useState(0);
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
  const ROW_HEIGHT = 84; // fixed height to align with wheel snapping
  const didInitScrollRef = React.useRef(false);
  const isWheel = process.env.EXPO_PUBLIC_USE_NATIVE_WHEEL === '1';

  type PendingStatus = 'recording' | 'saving' | 'ready' | 'error';
  interface PendingSegment {
    tempId: string;
    id?: string; // final asset id when known
    name: string;
    status: PendingStatus;
    // waveform removed
    placementIndex: number; // insertion boundary at creation
    duration?: number;
    uri?: string;
    createdAt: number;
  }
  const [pendingSegments, setPendingSegments] = React.useState<
    PendingSegment[]
  >([]);

  // Optimistic assets: assets that appear instantly while saving in background
  interface OptimisticAsset {
    id: string;
    name: string;
    order_index: number;
    source: 'optimistic';
    created_at: string;
    tempId: string; // Link back to pending segment
  }
  const [optimisticAssets, setOptimisticAssets] = React.useState<
    OptimisticAsset[]
  >([]);

  // Animated spacer for insertion point (height + pulsing dot)
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
    return () => {
      loop.stop();
    };
  }, [spacerPulse]);

  // Animation refs for pending slide-in
  const pendingAnimsRef = React.useRef(
    new Map<string, { opacity: Animated.Value; translateY: Animated.Value }>()
  );

  // WhatsApp-like selection mode for batch merge
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(
    new Set()
  );
  const enterSelection = React.useCallback((assetId: string) => {
    setIsSelectionMode(true);
    setSelectedAssetIds(new Set([assetId]));
  }, []);
  const toggleSelect = React.useCallback((assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);
  const cancelSelection = React.useCallback(() => {
    setIsSelectionMode(false);
    setSelectedAssetIds(new Set());
  }, []);

  // Load existing assets for the quest (local + cloud)
  const { data } = useAssetsByQuest(currentQuestId, '', false);
  const assets = React.useMemo(() => {
    interface UIAsset {
      id: string;
      name: string;
      created_at?: string;
      order_index?: number;
      source?: string;
    }
    const pages = Array.isArray(
      (data as { pages?: { data: unknown[] }[] } | undefined)?.pages
    )
      ? (data as { pages: { data: unknown[] }[] }).pages
      : [];
    const all = pages.flatMap((p) => p.data);
    const valid = all.filter((a) => {
      const obj = a as { id?: string; name?: string } | null | undefined;
      if (!obj) return false;
      return !!obj.id && !!obj.name;
    }) as UIAsset[];

    // Merge optimistic assets with real assets
    // Remove any optimistic assets that now exist in real data
    const realIds = new Set(valid.map((a) => a.id));
    const activeOptimistic = optimisticAssets.filter(
      (opt) => !realIds.has(opt.id)
    );

    // Combine and sort by order_index
    const combined = [...valid, ...activeOptimistic];

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
  }, [data, optimisticAssets]);

  // Handle insertion index changes from the scroll view
  const handleInsertionChange = React.useCallback((newIndex: number) => {
    setInsertionIndex(newIndex);
  }, []);

  // On first load, start at bottom (insert after last item)
  React.useEffect(() => {
    if (didInitScrollRef.current) return;
    didInitScrollRef.current = true;
    const last = Math.max(0, assets.length);
    setInsertionIndex(last);
    listRef.current?.scrollToInsertionIndex(last, false);
  }, [assets.length]);

  // Track the actual order index for the current recording
  const currentRecordingOrderRef = React.useRef<number>(0);

  const handleRecordingStart = React.useCallback(() => {
    setIsRecording(true);
    // waveform reset removed
    // Create optimistic pending card immediately
    const tempId = uuid.v4() + '_temp';
    // In wheel mode the overlay highlights an item; insert AFTER that item
    const targetOrder = insertionIndex + 1;

    // Store the target order for use in handleRecordingComplete
    currentRecordingOrderRef.current = targetOrder;

    // Insert pending, capturing intended placement index
    setPendingSegments((prev) => [
      ...prev,
      {
        tempId,
        name: `Segment ${targetOrder}`,
        status: 'recording' as const,
        placementIndex: targetOrder,
        createdAt: Date.now()
      }
    ]);

    // Slide-in animation for the new pending card
    try {
      if (!pendingAnimsRef.current.has(tempId)) {
        const anims = {
          opacity: new Animated.Value(0),
          translateY: new Animated.Value(12)
        };
        pendingAnimsRef.current.set(tempId, anims);
        Animated.parallel([
          Animated.timing(anims.opacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(anims.translateY, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]).start();
      }
    } catch {
      // Animation setup failed, continue without animation
    }

    // Advance insertion boundary to AFTER the new recording
    // This way the next recording goes after this one, not in the same spot
    const nextInsertion = targetOrder;
    setInsertionIndex(nextInsertion);

    // Scroll to show the new recording position
    listRef.current?.scrollToInsertionIndex(nextInsertion, true);

    // Briefly expand spacer to emphasize insertion point
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
  }, [insertionIndex]);

  const handleRecordingStop = React.useCallback(() => {
    setIsRecording(false);
    // waveform reset removed
    // Freeze most recent recording card into saving state
    setPendingSegments((prev) => {
      const next = [...prev];
      const idx = next.findIndex((p) => p.status === 'recording');
      if (idx !== -1) {
        const existing = next[idx];
        if (!existing) return next;
        next[idx] = { ...existing, status: 'saving' };
      }
      return next;
    });
  }, []);

  // Waveform updates disabled
  const _handleWaveformUpdate = undefined;

  const handleRecordingComplete = React.useCallback(
    async (uri: string, duration: number, _waveformData: number[]) => {
      try {
        console.log('💾 Starting to save recording...');

        // waveform processing removed

        const newId = uuid.v4();
        // Use the order that was captured at recording start time
        const targetOrder = currentRecordingOrderRef.current;
        console.log(
          `📍 Inserting at position ${targetOrder} (after item at ${targetOrder - 1})`
        );

        const newSegment: AudioSegment = {
          id: newId,
          uri,
          duration,
          waveformData: [],
          name: `Segment ${targetOrder}`
        };

        if (!currentProjectId || !currentQuestId || !currentProject) {
          console.error('❌ Missing required IDs:', {
            currentProjectId,
            currentQuestId,
            hasProject: !!currentProject
          });
          return;
        }

        // 1. IMMEDIATELY add optimistic asset to UI (appears instantly!)
        const tempId = uuid.v4() + '_optimistic';
        const optimisticAsset: OptimisticAsset = {
          id: newId,
          name: newSegment.name,
          order_index: targetOrder,
          source: 'optimistic',
          created_at: new Date().toISOString(),
          tempId
        };

        setOptimisticAssets((prev) => [...prev, optimisticAsset]);
        console.log('✨ Optimistic asset added - appears in UI immediately!');

        // 2. Remove pending card (recording is done)
        setPendingSegments((prev) =>
          prev.filter((p) => p.status !== 'recording' && p.status !== 'saving')
        );

        // 3. Advance insertion index so next recording goes AFTER this one
        setInsertionIndex(targetOrder);
        console.log(
          `📍 Advanced insertion index to ${targetOrder} (ready for next recording)`
        );

        // 4. NOW save to database in background (doesn't block UI)
        const attachmentRecord =
          await system.permAttachmentQueue?.saveAudio(uri);

        await system.db.transaction(async (tx) => {
          // Shift order_index for existing assets in this quest at/after targetOrder
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
            .insert(resolveTable('asset', { localOverride: true }))
            .values({
              name: newSegment.name,
              id: newSegment.id,
              order_index: targetOrder,
              source_language_id: currentProject.target_language_id,
              creator_id: currentUser!.id,
              download_profiles: [currentUser!.id]
            })
            .returning();

          if (!newAsset) {
            throw new Error('Failed to insert asset');
          }

          await tx
            .insert(resolveTable('quest_asset_link', { localOverride: true }))
            .values({
              id: `${currentQuestId}_${newAsset.id}`,
              quest_id: currentQuestId,
              asset_id: newAsset.id,
              download_profiles: [currentUser!.id]
            });

          await tx
            .insert(resolveTable('asset_content_link', { localOverride: true }))
            .values({
              asset_id: newAsset.id,
              source_language_id: currentProject.target_language_id,
              text: newSegment.name,
              audio_id: attachmentRecord?.id ?? newSegment.id,
              download_profiles: [currentUser!.id]
            });
        });

        console.log(
          '✅ Asset saved to database:',
          newSegment.id,
          'at order_index:',
          targetOrder
        );

        // 5. Remove optimistic asset now that real one exists
        setOptimisticAssets((prev) => prev.filter((opt) => opt.id !== newId));
        console.log(
          '🔄 Optimistic asset removed, real asset will show from DB'
        );

        // Debug: Check what order_index values exist in the database
        const debugAssetLocal = resolveTable('asset', { localOverride: true });
        const debugLinkLocal = resolveTable('quest_asset_link', {
          localOverride: true
        });
        const allAssets = await system.db
          .select({
            id: debugAssetLocal.id,
            name: debugAssetLocal.name,
            order_index: debugAssetLocal.order_index
          })
          .from(debugAssetLocal)
          .innerJoin(
            debugLinkLocal,
            eq(debugLinkLocal.asset_id, debugAssetLocal.id)
          )
          .where(eq(debugLinkLocal.quest_id, currentQuestId))
          .orderBy(debugAssetLocal.order_index);

        console.log(
          '📊 All assets order_index values after save:',
          allAssets.map((a) => `${a.name}: ${a.order_index}`).join(', ')
        );

        // Invalidate asset queries to immediately reflect local DB changes
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'infinite', currentQuestId, ''],
          exact: false
        });

        console.log('✅ Queries invalidated, asset should appear now');
      } catch (error) {
        console.error('❌ Failed to save recording:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
    },
    [
      insertionIndex,
      currentProjectId,
      currentQuestId,
      currentProject,
      currentUser,
      queryClient
    ]
  );

  const handleDeleteLocalAsset = React.useCallback(async (assetId: string) => {
    try {
      await audioSegmentService.deleteAudioSegment(assetId);
    } catch (e) {
      console.error('Failed to delete local asset', e);
    }
  }, []);

  const handleMergeDownLocal = React.useCallback(
    async (index: number) => {
      try {
        const first = assets[index];
        const second = assets[index + 1];
        if (!first || !second) return;
        if (first.source === 'cloud' || second.source === 'cloud') return;

        // Load second's content (local)
        const contentLocal = resolveTable('asset_content_link', {
          localOverride: true
        });
        const secondContent = await system.db
          .select()
          .from(contentLocal)
          .where(eq(contentLocal.asset_id, second.id));

        // Copy audio content rows to the first asset
        for (const c of secondContent) {
          if (!c.audio_id) continue;
          await system.db.insert(contentLocal).values({
            asset_id: first.id,
            source_language_id: c.source_language_id,
            text: c.text || '',
            audio_id: c.audio_id,
            download_profiles: [currentUser!.id]
          });
        }

        // Delete the second asset entirely
        await audioSegmentService.deleteAudioSegment(second.id);
      } catch (e) {
        console.error('Failed to merge local assets', e);
      }
    },
    [assets, currentUser]
  );

  const _handlePlaySegment = React.useCallback(
    async (uri: string, segmentId: string) => {
      try {
        const isThisSegmentPlaying = isPlaying && currentAudioId === segmentId;
        if (isThisSegmentPlaying) {
          await stopCurrentSound();
          setPlayingSegmentId(null);
        } else {
          await playSound(uri, segmentId);
          setPlayingSegmentId(segmentId);
        }
      } catch (error) {
        console.error('Failed to play audio segment:', error);
      }
    },
    [isPlaying, currentAudioId, playSound, stopCurrentSound]
  );

  React.useEffect(() => {
    if (!isPlaying) {
      setPlayingSegmentId(null);
    }
  }, [isPlaying]);

  // Reconcile pending cards with actual assets appearing
  React.useEffect(() => {
    if (!pendingSegments.length) return;
    const assetIds = new Set(assets.map((a) => a.id));
    setPendingSegments((prev) => {
      const next = prev.filter((p) => !(p.id && assetIds.has(p.id)));
      // Avoid infinite render loop by only updating when something actually changes
      return next.length === prev.length ? prev : next;
    });
  }, [assets, pendingSegments.length]);

  // Cleanup animations for removed pending IDs
  React.useEffect(() => {
    const ids = new Set(pendingSegments.map((p) => p.tempId));
    for (const key of Array.from(pendingAnimsRef.current.keys())) {
      if (!ids.has(key)) pendingAnimsRef.current.delete(key);
    }
  }, [pendingSegments]);

  // Cleanup optimistic assets when real data arrives
  React.useEffect(() => {
    // Skip if no optimistic assets to clean up
    if (optimisticAssets.length === 0) return;
    
    const pages = Array.isArray(
      (data as { pages?: { data: unknown[] }[] } | undefined)?.pages
    )
      ? (data as { pages: { data: unknown[] }[] }).pages
      : [];
    const all = pages.flatMap((p) => p.data);
    const realIds = new Set(
      all
        .map((a) => (a as { id?: string }).id)
        .filter((id): id is string => Boolean(id))
    );

    // Remove any optimistic assets that now exist in real data
    setOptimisticAssets((prev) => {
      const filtered = prev.filter((opt) => !realIds.has(opt.id));
      // Only update if something actually changed (prevent loops)
      if (filtered.length === prev.length) return prev;
      
      console.log(
        `🧹 Cleaned up ${prev.length - filtered.length} optimistic assets (now in DB)`
      );
      return filtered;
    });
  }, [data, optimisticAssets.length]); // Use length instead of full array

  const handleBatchMergeSelected = React.useCallback(async () => {
    try {
      // Keep list order for merging
      const selectedOrdered = assets.filter(
        (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
      );
      if (selectedOrdered.length < 2) return;

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
            download_profiles: [currentUser!.id]
          });
        }

        await audioSegmentService.deleteAudioSegment(src.id);
      }

      cancelSelection();
      void queryClient.invalidateQueries({
        queryKey: ['assets'],
        exact: false
      });
    } catch (e) {
      console.error('Failed to batch merge local assets', e);
    }
  }, [assets, selectedAssetIds, currentUser, cancelSelection, queryClient]);

  // Prepare unified content; interleave pending by placementIndex
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

    const renderSpacer = (key: string) => {
      if (isWheel) return null; // do not render spacers in wheel mode
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

    const renderPending = (group: typeof pendingSegments | undefined) => {
      if (!group) return;
      for (const p of group) {
        const anim = pendingAnimsRef.current.get(p.tempId);
        content.push(
          <Animated.View
            key={p.tempId}
            className={`rounded-lg border p-3 ${
              p.status === 'recording' || p.status === 'saving'
                ? 'border-primary bg-primary/10'
                : p.status === 'error'
                  ? 'border-destructive bg-destructive/10'
                  : 'border-border bg-card'
            }`}
            style={{
              opacity: anim?.opacity || 1,
              transform: [{ translateY: anim?.translateY || 0 }]
            }}
          >
            <View className="flex-row items-center gap-3">
              {/* Loading spinner for active states */}
              {(p.status === 'recording' || p.status === 'saving') && (
                <View className="h-8 w-8 items-center justify-center">
                  <Icon
                    as={Loader2}
                    size={20}
                    className="animate-spin text-primary"
                  />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-bold text-primary">
                  {p.name}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {p.status === 'recording'
                    ? 'Recording… Hold to continue'
                    : p.status === 'saving'
                      ? 'Saving to library…'
                      : p.status === 'ready'
                        ? 'Finalizing…'
                        : 'Error - Tap to retry'}
                </Text>
                {/* waveform removed */}
              </View>
            </View>
          </Animated.View>
        );
      }
    };

    // Leading spacer when inserting before the first item
    if (!isWheel && assets.length > 0 && insertionIndex === 0) {
      content.push(renderSpacer('spacer-leading'));
    }

    for (let i = 0; i <= assets.length; i++) {
      // Pending intended before asset i
      renderPending(pendingByIndex.get(i));

      // Asset at i
      if (i < assets.length) {
        const asset = assets[i]!;
        const isSelected = selectedAssetIds.has(asset.id);
        content.push(
          <TouchableOpacity
            key={asset.id}
            className={`rounded-lg border p-3 ${
              isSelected
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card'
            }`}
            onPress={() => (isSelectionMode ? toggleSelect(asset.id) : {})}
            onLongPress={() => enterSelection(asset.id)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-base font-medium text-foreground">
                  {asset.name}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {asset.source === 'cloud' ? 'Cloud' : 'Local'} • Position{' '}
                  {i + 1}
                </Text>
                {/* waveform removed */}
              </View>
              {!isSelectionMode && asset.source !== 'cloud' && (
                <View className="flex-row gap-1">
                  <Button
                    variant="destructive"
                    size="icon"
                    onPress={() => handleDeleteLocalAsset(asset.id)}
                  >
                    <Icon as={Trash2} size={16} />
                  </Button>
                  {i < assets.length - 1 &&
                    assets[i + 1]?.source !== 'cloud' && (
                      <Button
                        variant="outline"
                        size="icon"
                        onPress={() => handleMergeDownLocal(i)}
                      >
                        <Icon as={GitMerge} size={16} />
                      </Button>
                    )}
                </View>
              )}
              {isSelectionMode && (
                <View className="pl-2">
                  <Icon
                    as={isSelected ? CheckCircle : Circle}
                    size={20}
                    className={
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    }
                  />
                </View>
              )}
            </View>
          </TouchableOpacity>
        );

        // Derived spacer: show a slim gap after the active pre-insertion item
        if (!isWheel && i === Math.max(0, insertionIndex - 1)) {
          content.push(renderSpacer(`spacer-${asset.id}`));
        }
      }
    }

    return content;
  }, [
    pendingSegments,
    assets,
    selectedAssetIds,
    isSelectionMode,
    toggleSelect,
    enterSelection,
    handleDeleteLocalAsset,
    handleMergeDownLocal,
    pendingAnimsRef,
    insertionIndex,
    spacerHeight,
    spacerPulse,
    isWheel
  ]);

  return (
    <View className="flex-1 bg-background">
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

      {/* Header with asset count */}
      <View className="px-4 pb-2">
        <Text className="text-xl font-bold text-foreground">
          {t('assets')} ({assets.length})
        </Text>
      </View>

      {/* Wheel/List Picker (toggle via EXPO_PUBLIC_USE_NATIVE_WHEEL='1') */}
      {process.env.EXPO_PUBLIC_USE_NATIVE_WHEEL === '1' ? (
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

      {/* Bottom Controls */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-4 pb-8 pt-4"
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
      >
        {isSelectionMode && (
          <View className="mb-3 flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
            <Text className="text-sm text-muted-foreground">
              {selectedAssetIds.size} selected
            </Text>
            <View className="flex-row gap-2">
              <Button variant="outline" onPress={cancelSelection}>
                <Text>Cancel</Text>
              </Button>
              <Button
                variant="default"
                disabled={selectedAssetIds.size < 2}
                onPress={handleBatchMergeSelected}
              >
                <Icon as={GitMerge} size={16} />
                <Text className="ml-2">Merge</Text>
              </Button>
            </View>
          </View>
        )}
        {/* recording waveform removed */}
        <WalkieTalkieRecorder
          onRecordingComplete={handleRecordingComplete}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onWaveformUpdate={undefined}
          isRecording={isRecording}
        />
      </View>
    </View>
  );
}
