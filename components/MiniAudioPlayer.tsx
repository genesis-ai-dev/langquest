import { useAudio } from '@/contexts/AudioContext';
import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface MiniAudioPlayerProps {
  id: string;
  title: string;
  audioSegments: string[];
}

export default function MiniAudioPlayer({
  audioSegments,
  id,
  title
}: MiniAudioPlayerProps) {
  const { playSound, stopCurrentSound, isPlaying, currentAudioId } = useAudio();

  const handlePlayPause = async () => {
    if (isPlaying && currentAudioId === id) {
      // Currently playing this audio, so stop it
      await stopCurrentSound();
    } else {
      // Either no audio is playing, or a different one is playing
      await playSound(audioSegments[0]!, title);
    }
  };

  const isThisAudioPlaying = isPlaying && currentAudioId === id;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
        <Ionicons
          name={isThisAudioPlaying ? 'pause' : 'play'}
          size={24}
          color={colors.text}
        />
      </TouchableOpacity>
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
