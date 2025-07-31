import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

const MiniWaveform: React.FC<{
  data?: number[];
  color?: string;
}> = ({ data = [], color = colors.primary }) => {
  // Generate mock data if none provided
  const waveformData =
    data.length > 0 ? data : Array.from({ length: 20 }, () => Math.random());

  return (
    <View style={styles.waveformContainer}>
      {waveformData.map((level, index) => {
        const height = Math.max(4, level * 20);
        return (
          <View
            key={index}
            style={[
              styles.waveformBar,
              {
                height,
                backgroundColor: color
              }
            ]}
          />
        );
      })}
    </View>
  );
};

export const RabbitModeSegmentDisplay: React.FC<
  RabbitModeSegmentDisplayProps
> = ({ segments, onDeleteSegment, onReorderSegment, readOnly = false }) => {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recordings ({segments.length})</Text>

      {sortedSegments.map((segment, index) => {
        const canMoveUp = index > 0;
        const canMoveDown = index < sortedSegments.length - 1;

        return (
          <View key={segment.id} style={styles.segmentItem}>
            <View style={styles.segmentContent}>
              <View style={styles.segmentHeader}>
                <Text style={styles.segmentNumber}>#{index + 1}</Text>
                <Text style={styles.segmentDuration}>
                  {formatDuration(segment.duration)}
                </Text>
              </View>

              <MiniWaveform
                data={segment.waveformData}
                color={colors.primary}
              />
            </View>

            {!readOnly && (
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
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    backgroundColor: colors.background,
    borderRadius: 4,
    padding: 2,
    gap: 1
  },
  waveformBar: {
    width: 3,
    borderRadius: 1,
    minHeight: 4
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
  }
});
