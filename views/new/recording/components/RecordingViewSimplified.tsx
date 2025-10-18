import type { ArrayInsertionWheelHandle } from '@/components/ArrayInsertionWheel';
import ArrayInsertionWheel from '@/components/ArrayInsertionWheel';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  asset,
  asset_content_link,
  quest_asset_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
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
import { View } from 'react-native';
import { useHybridData } from '../../useHybridData';
import { useVADRecording } from '../hooks/useVADRecording';
import { getNextOrderIndex, saveRecording } from '../services/recordingService';
import { AssetCard } from './AssetCard';
import { RecordingControls } from './RecordingControls';

// Feature flag: true = use ArrayInsertionWheel, false = use LegendList
const USE_INSERTION_WHEEL = true;

interface UIAsset {
  id: string;
  name: string;
  created_at: string;
  order_index: number;
  source: 'local' | 'synced' | 'cloud';
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

  // Recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [isVADLocked, setIsVADLocked] = React.useState(false);

  // VAD settings
  const [vadThreshold, _setVadThreshold] = React.useState(0.06);
  const [vadSilenceDuration, _setVadSilenceDuration] = React.useState(1000);

  // Track current recording order index
  const currentRecordingOrderRef = React.useRef<number>(0);
  const vadCounterRef = React.useRef<number | null>(null);
  const dbWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  // Insertion wheel state
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  const wheelRef = React.useRef<ArrayInsertionWheelHandle>(null);

  // Track footer height for proper scrolling
  const [footerHeight, setFooterHeight] = React.useState(0);
  const ROW_HEIGHT = 80;

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
  const assets = React.useMemo((): UIAsset[] => {
    return rawAssets
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
        return {
          id: obj.id,
          name: obj.name,
          created_at: obj.created_at,
          order_index:
            typeof obj.order_index === 'number' ? obj.order_index : index,
          source: obj.source
        };
      });
  }, [rawAssets]);

  // Track actual content changes to prevent unnecessary re-renders
  // LegendList will only re-render items when this key changes
  const assetContentKey = React.useMemo(
    () => assets.map((a) => `${a.id}:${a.order_index}`).join('|'),
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

        if (contentLinks.length === 0) {
          console.log('No content links found for asset:', assetId);
          return [];
        }

        // Get audio values from content links (can be URIs or attachment IDs)
        const audioValues = contentLinks
          .flatMap((link) => link.audio ?? [])
          .filter((value): value is string => !!value);

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
      // Use the current insertion index from the wheel
      const targetOrder =
        insertionIndex < assets.length
          ? (assets[insertionIndex]?.order_index ?? insertionIndex)
          : (assets[assets.length - 1]?.order_index ?? 0) + 1;
      currentRecordingOrderRef.current = targetOrder;
      console.log(
        `🎯 Recording will insert at index ${insertionIndex} with order_index ${targetOrder}`
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
              audioUri: localUri
            });
          })
          .catch((err) => {
            console.error('❌ DB write failed:', err);
            throw err;
          });

        await dbWriteQueueRef.current;

        // Invalidate queries to refresh asset list
        if (!isVADLocked) {
          await queryClient.invalidateQueries({
            queryKey: ['assets', 'infinite', 'by-quest', currentQuestId, ''],
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
      isVADLocked
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
  const { currentEnergy, isRecording: isVADRecording } = useVADRecording({
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
        queryKey: ['assets', 'infinite', 'by-quest', currentQuestId, ''],
        exact: false
      });
    }
  }, [isVADLocked, currentQuestId, queryClient]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Memoized render function for LegendList
  const renderAssetItem = React.useCallback(
    ({ item }: { item: UIAsset }) => {
      const isThisAssetPlaying =
        audioContext.isPlaying && audioContext.currentAudioId === item.id;

      return (
        <AssetCard
          asset={item}
          index={0}
          isSelected={false}
          isSelectionMode={false}
          isPlaying={isThisAssetPlaying}
          onPress={() => {
            void handlePlayAsset(item.id);
          }}
          onLongPress={() => {
            console.log('Asset long pressed:', item.id);
          }}
          onPlay={() => {
            void handlePlayAsset(item.id);
          }}
        />
      );
    },
    [audioContext.isPlaying, audioContext.currentAudioId, handlePlayAsset]
  );

  // Memoized children for ArrayInsertionWheel
  const wheelChildren = React.useMemo(() => {
    return assetsForLegendList.map((item) => {
      const isThisAssetPlaying =
        audioContext.isPlaying && audioContext.currentAudioId === item.id;

      return (
        <AssetCard
          key={item.id}
          asset={item}
          index={0}
          isSelected={false}
          isSelectionMode={false}
          isPlaying={isThisAssetPlaying}
          onPress={() => {
            void handlePlayAsset(item.id);
          }}
          onLongPress={() => {
            console.log('Asset long pressed:', item.id);
          }}
          onPlay={() => {
            void handlePlayAsset(item.id);
          }}
        />
      );
    });
  }, [
    assetsForLegendList,
    audioContext.isPlaying,
    audioContext.currentAudioId,
    handlePlayAsset
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
      {/* <View className="absolute bottom-0 left-0 right-0"> */}
      {/* Debug switches for VAD testing */}

      {/* Recording controls */}
      <RecordingControls
        isRecording={isRecording || isVADRecording}
        onRecordingStart={handleRecordingStart}
        onRecordingStop={handleRecordingStop}
        onRecordingComplete={handleRecordingComplete}
        onRecordingDiscarded={handleRecordingDiscarded}
        onLayout={setFooterHeight}
        isVADLocked={isVADLocked}
        onVADLockChange={setIsVADLocked}
        currentEnergy={currentEnergy}
        vadThreshold={vadThreshold}
      />
    </View>
  );
};

export default RecordingViewSimplified;
