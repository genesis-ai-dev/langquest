import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMicrophoneEnergy } from '../hooks/useMicrophoneEnergy';
import { colors, fontSizes, spacing } from '../styles/theme';

// Global recording state to prevent multiple concurrent recordings
let globalRecordingInstance: Audio.Recording | null = null;
let globalRecordingInProgress = false;

interface EnergyVADRecorderProps {
  onRecordingComplete: (uri: string, segmentIndex: number) => void;
  energyThreshold?: number;
  showEnergyVisualization?: boolean;
}

const EnergyVADRecorder: React.FC<EnergyVADRecorderProps> = ({
  onRecordingComplete,
  energyThreshold = 0.03,
  showEnergyVisualization = true
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentEnergy, setCurrentEnergy] = useState(0);
  const [threshold, setThreshold] = useState(energyThreshold);
  const [segmentCount, setSegmentCount] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const {
    isActive,
    energyResult,
    startEnergyDetection,
    stopEnergyDetection,
    clearError,
    error
  } = useMicrophoneEnergy();

  // Initialize: Clean up any orphaned recording state on mount
  useEffect(() => {
    if (globalRecordingInstance && !isRecording) {
      console.log('Cleaning up orphaned recording on mount');
      globalRecordingInstance.stopAndUnloadAsync().catch((_error) => {
        console.log('Orphaned recording already cleaned up');
      });
      globalRecordingInstance = null;
      globalRecordingInProgress = false;
    }
  }, [isRecording]); // Run only on mount

  // Handle energy levels and control recording
  useEffect(() => {
    if (!energyResult || !isActive) return;

    setCurrentEnergy(energyResult.energy);

    // Pure energy-based decision - no native speech detection
    const shouldRecord = energyResult.energy > threshold;

    if (shouldRecord && !isRecording) {
      // Start recording immediately when energy crosses threshold
      void startRecording();
    } else if (!shouldRecord && isRecording) {
      // Stop recording immediately when energy drops below threshold
      void stopRecording();
    }
  }, [
    energyResult,
    isActive,
    isRecording,
    threshold,
    startRecording,
    stopRecording
  ]);

  const startRecording = useCallback(async () => {
    try {
      // Prevent starting if already recording globally or locally
      if (
        globalRecordingInProgress ||
        isRecording ||
        recordingRef.current ||
        globalRecordingInstance
      ) {
        console.log('Recording already in progress (global or local)');
        return;
      }

      console.log('Starting expo-av recording (energy-triggered)...');
      globalRecordingInProgress = true;

      // Small delay to ensure any previous recording is fully cleaned up
      await new Promise((resolve) => setTimeout(resolve, 50));

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      globalRecordingInstance = recording;
      recordingRef.current = recording;
      setIsRecording(true);
      globalRecordingInProgress = false;
    } catch (error) {
      console.error('Failed to start recording:', error);
      // Clean up all state on error
      globalRecordingInstance = null;
      recordingRef.current = null;
      setIsRecording(false);
      globalRecordingInProgress = false;
    }
  }, [isRecording]);

  const stopRecording = useCallback(async () => {
    try {
      console.log('Stopping expo-av recording...');

      const recordingToStop = recordingRef.current || globalRecordingInstance;

      if (!recordingToStop || !isRecording) {
        console.log('No active recording to stop');
        // Clean up all state
        globalRecordingInstance = null;
        recordingRef.current = null;
        setIsRecording(false);
        globalRecordingInProgress = false;
        return;
      }

      // Check if recording is actually in progress
      const status = await recordingToStop.getStatusAsync();
      if (!status.isRecording) {
        console.log('Recording is not active, cleaning up reference');
        globalRecordingInstance = null;
        recordingRef.current = null;
        setIsRecording(false);
        globalRecordingInProgress = false;
        return;
      }

      await recordingToStop.stopAndUnloadAsync();
      const uri = recordingToStop.getURI();

      // Clean up all references
      globalRecordingInstance = null;
      recordingRef.current = null;
      setIsRecording(false);
      globalRecordingInProgress = false;

      if (uri) {
        const currentSegment = segmentCount;
        setSegmentCount((prev) => prev + 1);
        console.log(
          `Energy-based recording segment ${currentSegment} saved:`,
          uri
        );
        onRecordingComplete(uri, currentSegment);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      // Clean up all state even if stopping failed
      globalRecordingInstance = null;
      recordingRef.current = null;
      setIsRecording(false);
      globalRecordingInProgress = false;
    }
  }, [onRecordingComplete, isRecording, segmentCount]);

  const handleToggleEnergyDetection = useCallback(async () => {
    try {
      if (isActive) {
        if (isRecording) {
          await stopRecording();
        }
        await stopEnergyDetection();

        // Clean up global state when stopping energy detection
        globalRecordingInstance = null;
        globalRecordingInProgress = false;
        setSegmentCount(0); // Reset segment count when stopping detection
      } else {
        await startEnergyDetection();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle energy detection');
      console.error('Energy detection toggle error:', error);
      // Clean up state on error
      globalRecordingInstance = null;
      recordingRef.current = null;
      setIsRecording(false);
      globalRecordingInProgress = false;
    }
  }, [
    isActive,
    isRecording,
    stopRecording,
    stopEnergyDetection,
    startEnergyDetection
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up recording if it exists (check both local and global)
      const recordingToCleanup =
        recordingRef.current || globalRecordingInstance;
      if (recordingToCleanup) {
        recordingToCleanup.stopAndUnloadAsync().catch((_error) => {
          console.log('Cleanup: Recording already stopped or released');
        });
      }

      // Reset all recording state
      globalRecordingInstance = null;
      recordingRef.current = null;
      setIsRecording(false);
      globalRecordingInProgress = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Energy-Based VAD Recorder</Text>

      {/* Energy Detection Button */}
      <TouchableOpacity
        style={[styles.vadButton, isActive && styles.vadButtonActive]}
        onPress={handleToggleEnergyDetection}
      >
        <Ionicons
          name={isActive ? 'stop-circle' : 'play-circle'}
          size={40}
          color="white"
        />
        <Text style={styles.buttonText}>
          {isActive ? 'Stop Energy Detection' : 'Start Energy Detection'}
        </Text>
      </TouchableOpacity>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {!isActive && '⏹️ Energy detection stopped'}
          {isActive &&
            !isRecording &&
            `👂 Listening for energy... (${segmentCount} segments recorded)`}
          {isRecording &&
            `🔴 Recording segment ${segmentCount + 1} (energy above threshold)`}
        </Text>

        {isActive && (
          <Text style={styles.energyText}>
            Energy: {currentEnergy.toFixed(3)}
            {currentEnergy > threshold ? ' ⚡' : ' 💤'}
          </Text>
        )}

        {isActive && showEnergyVisualization && (
          <View style={styles.thresholdContainer}>
            <Text style={styles.thresholdLabel}>
              Recording Threshold: {threshold.toFixed(3)}
            </Text>

            {/* Simple threshold buttons */}
            <View style={styles.thresholdButtons}>
              <TouchableOpacity
                style={styles.thresholdButton}
                onPress={() => setThreshold(0.01)}
              >
                <Text style={styles.thresholdButtonText}>Sensitive</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.thresholdButton}
                onPress={() => setThreshold(0.03)}
              >
                <Text style={styles.thresholdButtonText}>Normal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.thresholdButton}
                onPress={() => setThreshold(0.06)}
              >
                <Text style={styles.thresholdButtonText}>Loud</Text>
              </TouchableOpacity>
            </View>

            {/* Energy Bar Visualization */}
            <View style={styles.energyBarContainer}>
              <View style={styles.energyBar}>
                <View
                  style={[
                    styles.energyLevel,
                    {
                      width: `${Math.min(100, currentEnergy * 1000)}%`,
                      backgroundColor:
                        currentEnergy > threshold
                          ? colors.primary
                          : colors.disabled
                    }
                  ]}
                />
              </View>
              <View style={styles.thresholdMarker}>
                <View
                  style={[
                    styles.thresholdLine,
                    { left: `${Math.min(100, threshold * 1000)}%` }
                  ]}
                />
              </View>
            </View>

            <Text style={styles.helpText}>
              Recording starts when energy bar crosses the threshold line
            </Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Text style={styles.clearErrorText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.large
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.large
  },
  vadButton: {
    backgroundColor: colors.disabled,
    paddingVertical: spacing.large,
    paddingHorizontal: spacing.xlarge,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  vadButtonActive: {
    backgroundColor: colors.primary
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    marginTop: spacing.small
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  statusText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.small
  },
  energyText: {
    fontSize: fontSizes.large,
    color: colors.text,
    fontWeight: 'bold'
  },
  thresholdContainer: {
    alignItems: 'center',
    marginTop: spacing.medium,
    marginBottom: spacing.medium,
    width: '100%'
  },
  thresholdLabel: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.medium,
    fontWeight: 'bold'
  },
  thresholdButtons: {
    flexDirection: 'row',
    gap: spacing.small,
    marginBottom: spacing.medium
  },
  thresholdButton: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: 6
  },
  thresholdButtonText: {
    fontSize: fontSizes.small,
    color: colors.primary,
    fontWeight: 'bold'
  },
  energyBarContainer: {
    width: '100%',
    marginBottom: spacing.small,
    position: 'relative'
  },
  energyBar: {
    width: '100%',
    height: 20,
    backgroundColor: colors.disabled + '40',
    borderRadius: 10,
    overflow: 'hidden'
  },
  energyLevel: {
    height: '100%',
    borderRadius: 10
  },
  thresholdMarker: {
    position: 'absolute',
    top: 0,
    height: 20,
    width: '100%'
  },
  thresholdLine: {
    width: 2,
    height: '100%',
    backgroundColor: colors.error,
    borderRadius: 2
  },
  helpText: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  errorContainer: {
    flexDirection: 'row',
    backgroundColor: colors.error + '20',
    padding: spacing.medium,
    borderRadius: 8,
    width: '100%'
  },
  errorText: {
    fontSize: fontSizes.small,
    color: colors.error,
    flex: 1
  },
  clearErrorText: {
    fontSize: fontSizes.small,
    color: colors.primary,
    textDecorationLine: 'underline'
  }
});

export default EnergyVADRecorder;
