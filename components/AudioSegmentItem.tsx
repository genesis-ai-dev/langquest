import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WaveformVisualizer from './WaveformVisualizer';

interface AudioSegment {
  id: string;
  uri: string;
  duration: number;
  waveformData: number[];
  name: string;
}

interface AudioSegmentItemProps {
  segment: AudioSegment;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPlay?: (uri: string) => void;
  isPlaying?: boolean;
}

const AudioSegmentItem: React.FC<AudioSegmentItemProps> = ({
  segment,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onPlay,
  isPlaying = false
}) => {
  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 100);
    return `${seconds}.${ms}s`;
  };

  return (
    <View style={styles.container}>
      {/* Reorder buttons */}
      <View style={styles.reorderContainer}>
        <TouchableOpacity
          style={[styles.reorderButton, !canMoveUp && styles.disabledButton]}
          onPress={() => canMoveUp && onMoveUp(segment.id)}
          disabled={!canMoveUp}
        >
          <Ionicons
            name="chevron-up"
            size={20}
            color={canMoveUp ? colors.text : colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reorderButton, !canMoveDown && styles.disabledButton]}
          onPress={() => canMoveDown && onMoveDown(segment.id)}
          disabled={!canMoveDown}
        >
          <Ionicons
            name="chevron-down"
            size={20}
            color={canMoveDown ? colors.text : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Segment content */}
      <View style={styles.contentContainer}>
        {/* Header with name and duration */}
        <View style={styles.header}>
          <Text style={styles.segmentName} numberOfLines={1}>
            {segment.name}
          </Text>
          <Text style={styles.duration}>
            {formatDuration(segment.duration)}
          </Text>
        </View>

        {/* Waveform */}
        <View style={styles.waveformContainer}>
          <WaveformVisualizer
            waveformData={segment.waveformData}
            width={200}
            height={40}
            // Fixed bar count for consistent visual appearance
            barCount={48}
          />
        </View>

        {/* Action buttons */}
        <View style={styles.actionsContainer}>
          {onPlay && (
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => onPlay(segment.uri)}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(segment.id)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginVertical: spacing.xsmall,
    marginHorizontal: spacing.small,
    padding: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  reorderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small
  },
  reorderButton: {
    padding: spacing.xsmall,
    borderRadius: 4,
    backgroundColor: colors.backgroundSecondary,
    marginVertical: 2
  },
  disabledButton: {
    opacity: 0.3
  },
  contentContainer: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xsmall
  },
  segmentName: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    marginRight: spacing.small
  },
  duration: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  waveformContainer: {
    marginBottom: spacing.xsmall
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  playButton: {
    padding: spacing.xsmall,
    marginRight: spacing.small,
    borderRadius: 4,
    backgroundColor: colors.backgroundSecondary
  },
  deleteButton: {
    padding: spacing.xsmall,
    borderRadius: 4,
    backgroundColor: colors.backgroundSecondary
  }
});

export default AudioSegmentItem;
