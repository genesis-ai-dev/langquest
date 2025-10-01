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
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { resolveTable } from '@/utils/dbUtils';
import { useQueryClient } from '@tanstack/react-query';
import { eq, sql } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Animated, View } from 'react-native';
import uuid from 'react-native-uuid';
import { AssetCard } from './components/AssetCard';
import { PendingCard } from './components/PendingCard';
import { RecordingControls } from './components/RecordingControls';
import { SelectionControls } from './components/SelectionControls';
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
  const { playSound, stopCurrentSound, isPlaying, currentAudioId } = useAudio();
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

  // Load existing assets
  const { data } = useAssetsByQuest(currentQuestId, '', false);

  const rawAssets = React.useMemo(() => {
    const pages = Array.isArray(
      (data as { pages?: { data: unknown[] }[] } | undefined)?.pages
    )
      ? (data as { pages: { data: unknown[] }[] }).pages
      : [];
    return pages.flatMap((p) => p.data);
  }, [data]);

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

  // Insertion tracking
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  const currentRecordingOrderRef = React.useRef<number>(0);

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
  const didInitScrollRef = React.useRef(false);
  const isWheel = process.env.EXPO_PUBLIC_USE_NATIVE_WHEEL === '1';

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

  // On first load, start at bottom
  React.useEffect(() => {
    if (didInitScrollRef.current) return;
    didInitScrollRef.current = true;
    const last = Math.max(0, assets.length);
    setInsertionIndex(last);
    listRef.current?.scrollToInsertionIndex(last, false);
  }, [assets.length]);

  const handleInsertionChange = React.useCallback((newIndex: number) => {
    setInsertionIndex(newIndex);
  }, []);

  // Recording lifecycle
  const handleRecordingStart = React.useCallback(() => {
    const tempId = startRecording(insertionIndex);
    const targetOrder = insertionIndex + 1;

    // Store for use in handleRecordingComplete
    currentRecordingOrderRef.current = targetOrder;

    // Advance insertion boundary
    setInsertionIndex(targetOrder);
    listRef.current?.scrollToInsertionIndex(targetOrder, true);

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
  }, [insertionIndex, startRecording]);

  const handleRecordingStop = React.useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleRecordingComplete = React.useCallback(
    async (uri: string, duration: number, _waveformData: number[]) => {
      try {
        console.log('💾 Starting to save recording...');

        const newId = uuid.v4();
        const targetOrder = currentRecordingOrderRef.current;

        console.log(
          `📍 Inserting at position ${targetOrder} (after item at ${targetOrder - 1})`
        );

        if (
          !currentProjectId ||
          !currentQuestId ||
          !currentProject ||
          !currentUser
        ) {
          console.error('❌ Missing required data');
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

        // 2. Remove pending card
        removePending();

        // 3. Advance insertion index
        setInsertionIndex(targetOrder);
        console.log(`📍 Advanced insertion index to ${targetOrder}`);

        // 4. Save to database in background
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

        // 6. Invalidate queries
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'infinite', currentQuestId, ''],
          exact: false
        });

        console.log('✅ Queries invalidated, asset should appear now');
      } catch (error) {
        console.error('❌ Failed to save recording:', error);
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
  const getAssetAudioUri = React.useCallback(
    async (assetId: string): Promise<string | null> => {
      try {
        const contentLocal = resolveTable('asset_content_link', {
          localOverride: true
        });
        const content = await system.db
          .select()
          .from(contentLocal)
          .where(eq(contentLocal.asset_id, assetId))
          .limit(1);

        if (content[0]?.audio_id && system.permAttachmentQueue) {
          const attachment = await system.powersync.getOptional<{
            id: string;
            local_uri: string | null;
            filename: string | null;
          }>(`SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`, [
            content[0].audio_id
          ]);

          if (attachment?.local_uri) {
            return system.permAttachmentQueue.getLocalUri(attachment.local_uri);
          }
        }
        return null;
      } catch (e) {
        console.error('Failed to get audio URI for asset', e);
        return null;
      }
    },
    []
  );

  const handlePlayAsset = React.useCallback(
    async (assetId: string) => {
      try {
        const isThisAssetPlaying = isPlaying && currentAudioId === assetId;

        if (isThisAssetPlaying) {
          await stopCurrentSound();
        } else {
          const uri = await getAssetAudioUri(assetId);
          if (uri) {
            await playSound(uri, assetId);
          } else {
            console.error('No audio URI found for asset:', assetId);
          }
        }
      } catch (error) {
        console.error('Failed to play audio:', error);
      }
    },
    [isPlaying, currentAudioId, playSound, stopCurrentSound, getAssetAudioUri]
  );

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

        content.push(
          <AssetCard
            key={asset.id}
            asset={asset}
            index={i}
            isSelected={isSelected}
            isSelectionMode={isSelectionMode}
            isPlaying={isThisPlaying}
            canMergeDown={canMergeDown}
            onPress={() => (isSelectionMode ? toggleSelect(asset.id) : {})}
            onLongPress={() => enterSelection(asset.id)}
            onPlay={handlePlayAsset}
            onDelete={handleDeleteLocalAsset}
            onMerge={handleMergeDownLocal}
          />
        );

        // Spacer after active pre-insertion item
        if (!isWheel && i === Math.max(0, insertionIndex - 1)) {
          content.push(renderSpacer(`spacer-${asset.id}`));
        }
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
    toggleSelect,
    enterSelection,
    handlePlayAsset,
    handleDeleteLocalAsset,
    handleMergeDownLocal
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
      <View className="px-4 pb-2">
        <Text className="text-xl font-bold text-foreground">
          {t('assets')} ({assets.length})
        </Text>
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
        {isSelectionMode && (
          <View className="px-4">
            <SelectionControls
              selectedCount={selectedAssetIds.size}
              onCancel={cancelSelection}
              onMerge={handleBatchMergeSelected}
            />
          </View>
        )}
        <RecordingControls
          isRecording={isRecording}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onRecordingComplete={handleRecordingComplete}
          onLayout={setFooterHeight}
        />
      </View>
    </View>
  );
}
