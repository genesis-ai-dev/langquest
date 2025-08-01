import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LiveWaveformProps {
  isListening: boolean;
  isRecording: boolean;
  currentLevel: number;
  onStartListening: () => void;
  onStopListening: () => void;
  style?: ViewStyle;
  waveformData?: number[]; // Optional sine wave or placeholder data
}

export const LiveWaveform: React.FC<LiveWaveformProps> = ({
  isListening,
  isRecording,
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
        activeOpacity={0.8}
      >
        <Ionicons name="mic" size={32} color={colors.background} />
        <Text style={styles.recordButtonText}>Start Recording</Text>
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
            backgroundColor: isRecording
              ? colors.success
              : colors.inputBackground,
            borderColor: isRecording ? colors.success : colors.primary
          }
        ]}
        onPress={onStopListening}
        activeOpacity={0.9}
      >
        <View style={styles.waveformDisplay}>
          {displayLevels.map((level, index) => {
            const height = Math.max(4, level * 60);
            const opacity = Math.max(0.3, level);

            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor: isRecording
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
                backgroundColor: isRecording
                  ? colors.background
                  : colors.primary
              }
            ]}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: isRecording ? colors.background : colors.primary
              }
            ]}
          >
            {isRecording ? 'Recording...' : 'Listening...'}
          </Text>
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
          color={isRecording ? colors.success : colors.primary}
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
    backgroundColor: colors.primary,
    borderRadius: 75,
    width: 150,
    height: 150,
    borderWidth: 2,
    borderColor: colors.primary
  },
  recordButtonText: {
    color: colors.background,
    fontSize: fontSizes.small,
    fontWeight: 'bold',
    marginTop: spacing.xsmall
  },
  waveformButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    padding: spacing.small
  },
  waveformDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    width: 120,
    backgroundColor: 'transparent',
    borderRadius: 40,
    paddingHorizontal: 4,
    marginBottom: spacing.xsmall
  },
  waveformBar: {
    width: 2.5,
    marginHorizontal: 0.5,
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
