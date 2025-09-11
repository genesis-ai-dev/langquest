import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PlayableWaveform } from './PlayableWaveform';

interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  audioUri: string;
  waveformData?: number[];
  order: number;
}

interface RabbitModeSegmentDisplayProps {
  segments: Segment[];
  onDeleteSegment: (segmentId: string) => void;
  onReorderSegment: (segmentId: string, direction: 'up' | 'down') => void;
  readOnly?: boolean;
  compact?: boolean;
}

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${remainingSeconds}s`;
};

export const RabbitModeSegmentDisplay: React.FC<
  RabbitModeSegmentDisplayProps
> = ({
  segments,
  onDeleteSegment,
  onReorderSegment,
  readOnly = false,
  compact = false
}) => {
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);

  if (segments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="mic-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.emptyText}>
          No recordings yet - start speaking!
        </Text>
      </View>
    );
  }

  // Sort segments by order
  const sortedSegments = [...segments].sort((a, b) => a.order - b.order);

  const handlePlaySegment = (segmentId: string) => {
    setPlayingSegmentId(segmentId);
  };

  const handlePauseSegment = () => {
    setPlayingSegmentId(null);
  };

  const handleStopSegment = () => {
    setPlayingSegmentId(null);
  };

  return (
    <View style={styles.container}>
      {!compact && (
        <Text style={styles.title}>Recordings ({segments.length})</Text>
      )}

      {sortedSegments.map((segment, index) => {
        const canMoveUp = index > 0;
        const canMoveDown = index < sortedSegments.length - 1;
        const isPlaying = playingSegmentId === segment.id;

        return (
          <View
            key={segment.id}
            style={[
              styles.segmentItem,
              compact ? styles.segmentItemCompact : undefined
            ]}
          >
            <View style={styles.segmentContent}>
              {!compact && (
                <View style={styles.segmentHeader}>
                  <Text style={styles.segmentNumber}>#{index + 1}</Text>
                  <Text style={styles.segmentDuration}>
                    {formatDuration(segment.duration)}
                  </Text>
                </View>
              )}

              <PlayableWaveform
                audioUri={segment.audioUri}
                waveformData={segment.waveformData}
                duration={segment.duration}
                isPlaying={isPlaying}
                onPlay={() => handlePlaySegment(segment.id)}
                onPause={handlePauseSegment}
                onStop={handleStopSegment}
                style={[
                  styles.playableWaveform,
                  compact ? styles.playableWaveformCompact : undefined
                ]}
              />
            </View>

            {!readOnly && !compact && (
              <View style={styles.segmentControls}>
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    !canMoveUp && styles.controlButtonDisabled
                  ]}
                  onPress={() =>
                    canMoveUp && onReorderSegment(segment.id, 'up')
                  }
                  disabled={!canMoveUp}
                >
                  <Ionicons
                    name="chevron-up"
                    size={16}
                    color={canMoveUp ? colors.text : colors.disabled}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    !canMoveDown && styles.controlButtonDisabled
                  ]}
                  onPress={() =>
                    canMoveDown && onReorderSegment(segment.id, 'down')
                  }
                  disabled={!canMoveDown}
                >
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={canMoveDown ? colors.text : colors.disabled}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => onDeleteSegment(segment.id)}
                >
                  <Ionicons name="trash" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.small
  },
  title: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.small,
    paddingHorizontal: spacing.medium
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.large,
    paddingHorizontal: spacing.medium
  },
  emptyText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.small,
    fontStyle: 'italic'
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.small,
    padding: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  segmentContent: {
    flex: 1,
    marginRight: spacing.small
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xsmall
  },
  segmentNumber: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 24,
    textAlign: 'center'
  },
  segmentDuration: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  playableWaveform: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0
  },
  playableWaveformCompact: {
    padding: 0
  },
  segmentControls: {
    alignItems: 'center',
    gap: spacing.xsmall
  },
  controlButton: {
    padding: spacing.xsmall,
    borderRadius: 4
  },
  controlButtonDisabled: {
    opacity: 0.3
  },
  deleteButton: {
    padding: spacing.xsmall,
    borderRadius: 4,
    backgroundColor: colors.inputBackground
  },
  segmentItemCompact: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: spacing.small,
    marginBottom: spacing.xsmall
  }
});
