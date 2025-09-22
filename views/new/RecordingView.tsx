import AudioSegmentItem from '@/components/AudioSegmentItem';
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
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { resolveTable } from '@/utils/dbUtils';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, View } from 'react-native';
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
  const [audioSegments, setAudioSegments] = React.useState<AudioSegment[]>([]);
  const [insertionIndex, setInsertionIndex] = React.useState(0);
  const [isRecording, setIsRecording] = React.useState(false);
  const [currentWaveformData, setCurrentWaveformData] = React.useState<
    number[]
  >([]);
  const [playingSegmentId, setPlayingSegmentId] = React.useState<string | null>(
    null
  );

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
      const newSegment: AudioSegment = {
        id: uuid.v4() as string,
        uri,
        duration,
        waveformData: interpolatedWaveform,
        name: `Segment ${audioSegments.length + 1}`
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

      setAudioSegments((prev) => {
        const newSegments = [...prev];
        newSegments.splice(insertionIndex, 0, newSegment);
        return newSegments;
      });

      setInsertionIndex((prev) => prev + 1);
    },
    [
      audioSegments.length,
      insertionIndex,
      currentProjectId,
      currentQuestId,
      currentProject,
      currentUser
    ]
  );

  const handleDeleteSegment = React.useCallback(
    async (segmentId: string) => {
      setAudioSegments((prev) => {
        const newSegments = prev.filter((segment) => segment.id !== segmentId);
        const deletedIndex = prev.findIndex(
          (segment) => segment.id === segmentId
        );
        if (deletedIndex < insertionIndex) {
          setInsertionIndex((prev) => Math.max(0, prev - 1));
        }
        return newSegments;
      });
      await audioSegmentService.deleteAudioSegment(segmentId);
    },
    [insertionIndex]
  );

  const handleMoveSegmentUp = React.useCallback((segmentId: string) => {
    setAudioSegments((prev) => {
      const newSegments = [...prev];
      const currentIndex = newSegments.findIndex((s) => s.id === segmentId);
      if (currentIndex > 0) {
        const currentSegment = newSegments[currentIndex];
        const previousSegment = newSegments[currentIndex - 1];
        if (currentSegment && previousSegment) {
          newSegments[currentIndex] = previousSegment;
          newSegments[currentIndex - 1] = currentSegment;
        }
      }
      return newSegments;
    });
  }, []);

  const handleMoveSegmentDown = React.useCallback((segmentId: string) => {
    setAudioSegments((prev) => {
      const newSegments = [...prev];
      const currentIndex = newSegments.findIndex((s) => s.id === segmentId);
      if (currentIndex < newSegments.length - 1) {
        const currentSegment = newSegments[currentIndex];
        const nextSegment = newSegments[currentIndex + 1];
        if (currentSegment && nextSegment) {
          newSegments[currentIndex] = nextSegment;
          newSegments[currentIndex + 1] = currentSegment;
        }
      }
      return newSegments;
    });
  }, []);

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

  const handleSaveSegments = React.useCallback(async () => {
    if (
      !currentUser ||
      !currentQuestId ||
      !currentProject?.target_language_id ||
      audioSegments.length === 0
    ) {
      console.warn('Cannot save segments: missing required data');
      return;
    }
    try {
      const result = await audioSegmentService.saveAudioSegments(
        audioSegments,
        currentQuestId,
        currentProject.target_language_id,
        currentUser.id
      );
      setAudioSegments([]);
      setInsertionIndex(0);
    } catch (error) {
      console.error('Failed to save audio segments:', error);
    }
  }, [currentUser, currentQuestId, currentProject, audioSegments]);

  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const scrollY = contentOffset.y;
      const itemHeight = 100;
      const headerHeight = 60;
      const adjustedScrollY = Math.max(0, scrollY - headerHeight);
      const itemIndex = Math.floor(adjustedScrollY / itemHeight);
      const newInsertionIndex = Math.max(
        0,
        Math.min(audioSegments.length, itemIndex)
      );
      setInsertionIndex(newInsertionIndex);
    },
    [audioSegments.length]
  );

  React.useEffect(() => {
    if (!isPlaying) {
      setPlayingSegmentId(null);
    }
  }, [isPlaying]);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 p-4">
        <Button variant="ghost" size="icon" onPress={onBack}>
          <Icon as={ArrowLeft} />
        </Button>
        <Text className="text-2xl font-bold text-foreground">{t('doRecord')}</Text>
      </View>

      {isRecording && (
        <View className="mx-4 mb-4 rounded-lg bg-muted p-4 items-center">
          <Text className="text-lg font-bold text-destructive mb-2">
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

      <View className="flex-1 mt-4 pb-32">
        <Text className="text-xl font-bold text-foreground mb-4 px-4">
          {t('audioSegments')} ({audioSegments.length})
        </Text>
        <ScrollView
          className="flex-1"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          {audioSegments.map((segment, index) => (
            <React.Fragment key={segment.id}>
              {index === insertionIndex && (
                <InsertionCursor visible={true} position={index} />
              )}
              <AudioSegmentItem
                segment={segment}
                onDelete={handleDeleteSegment}
                onMoveUp={handleMoveSegmentUp}
                onMoveDown={handleMoveSegmentDown}
                canMoveUp={index > 0}
                canMoveDown={index < audioSegments.length - 1}
                onPlay={(uri) => handlePlaySegment(uri, segment.id)}
                isPlaying={playingSegmentId === segment.id}
              />
            </React.Fragment>
          ))}
          {audioSegments.length === 0 ||
          insertionIndex === audioSegments.length ? (
            <InsertionCursor visible={true} position={audioSegments.length} />
          ) : null}
        </ScrollView>
      </View>

      {audioSegments.length > 0 && (
        <View className="mx-4 mb-4 p-4 bg-muted rounded-lg border border-primary">
          <Button
            variant="default"
            onPress={handleSaveSegments}
            className="w-full"
          >
            <Text className="text-lg font-bold text-primary-foreground">
              {t('save')}{' '}
              {audioSegments.length > 1
                ? t('audioSegments')
                : t('audioSegment')}{' '}
              {audioSegments.length > 1 ? t('asAssets') : t('asAsset')}
            </Text>
          </Button>
        </View>
      )}

      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border pt-4 pb-8 px-4">
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
