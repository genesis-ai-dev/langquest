import { useAudio } from '@/contexts/AudioContext';
import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface AudioFile {
  id: string;
  uri: string;
  title?: string;
}

interface MiniAudioPlayerProps {
  audioFile: AudioFile;
}

export default function MiniAudioPlayer({ audioFile }: MiniAudioPlayerProps) {
  const { playSound, stopCurrentSound, isPlaying, currentAudioId } = useAudio();

  const handlePlayPause = async () => {
    if (isPlaying && currentAudioId === audioFile.id) {
      // Currently playing this audio, so stop it
      await stopCurrentSound();
    } else {
      // Either no audio is playing, or a different one is playing
      await playSound(audioFile.uri, audioFile.id);
    }
  };

  const isThisAudioPlaying = isPlaying && currentAudioId === audioFile.id;

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
