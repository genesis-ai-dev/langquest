import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LiveWaveformProps {
  isListening: boolean;
  isRecording: boolean;
  isSpeaking?: boolean;
  isSaving?: boolean;
  currentLevel: number;
  onStartListening: () => void;
  onStopListening: () => void;
  style?: ViewStyle;
  waveformData?: number[]; // Optional sine wave or placeholder data
}

export const LiveWaveform: React.FC<LiveWaveformProps> = ({
  isListening,
  isRecording: _isRecording,
  isSpeaking = false,
  isSaving = false,
  currentLevel,
  onStartListening,
  onStopListening,
  style,
  waveformData
}) => {
  // Helper function for creating properly typed arrays
  const createZeroArray = (length: number): number[] =>
    Array.from({ length }, () => 0);

  const levelHistoryRef = useRef<number[]>(createZeroArray(40));
  const animationFrameRef = useRef<number | null>(null);
  const [displayLevels, setDisplayLevels] = React.useState<number[]>(
    createZeroArray(40)
  );

  // Smooth animation loop for waveform updates
  useEffect(() => {
    if (isListening) {
      const animate = () => {
        // Use provided waveformData or real-time levels
        if (waveformData && waveformData.length > 0) {
          // Use provided sine wave or placeholder data
          const safeWaveformData = waveformData
            .filter((val): val is number => typeof val === 'number')
            .slice(0, 40);

          // Pad with zeros if needed
          while (safeWaveformData.length < 40) {
            safeWaveformData.push(0);
          }

          setDisplayLevels(safeWaveformData);
        } else {
          // Add new level to history (real-time mode)
          levelHistoryRef.current.shift();
          levelHistoryRef.current.push(currentLevel);
          setDisplayLevels([...levelHistoryRef.current]);
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Reset levels when not listening
      levelHistoryRef.current = createZeroArray(40);
      setDisplayLevels(createZeroArray(40));
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, currentLevel, waveformData]);

  // If not listening, show big record button
  if (!isListening) {
    return (
      <TouchableOpacity
        style={[styles.recordButton, style]}
        onPress={onStartListening}
        activeOpacity={0.9}
      >
        <View style={styles.recordGlow} />
        <View style={styles.recordInnerCircle}>
          <Ionicons name="mic" size={36} color={colors.background} />
        </View>
        <Text style={styles.recordButtonText}>Tap to start</Text>
      </TouchableOpacity>
    );
  }

  // If listening, show interactive waveform
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.waveformButton,
          {
            backgroundColor: isSpeaking ? '#22c55e' : colors.inputBackground,
            borderColor: isSpeaking ? '#22c55e' : colors.primary
          }
        ]}
        onPress={onStopListening}
        activeOpacity={0.9}
      >
        <View style={styles.waveformDisplay}>
          {displayLevels.map((level, index) => {
            const height = Math.max(4, level * 60);
            const opacity = Math.max(0.25, level);

            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor: isSpeaking
                      ? colors.background
                      : colors.primary,
                    opacity
                  }
                ]}
              />
            );
          })}
        </View>

        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: isSpeaking ? colors.background : colors.primary
              }
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isSpeaking ? colors.background : colors.primary }
            ]}
          >
            {isSpeaking ? 'Speaking...' : 'Listening...'}
          </Text>
          {isSaving && (
            <View style={styles.savingPill}>
              <Ionicons
                name="cloud-upload"
                size={16}
                color={colors.background}
              />
              <Text style={styles.savingText}>Saving…</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Pause/Stop button overlay */}
      <TouchableOpacity
        style={styles.stopButton}
        onPress={onStopListening}
        activeOpacity={0.8}
      >
        <Ionicons
          name="stop"
          size={20}
          color={isSpeaking ? '#22c55e' : colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  recordButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 80,
    width: 160,
    height: 160
  },
  recordGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    opacity: 0.15
  },
  recordInnerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 56,
    width: 112,
    height: 112,
    borderWidth: 2,
    borderColor: colors.primary
  },
  recordButtonText: {
    color: colors.text,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginTop: spacing.small
  },
  waveformButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 132,
    height: 132,
    borderRadius: 16,
    borderWidth: 2,
    padding: spacing.small
  },
  waveformDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    width: 108,
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 4,
    marginBottom: spacing.xsmall,
    overflow: 'hidden'
  },
  waveformBar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 1,
    minHeight: 4
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xsmall
  },
  statusText: {
    fontSize: fontSizes.xsmall,
    fontWeight: '600'
  },
  savingPill: {
    marginLeft: spacing.small,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  savingText: {
    color: colors.background,
    fontSize: fontSizes.xsmall,
    fontWeight: '600'
  },
  stopButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.background,
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.inputBorder,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  }
});
