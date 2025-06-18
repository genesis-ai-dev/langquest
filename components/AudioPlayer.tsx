import { useAudio } from '@/contexts/AudioContext';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Carousel from './Carousel';

interface AudioFile {
  id: string;
  title: string;
  uri: string;
}

interface AudioPlayerProps {
  audioFiles?: AudioFile[];
  audioUri?: string;
  useCarousel?: boolean;
  mini?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioFiles = [],
  audioUri,
  useCarousel = true,
  mini = false
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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true
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
        <TouchableOpacity
          style={[styles.audioPlayButton, mini && styles.miniAudioPlayButton]}
          onPress={() => handlePlayPause(item.uri, item.id)}
        >
          <Ionicons
            name={isThisAudioPlaying ? 'pause' : 'play'}
            size={mini ? 24 : 48}
            color={colors.text}
          />
        </TouchableOpacity>
        {!mini && <Text style={styles.audioFileName}>{item.title}</Text>}
        <View
          style={[
            styles.audioProgressContainer,
            mini && styles.miniAudioProgressContainer
          ]}
        >
          <Slider
            style={styles.audioProgressBar}
            minimumValue={0}
            maximumValue={duration || 100}
            value={isThisAudioPlaying ? position : 0}
            onSlidingComplete={handleSliderChange}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.inputBorder}
            thumbTintColor={colors.primary}
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

  const audioFilesOrSingle = audioUri
    ? [{ id: 'single', title: t('recording'), uri: audioUri }]
    : audioFiles;

  if (!audioFilesOrSingle[0]) return null;

  return renderAudioItem(audioFilesOrSingle[0]);
};

const styles = StyleSheet.create({
  audioItem: {
    alignItems: 'center',
    width: '100%'
  },
  audioPlayButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBackground
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
