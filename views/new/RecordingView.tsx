import InsertionCursor from '@/components/InsertionCursor';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import WalkieTalkieRecorder from '@/components/WalkieTalkieRecorder';
import WaveformVisualizer from '@/components/WaveformVisualizer';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import { system } from '@/db/powersync/system';
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { resolveTable } from '@/utils/dbUtils';
import { eq } from 'drizzle-orm';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GitMerge,
  Trash2
} from 'lucide-react-native';
import React from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import uuid from 'react-native-uuid';

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
  const { currentQuestId, currentProjectId } = useCurrentNavigation();
  const { currentUser } = useAuth();
  const { project: currentProject } = useProjectById(currentProjectId);
  const { playSound, stopCurrentSound, isPlaying, currentAudioId } = useAudio();

  const { t } = useLocalization();
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  const [isRecording, setIsRecording] = React.useState(false);
  const [currentWaveformData, setCurrentWaveformData] = React.useState<
    number[]
  >([]);
  const [playingSegmentId, setPlayingSegmentId] = React.useState<string | null>(
    null
  );
  const [waveformByAssetId, setWaveformByAssetId] = React.useState<
    Map<string, number[]>
  >(new Map());

  // Load existing assets for the quest (local + cloud)
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAssetsByQuest(currentQuestId || '', '', false);
  const assets = React.useMemo(() => {
    const all = data?.pages.flatMap((p) => p.data) ?? [];
    const valid = all.filter((a) => a.id && a.name);
    return valid.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );
  }, [data?.pages]);

  const handleRecordingStart = React.useCallback(() => {
    setIsRecording(true);
    setCurrentWaveformData(new Array(60).fill(0.01));
  }, []);

  const handleRecordingStop = React.useCallback(() => {
    setIsRecording(false);
    setCurrentWaveformData(new Array(60).fill(0.01));
  }, []);

  const handleWaveformUpdate = React.useCallback((waveformData: number[]) => {
    setCurrentWaveformData(waveformData);
  }, []);

  const handleRecordingComplete = React.useCallback(
    async (uri: string, duration: number, waveformData: number[]) => {
      const DISPLAY_BARS = 48;
      const interpolateToFixedBars = (
        samples: number[],
        targetBars: number
      ): number[] => {
        if (samples.length === 0) {
          return new Array<number>(targetBars).fill(0.01);
        }
        const result: number[] = [];
        if (samples.length === targetBars) {
          return samples.map((v) => Math.max(0.01, Math.min(0.99, v)));
        } else if (samples.length < targetBars) {
          for (let i = 0; i < targetBars; i++) {
            const sourceIndex = (i / (targetBars - 1)) * (samples.length - 1);
            const lowerIndex = Math.floor(sourceIndex);
            const upperIndex = Math.min(
              samples.length - 1,
              Math.ceil(sourceIndex)
            );
            const fraction = sourceIndex - lowerIndex;
            const lowerValue = samples[lowerIndex] ?? 0.01;
            const upperValue = samples[upperIndex] ?? 0.01;
            const interpolatedValue =
              lowerValue + (upperValue - lowerValue) * fraction;
            result.push(Math.max(0.01, Math.min(0.99, interpolatedValue)));
          }
        } else {
          const binSize = samples.length / targetBars;
          for (let i = 0; i < targetBars; i++) {
            const start = Math.floor(i * binSize);
            const end = Math.floor((i + 1) * binSize);
            let sum = 0;
            let count = 0;
            for (let j = start; j < end && j < samples.length; j++) {
              sum += samples[j] ?? 0;
              count++;
            }
            const avgValue = count > 0 ? sum / count : 0.01;
            result.push(Math.max(0.01, Math.min(0.99, avgValue)));
          }
        }
        const smoothed: number[] = [...result];
        for (let i = 1; i < smoothed.length - 1; i++) {
          const prev = result[i - 1] ?? 0.01;
          const curr = result[i] ?? 0.01;
          const next = result[i + 1] ?? 0.01;
          smoothed[i] = curr * 0.8 + (prev + next) * 0.1;
        }
        return smoothed;
      };

      const interpolatedWaveform = interpolateToFixedBars(
        waveformData,
        DISPLAY_BARS
      );
      const newId = uuid.v4() as string;
      const newSegment: AudioSegment = {
        id: newId,
        uri,
        duration,
        waveformData: interpolatedWaveform,
        name: `Segment ${(assets?.length ?? 0) + 1}`
      };

      if (!currentProjectId || !currentQuestId || !currentProject) return;

      // Create a permanent attachment record for this audio and move the file
      const attachmentRecord = await system.permAttachmentQueue?.saveAudio(uri);

      await system.db.transaction(async (tx) => {
        const [newAsset] = await tx
          .insert(resolveTable('asset', { localOverride: true }))
          .values({
            name: newSegment.name,
            id: newSegment.id,
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
            // Link the recorded audio via attachment ID so attachment state/URIs are tracked
            audio_id: attachmentRecord?.id ?? newSegment.id,
            download_profiles: [currentUser!.id]
          });
      });

      // Cache waveform for this newly created asset so we can visualize it in the list
      setWaveformByAssetId((prev) => {
        const next = new Map(prev);
        next.set(newSegment.id, interpolatedWaveform);
        return next;
      });

      setInsertionIndex((prev) => prev + 1);
    },
    [
      assets?.length,
      insertionIndex,
      currentProjectId,
      currentQuestId,
      currentProject,
      currentUser
    ]
  );

  const handleDeleteLocalAsset = React.useCallback(
    async (assetId: string) => {
      try {
        await audioSegmentService.deleteAudioSegment(assetId);
        // Adjust cursor if needed
        const idx = assets.findIndex((a) => a.id === assetId);
        if (idx >= 0 && idx < insertionIndex) {
          setInsertionIndex((prev) => Math.max(0, prev - 1));
        }
      } catch (e) {
        console.error('Failed to delete local asset', e);
      }
    },
    [assets, insertionIndex]
  );

  const moveCursorUp = React.useCallback(() => {
    setInsertionIndex((prev) => Math.max(0, prev - 1));
  }, []);
  const moveCursorDown = React.useCallback(() => {
    setInsertionIndex((prev) => Math.min(assets?.length ?? 0, prev + 1));
  }, [assets?.length]);

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
            text: c.text ?? '',
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

  const handlePlaySegment = React.useCallback(
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

  // No batch save needed: we save to DB immediately on recording complete

  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const scrollY = contentOffset.y;
      const itemHeight = 100;
      const headerHeight = 60;
      const adjustedScrollY = Math.max(0, scrollY - headerHeight);
      const itemIndex = Math.floor(adjustedScrollY / itemHeight);
      const newInsertionIndex = Math.max(0, Math.min(assets.length, itemIndex));
      setInsertionIndex(newInsertionIndex);
    },
    [assets.length]
  );

  React.useEffect(() => {
    if (!isPlaying) {
      setPlayingSegmentId(null);
    }
  }, [isPlaying]);

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
        <View className="flex-row items-center gap-2">
          <Button variant="outline" size="icon" onPress={moveCursorUp}>
            <Icon as={ArrowUp} />
          </Button>
          <Button variant="outline" size="icon" onPress={moveCursorDown}>
            <Icon as={ArrowDown} />
          </Button>
        </View>
      </View>

      {isRecording && (
        <View className="mx-4 mb-4 items-center rounded-lg bg-muted p-4">
          <Text className="mb-2 text-lg font-bold text-destructive">
            {t('isRecording')}
          </Text>
          <WaveformVisualizer
            waveformData={currentWaveformData}
            isRecording={true}
            width={300}
            height={60}
            barCount={60}
          />
        </View>
      )}

      <View className="mt-4 flex-1 pb-32">
        <Text className="mb-4 px-4 text-xl font-bold text-foreground">
          {t('assets')} ({assets.length})
        </Text>
        <ScrollView
          className="flex-1"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          {assets.map((asset, index) => (
            <React.Fragment key={asset.id}>
              {index === insertionIndex && (
                <InsertionCursor visible={true} position={index} />
              )}
              <TouchableOpacity
                className="mx-4 mb-3 rounded-lg border border-border bg-card p-3"
                onPress={() => setInsertionIndex(index)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground">
                      {asset.name}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {asset.source === 'cloud' ? 'Cloud' : 'Local'}
                    </Text>
                    {/* Waveform for local items if known */}
                    {waveformByAssetId.get(asset.id) && (
                      <View className="mt-2">
                        <WaveformVisualizer
                          waveformData={waveformByAssetId.get(asset.id) ?? []}
                          isRecording={false}
                          width={300}
                          height={40}
                          barCount={48}
                        />
                      </View>
                    )}
                  </View>
                  {asset.source !== 'cloud' && (
                    <View className="flex-row gap-2">
                      <Button
                        variant="destructive"
                        size="icon"
                        onPress={() => handleDeleteLocalAsset(asset.id)}
                      >
                        <Icon as={Trash2} />
                      </Button>
                      {index < assets.length - 1 &&
                        assets[index + 1]?.source !== 'cloud' && (
                          <Button
                            variant="outline"
                            size="icon"
                            onPress={() => handleMergeDownLocal(index)}
                          >
                            <Icon as={GitMerge} />
                          </Button>
                        )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
          {insertionIndex === assets.length ? (
            <InsertionCursor visible={true} position={assets.length} />
          ) : null}
        </ScrollView>
      </View>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-4 pb-8 pt-4">
        <WalkieTalkieRecorder
          onRecordingComplete={handleRecordingComplete}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onWaveformUpdate={handleWaveformUpdate}
          isRecording={isRecording}
        />
      </View>
    </View>
  );
}
