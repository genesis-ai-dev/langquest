import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import { useAudio } from '@/contexts/AudioContext';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Play, Pause, FileText } from 'lucide-react-native';
import { setAudioModeAsync } from 'expo-audio';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Carousel from './Carousel';

interface AudioFile {
  id: string;
  title: string;
  uri: string;
}

interface AudioPlayerProps {
  audioFiles?: AudioFile[];
  audioSegments?: string[];
  useCarousel?: boolean;
  mini?: boolean;
  onTranscribe?: (uri: string) => void;
  isTranscribing?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioFiles = [],
  audioSegments,
  useCarousel = true,
  mini = false,
  onTranscribe,
  isTranscribing = false
}) => {
  const { t } = useLocalization();
  const {
    playSound,
    stopCurrentSound,
    isPlaying,
    currentAudioId,
    position,
    duration,
    setPosition
  } = useAudio();

  useEffect(() => {
    const setupAudioMode = async () => {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true
      });
    };

    void setupAudioMode();
  }, []);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async (uri: string, audioId: string) => {
    const isThisAudioPlaying = isPlaying && currentAudioId === audioId;

    if (isThisAudioPlaying) {
      await stopCurrentSound();
    } else {
      await playSound(uri, audioId);
    }
  };

  const handleSliderChange = async (value: number) => {
    await setPosition(value);
  };

  const renderAudioItem = (item: AudioFile) => {
    const isThisAudioPlaying = isPlaying && currentAudioId === item.id;

    return (
      <View style={[styles.audioItem, mini && styles.miniAudioItem]}>
        <View style={styles.controlsRow}>
          <Button
            variant="plain"
            style={[styles.audioPlayButton, mini && styles.miniAudioPlayButton]}
            onPress={() => handlePlayPause(item.uri, item.id)}
          >
            <Icon
              as={isThisAudioPlaying ? Pause : Play}
              size={mini ? 24 : 48}
              className="text-foreground"
            />
          </Button>
          {onTranscribe && (
            <Button
              variant="plain"
              style={[
                styles.transcribeButton,
                mini && styles.miniTranscribeButton
              ]}
              onPress={() => onTranscribe(item.uri)}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <ActivityIndicator
                  size={mini ? 16 : 24}
                  color={colors.background}
                />
              ) : (
                <Icon
                  as={FileText}
                  size={mini ? 18 : 28}
                  className="text-background"
                />
              )}
            </Button>
          )}
        </View>
        {!mini && <Text style={styles.audioFileName}>{item.title}</Text>}
        <View
          style={[
            styles.audioProgressContainer,
            mini && styles.miniAudioProgressContainer
          ]}
        >
          <Slider
            style={styles.audioProgressBar}
            max={duration || 100}
            value={isThisAudioPlaying ? position : 0}
            onValueChange={(value) => handleSliderChange(value)}
          />
          <View style={styles.audioTimeContainer}>
            <Text style={styles.audioTimeText}>
              {formatTime(isThisAudioPlaying ? position : 0)}
            </Text>
            {isThisAudioPlaying && (
              <Text style={styles.audioTimeText}>
                {formatTime(duration || 0)}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (useCarousel) {
    return (
      <Carousel
        items={audioFiles}
        renderItem={renderAudioItem}
        onPageChange={async () => {
          await stopCurrentSound();
        }}
      />
    );
  }

  const audioFilesOrSingle = audioSegments
    ? [{ id: 'single', title: t('recording'), uri: audioSegments[0]! }]
    : audioFiles;

  if (!audioFilesOrSingle[0]) return null;

  return renderAudioItem(audioFilesOrSingle[0]);
};

const styles = StyleSheet.create({
  audioItem: {
    alignItems: 'center',
    width: '100%'
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium
  },
  audioPlayButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBackground
  },
  transcribeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary
  },
  miniTranscribeButton: {
    width: 36,
    height: 36,
    borderRadius: 18
  },
  audioFileName: {
    color: colors.text,
    fontSize: fontSizes.small,
    marginTop: spacing.small,
    textAlign: 'center'
  },
  audioProgressContainer: {
    width: '100%',
    paddingHorizontal: spacing.medium
  },
  audioProgressBar: {
    width: '100%',
    height: 40
  },
  audioTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  audioTimeText: {
    color: colors.text,
    fontSize: fontSizes.small
  },
  miniAudioItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  miniAudioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  miniAudioProgressContainer: {
    flex: 1,
    marginLeft: spacing.small
  }
});

export default AudioPlayer;
