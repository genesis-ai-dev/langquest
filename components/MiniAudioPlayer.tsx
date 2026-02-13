import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import { colors, spacing } from '@/styles/theme';
import { getThemeColor } from '@/utils/styleUtils';
import { Icon } from '@/components/ui/icon';
import { Pause, Play, SparklesIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

interface MiniAudioPlayerProps {
  id: string;
  title: string;
  audioSegments: string[];
  onTranscribe?: (uri: string) => void;
  isTranscribing?: boolean;
}

export default function MiniAudioPlayer({
  audioSegments,
  id,
  title: _title,
  onTranscribe,
  isTranscribing = false
}: MiniAudioPlayerProps) {
  const {
    playSound,
    playSoundSequence,
    stopCurrentSound,
    isPlaying,
    currentAudioId
  } = useAudio();

  const handlePlayPause = async () => {
    if (isPlaying && currentAudioId === id) {
      // Currently playing this audio, so stop it
      await stopCurrentSound();
    } else {
      // Handle single or multiple audio segments
      if (audioSegments.length === 1 && audioSegments[0]) {
        await playSound(audioSegments[0], id);
      } else if (audioSegments.length > 1) {
        await playSoundSequence(audioSegments, id);
      }
    }
  };

  const isThisAudioPlaying = isPlaying && currentAudioId === id;

  const handleTranscribe = () => {
    if (onTranscribe && audioSegments[0]) {
      onTranscribe(audioSegments[0]);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        variant="plain"
        onPress={handlePlayPause}
        style={styles.playButton}
      >
        <Icon
          as={isThisAudioPlaying ? Pause : Play}
          size={24}
          color={colors.text}
        />
      </Button>
      {onTranscribe && (
        <Button
          variant="plain"
          onPress={handleTranscribe}
          style={styles.transcribePill}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <ActivityIndicator
              size={16}
              color={getThemeColor('primary-foreground')}
            />
          ) : (
            <View style={styles.pillContent}>
              <Icon as={SparklesIcon} size={18} className="text-black" />
              <Text className="text-s">Aa</Text>
            </View>
          )}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    paddingVertical: spacing.small
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  transcribePill: {
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  }
});
