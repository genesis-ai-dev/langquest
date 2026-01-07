import { Button } from '@/components/ui/button';
import { useAudio } from '@/contexts/AudioContext';
import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface MiniAudioPlayerProps {
  id: string;
  title: string;
  audioSegments: string[];
}

export default function MiniAudioPlayer({
  audioSegments,
  id,
  title: _title
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

  return (
    <View style={styles.container}>
      <Button variant="plain" onPress={handlePlayPause} style={styles.playButton}>
        <Ionicons
          name={isThisAudioPlaying ? 'pause' : 'play'}
          size={24}
          color={colors.text}
        />
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.small
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
