import type { BibleReference } from '@/constants/bibleStructure';
import {
  formatBibleReference,
  getNextVerse,
  getPreviousVerse
} from '@/constants/bibleStructure';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { useSimpleVAD } from '@/hooks/useVoiceActivityDetection';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Types for the recording session
interface RecordingSegment {
  id: string;
  startTime: number;
  endTime: number;
  audioUri: string;
  waveformData?: number[];
  isComplete: boolean;
  reference: BibleReference;
}

interface CachedProject {
  id: string;
  name: string;
  sourceLanguageId: string;
  targetLanguageId: string;
  currentReference: BibleReference;
  segments: RecordingSegment[];
  createdAt: number;
  lastModified: number;
}

interface BibleRecordingModalProps {
  isVisible: boolean;
  onClose: () => void;
  initialReference?: BibleReference;
  projectName?: string;
  sourceLanguageId: string;
  targetLanguageId: string;
  onSave: (project: CachedProject) => void;
}

export const BibleRecordingModal: React.FC<BibleRecordingModalProps> = ({
  isVisible,
  onClose,
  initialReference = { book: 'gen', chapter: 1, verse: 1 },
  projectName = 'Bible Translation',
  sourceLanguageId,
  targetLanguageId,
  onSave
}) => {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { stopCurrentSound } = useAudio();

  // Recording state
  const [_recording, setRecording] = useState<Audio.Recording | null>(null);
  const [currentSegment, setCurrentSegment] = useState<RecordingSegment | null>(
    null
  );
  const [segments, setSegments] = useState<RecordingSegment[]>([]);
  const [currentReference, setCurrentReference] =
    useState<BibleReference>(initialReference);
  const [isRecording, setIsRecording] = useState(false);
  const [showVADIndicator, setShowVADIndicator] = useState(false);
  const [_audioLevel, _setAudioLevel] = useState(0);

  // Session state
  const [sessionStartTime] = useState(Date.now());
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [_draggedSegmentId, _setDraggedSegmentId] = useState<string | null>(
    null
  );
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Refs for audio recording
  const recordingRef = useRef<Audio.Recording | null>(null);
  const segmentStartTimeRef = useRef<number>(0);
  const tempAudioFilesRef = useRef<string[]>([]);

  // VAD Configuration
  const vadCallbacks = {
    onSpeechStart: useCallback(() => {
      console.log('Speech detected - starting recording');
      void startRecordingSegment();
    }, []),

    onSpeechEnd: useCallback(() => {
      console.log('Speech ended - stopping recording');
      void stopRecordingSegment();
    }, [])
  };

  const vad = useSimpleVAD(
    vadCallbacks.onSpeechStart,
    vadCallbacks.onSpeechEnd,
    {
      sensitive: true,
      fastResponse: true
    }
  );

  // Audio level visualization
  const audioLevelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(audioLevelAnim, {
      toValue: _audioLevel,
      duration: 100,
      useNativeDriver: false
    }).start();
  }, [_audioLevel, audioLevelAnim]);

  // Start recording segment
  const startRecordingSegment = useCallback(async () => {
    if (isRecording || !currentUser) return;

    try {
      // Request permissions
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (permissionResponse.status !== Audio.PermissionStatus.GRANTED) {
        Alert.alert(t('error'), 'Microphone permission required');
        return;
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true
      });

      // Create new recording using the same pattern as AudioRecorder
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      segmentStartTimeRef.current = Date.now();

      // Create temporary segment
      const tempSegment: RecordingSegment = {
        id: `temp-${Date.now()}`,
        startTime: segmentStartTimeRef.current,
        endTime: 0,
        audioUri: '',
        isComplete: false,
        reference: currentReference
      };

      setCurrentSegment(tempSegment);
      setShowVADIndicator(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert(t('error'), 'Failed to start recording');
    }
  }, [isRecording, currentUser, currentReference, t]);

  // Stop recording segment
  const stopRecordingSegment = useCallback(async () => {
    if (!isRecording || !recordingRef.current || !currentSegment) return;

    try {
      setIsRecording(false);
      setShowVADIndicator(false);

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (uri) {
        // Create completed segment
        const completedSegment: RecordingSegment = {
          ...currentSegment,
          endTime: Date.now(),
          audioUri: uri,
          isComplete: true
        };

        // Add to segments list
        setSegments((prev) => [...prev, completedSegment]);

        // Track temp file for cleanup
        tempAudioFilesRef.current.push(uri);

        // Move to next verse
        const nextVerse = getNextVerse(currentReference);
        if (nextVerse) {
          setCurrentReference(nextVerse);
        }
      }

      // Clean up
      setCurrentSegment(null);
      setRecording(null);
      recordingRef.current = null;
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert(t('error'), 'Failed to stop recording');
    }
  }, [isRecording, currentSegment, currentReference, t]);

  // Manual recording control
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      void stopRecordingSegment();
    } else {
      void startRecordingSegment();
    }
  }, [isRecording, startRecordingSegment, stopRecordingSegment]);

  // Play segment
  const playSegment = useCallback(
    async (segment: RecordingSegment) => {
      try {
        void stopCurrentSound();

        const { sound } = await Audio.Sound.createAsync(
          { uri: segment.audioUri },
          { shouldPlay: true }
        );

        // Auto-cleanup when finished
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            void sound.unloadAsync();
          }
        });
      } catch (error) {
        console.error('Error playing segment:', error);
        Alert.alert(t('error'), 'Failed to play recording');
      }
    },
    [stopCurrentSound, t]
  );

  // Delete segment
  const deleteSegment = useCallback(
    async (segmentId: string) => {
      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;

      Alert.alert(
        'Delete Segment',
        'Are you sure you want to delete this recording segment?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete audio file
                const fileInfo = await FileSystem.getInfoAsync(
                  segment.audioUri
                );
                if (fileInfo.exists) {
                  await FileSystem.deleteAsync(segment.audioUri);
                }

                // Remove from segments
                setSegments((prev) => prev.filter((s) => s.id !== segmentId));
              } catch (error) {
                console.error('Error deleting segment:', error);
              }
            }
          }
        ]
      );
    },
    [segments, t]
  );

  // Navigate verses
  const goToPreviousVerse = useCallback(() => {
    const prevVerse = getPreviousVerse(currentReference);
    if (prevVerse) {
      setCurrentReference(prevVerse);
    }
  }, [currentReference]);

  const goToNextVerse = useCallback(() => {
    const nextVerse = getNextVerse(currentReference);
    if (nextVerse) {
      setCurrentReference(nextVerse);
    }
  }, [currentReference]);

  // Save session
  const saveSession = useCallback(async () => {
    if (segments.length === 0) {
      Alert.alert('No Segments', 'Please record some segments before saving');
      return;
    }

    try {
      const cachedProject: CachedProject = {
        id: `bible-${sessionStartTime}`,
        name: projectName,
        sourceLanguageId,
        targetLanguageId,
        currentReference,
        segments,
        createdAt: sessionStartTime,
        lastModified: Date.now()
      };

      onSave(cachedProject);
      onClose();
    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert(t('error'), 'Failed to save session');
    }
  }, [
    segments,
    sessionStartTime,
    projectName,
    sourceLanguageId,
    targetLanguageId,
    currentReference,
    onSave,
    onClose,
    t
  ]);

  // Session management
  const startSession = useCallback(() => {
    setIsSessionActive(true);
    vad.startListening();
  }, [vad]);

  const stopSession = useCallback(() => {
    setIsSessionActive(false);
    vad.stopListening();

    if (isRecording) {
      void stopRecordingSegment();
    }
  }, [vad, isRecording, stopRecordingSegment]);

  // Handle modal close
  const handleClose = useCallback(async () => {
    if (segments.length > 0) {
      setShowConfirmation(true);
      return;
    }

    await cleanup();
    onClose();
  }, [segments.length, onClose]);

  // Cleanup function
  const cleanup = useCallback(async () => {
    stopSession();
    void stopCurrentSound();

    // Clean up temporary audio files
    for (const uri of tempAudioFilesRef.current) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri);
        }
      } catch (error) {
        console.error('Error cleaning up temp file:', error);
      }
    }

    tempAudioFilesRef.current = [];
    setSegments([]);
    setCurrentSegment(null);
    setIsRecording(false);
  }, [stopSession, stopCurrentSound]);

  // Render segment item
  const renderSegment = useCallback(
    (segment: RecordingSegment, _index: number) => {
      const duration = segment.endTime - segment.startTime;
      const durationText = `${Math.round(duration / 1000)}s`;

      return (
        <View key={segment.id} style={styles.segmentItem}>
          <View style={styles.segmentHeader}>
            <Text style={styles.segmentReference}>
              {formatBibleReference(segment.reference)}
            </Text>
            <Text style={styles.segmentDuration}>{durationText}</Text>
          </View>

          <View style={styles.segmentControls}>
            <TouchableOpacity
              style={styles.segmentButton}
              onPress={() => playSegment(segment)}
            >
              <Ionicons name="play" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.segmentButton}
              onPress={() => deleteSegment(segment.id)}
            >
              <Ionicons name="trash" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [playSegment, deleteSegment]
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>{projectName}</Text>

          <TouchableOpacity onPress={saveSession}>
            <Ionicons name="save" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Current Verse */}
        <View style={styles.currentVerse}>
          <TouchableOpacity onPress={goToPreviousVerse}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.verseText}>
            {formatBibleReference(currentReference)}
          </Text>

          <TouchableOpacity onPress={goToNextVerse}>
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* VAD Indicator */}
        {showVADIndicator && (
          <View style={styles.vadIndicator}>
            <Animated.View
              style={[
                styles.vadBar,
                {
                  width: audioLevelAnim.interpolate({
                    inputRange: [-100, 0],
                    outputRange: [10, screenWidth - 40],
                    extrapolate: 'clamp'
                  })
                }
              ]}
            />
            <Text style={styles.vadText}>
              {isRecording ? 'Recording' : 'Listening'}
            </Text>
          </View>
        )}

        {/* Recording Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.sessionButton}
            onPress={isSessionActive ? stopSession : startSession}
          >
            <Ionicons
              name={isSessionActive ? 'stop' : 'play'}
              size={24}
              color={colors.buttonText}
            />
            <Text style={styles.sessionButtonText}>
              {isSessionActive ? 'Stop Session' : 'Start Session'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive
            ]}
            onPress={toggleRecording}
          >
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={32}
              color={colors.buttonText}
            />
          </TouchableOpacity>
        </View>

        {/* Segments List */}
        <View style={styles.segmentsContainer}>
          <Text style={styles.segmentsTitle}>
            Recorded Segments ({segments.length})
          </Text>

          <ScrollView style={styles.segmentsList}>
            {segments.map(renderSegment)}
          </ScrollView>
        </View>

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <View style={styles.confirmationOverlay}>
            <View style={styles.confirmationDialog}>
              <Text style={styles.confirmationTitle}>Unsaved Changes</Text>
              <Text style={styles.confirmationMessage}>
                You have unsaved recording segments. What would you like to do?
              </Text>

              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={[styles.confirmationButton, styles.cancelButton]}
                  onPress={() => setShowConfirmation(false)}
                >
                  <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmationButton, styles.saveButton]}
                  onPress={() => {
                    setShowConfirmation(false);
                    void saveSession();
                  }}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmationButton, styles.discardButton]}
                  onPress={() => {
                    setShowConfirmation(false);
                    void cleanup();
                    onClose();
                  }}
                >
                  <Text style={styles.discardButtonText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  currentVerse: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.large,
    backgroundColor: colors.backgroundSecondary
  },
  verseText: {
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    color: colors.text
  },
  vadIndicator: {
    alignItems: 'center',
    paddingVertical: spacing.medium
  },
  vadBar: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginBottom: spacing.small
  },
  vadText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: spacing.large
  },
  sessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.medium,
    gap: spacing.small
  },
  sessionButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  recordButtonActive: {
    backgroundColor: colors.primary
  },
  segmentsContainer: {
    flex: 1,
    padding: spacing.medium
  },
  segmentsTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.small
  },
  segmentsList: {
    flex: 1
  },
  segmentItem: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.medium,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.small,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  segmentHeader: {
    flex: 1
  },
  segmentReference: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text
  },
  segmentDuration: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  segmentControls: {
    flexDirection: 'row',
    gap: spacing.small
  },
  segmentButton: {
    padding: spacing.small,
    borderRadius: borderRadius.small
  },
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  confirmationDialog: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    margin: spacing.large,
    minWidth: 300
  },
  confirmationTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.small
  },
  confirmationMessage: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    marginBottom: spacing.large
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: spacing.small
  },
  confirmationButton: {
    flex: 1,
    padding: spacing.medium,
    borderRadius: borderRadius.medium,
    alignItems: 'center'
  },
  cancelButton: {
    backgroundColor: colors.backgroundSecondary
  },
  saveButton: {
    backgroundColor: colors.primary
  },
  discardButton: {
    backgroundColor: colors.error
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  saveButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  discardButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  }
});

export default BibleRecordingModal;
