import type { BibleBook, BibleReference } from '@/constants/bibleStructure';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import { useAudio } from '@/contexts/AudioContext';
import { useLocalization } from '@/hooks/useLocalization';
import { useSimpleVAD } from '@/hooks/useVoiceActivityDetection';
import { useLocalStore } from '@/store/localStore';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BOOK_EMOJIS } from '../utils/BOOK_EMOJIS';

// Separate OT and NT books
const OLD_TESTAMENT_BOOKS = BIBLE_BOOKS.slice(0, 39);
const NEW_TESTAMENT_BOOKS = BIBLE_BOOKS.slice(39);

interface BookGridProps {
  books: BibleBook[];
  title: string;
  onBookSelect: (book: BibleBook) => void;
  selectedBook: BibleBook | null;
}

const BookGrid: React.FC<BookGridProps> = ({
  books,
  title,
  onBookSelect,
  selectedBook
}) => {
  return (
    <View style={styles.testamentSection}>
      <Text style={styles.testamentTitle}>{title}</Text>
      <View style={styles.bookGrid}>
        {books.map((book) => (
          <TouchableOpacity
            key={book.id}
            style={[
              styles.bookCard,
              selectedBook?.id === book.id && styles.selectedBookCard
            ]}
            onPress={() => onBookSelect(book)}
          >
            <Text style={styles.bookEmoji}>{BOOK_EMOJIS[book.id] || '📖'}</Text>
            <Text
              style={[
                styles.bookName,
                selectedBook?.id === book.id && styles.selectedBookName
              ]}
            >
              {book.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Mini waveform component
const MiniWaveform: React.FC<{
  isListening: boolean;
  isRecording: boolean;
  level: number;
  levels: number[];
}> = ({ isListening, isRecording, level, levels }) => {
  return (
    <View style={styles.miniWaveform}>
      {Array.from({ length: 20 }, (_, i) => {
        const segmentLevel = levels[i] || level;
        const height = Math.max(4, segmentLevel * 30);
        return (
          <View
            key={i}
            style={[
              styles.miniWaveformBar,
              {
                height,
                backgroundColor: !isListening
                  ? colors.textSecondary
                  : isRecording
                    ? colors.primary
                    : colors.accent
              }
            ]}
          />
        );
      })}
    </View>
  );
};

const RapidRecordingView = () => {
  const { t: _t } = useLocalization();
  const { playSound, stopCurrentSound, isPlaying, currentAudioId } = useAudio();

  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [speechStartTime, setSpeechStartTime] = useState<number | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);

  // Generate a stable temporary quest ID for this recording session
  const [tempQuestId] = useState(() => `rapid-recording-${Date.now()}`);

  const levelHistoryRef = useRef<number[]>([]);

  // Use refs to store current state values for VAD callbacks
  const selectedBookRef = useRef<BibleBook | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);

  // Update refs whenever state changes
  useEffect(() => {
    selectedBookRef.current = selectedBook;
  }, [selectedBook]);

  useEffect(() => {
    speechStartTimeRef.current = speechStartTime;
  }, [speechStartTime]);

  const {
    getRecordingSession,
    createRecordingSession,
    addAudioSegment,
    deleteAudioSegment
  } = useLocalStore();

  // Get or create recording session
  const recordingSession = getRecordingSession(tempQuestId);

  // Initialize recording session when book is selected
  useEffect(() => {
    if (selectedBook && !recordingSession) {
      const initialReference: BibleReference = {
        book: selectedBook.id,
        chapter: 1,
        verse: 1
      };

      createRecordingSession(
        tempQuestId,
        `${selectedBook.name} Rapid Recording`,
        'rapid-recording-project',
        initialReference
      );
    }
  }, [selectedBook, recordingSession, createRecordingSession, tempQuestId]);

  // Handle level updates for waveform
  const handleLevelChange = useCallback((level: number) => {
    levelHistoryRef.current.push(level);
    if (levelHistoryRef.current.length > 20) {
      levelHistoryRef.current.shift();
    }
    setAudioLevels([...levelHistoryRef.current]);
  }, []);

  // We'll store VAD functions in refs to use them in handlers
  const vadFunctionsRef = useRef<{
    startListening: () => Promise<void>;
    stopListening: () => Promise<void>;
  } | null>(null);

  // Speech start handler - just mark the time
  const handleSpeechStart = useCallback(() => {
    console.log('Speech started - marking time');
    const startTime = Date.now();
    setSpeechStartTime(startTime);
    speechStartTimeRef.current = startTime; // Update ref immediately
    setIsRecordingActive(true);
  }, []);

  // Speech end handler - stop VAD and save the recording
  const handleSpeechEnd = useCallback(() => {
    console.log('Speech ended - saving segment');

    const saveSegment = async () => {
      // Use refs to get current values instead of state
      const currentSpeechStartTime = speechStartTimeRef.current;
      const currentSelectedBook = selectedBookRef.current;

      // Log all the data we have for debugging
      console.log('=== SEGMENT CREATION DEBUG ===');
      console.log('speechStartTime (from ref):', currentSpeechStartTime);
      console.log(
        'selectedBook (from ref):',
        currentSelectedBook
          ? { id: currentSelectedBook.id, name: currentSelectedBook.name }
          : null
      );
      console.log(
        'recordingSession:',
        recordingSession
          ? {
              id: recordingSession.id,
              segments: recordingSession.segments.length
            }
          : null
      );
      console.log('tempQuestId:', tempQuestId);

      if (!currentSpeechStartTime || !currentSelectedBook) {
        console.log('❌ Missing required data for segment creation:');
        console.log('  - speechStartTime exists:', !!currentSpeechStartTime);
        console.log('  - selectedBook exists:', !!currentSelectedBook);
        console.log('  - speechStartTime value:', currentSpeechStartTime);
        console.log('  - selectedBook value:', currentSelectedBook);
        setIsRecordingActive(false);
        setSpeechStartTime(null);
        speechStartTimeRef.current = null;
        return;
      }

      console.log('✅ All required data present, creating segment...');

      try {
        // Temporarily stop VAD to access its recording
        console.log('Stopping VAD to save recording...');
        if (vadFunctionsRef.current?.stopListening) {
          await vadFunctionsRef.current.stopListening();
        }

        // Give VAD time to stop cleanly
        await new Promise((resolve) => setTimeout(resolve, 100));

        // At this point, VAD should have stopped and we should have access to its recording
        // We'll need to implement a way to get the recording URI from VAD
        // For now, let's create a simple recorded segment

        const recordingsDir = `${FileSystem.documentDirectory}rapid-recordings/`;
        await FileSystem.makeDirectoryAsync(recordingsDir, {
          intermediates: true
        });

        // Create a placeholder segment (we'll improve this once we can access VAD's recording)
        const timestamp = Date.now();
        const duration = timestamp - currentSpeechStartTime;
        const currentReference: BibleReference = {
          book: currentSelectedBook.id,
          chapter: 1,
          verse: Math.max(1, (recordingSession?.segments.length || 0) + 1)
        };

        // For now, create a mock segment - we'll need to modify VAD to give us the actual audio
        const mockAudioUri = `${recordingsDir}mock_${currentSelectedBook.id}_${timestamp}.m4a`;

        console.log('Creating segment with data:');
        console.log('  - audioUri:', mockAudioUri);
        console.log('  - startTime:', currentSpeechStartTime);
        console.log('  - endTime:', timestamp);
        console.log('  - duration:', duration);
        console.log('  - verse:', currentReference);

        addAudioSegment(tempQuestId, {
          audioUri: mockAudioUri,
          startTime: currentSpeechStartTime,
          endTime: timestamp,
          duration,
          verse: currentReference
        });

        console.log('✅ Audio segment added to timeline successfully');

        // Reset state
        setIsRecordingActive(false);
        setSpeechStartTime(null);
        speechStartTimeRef.current = null;

        // Restart VAD after a short delay
        setTimeout(() => {
          console.log('Restarting VAD...');
          if (vadFunctionsRef.current?.startListening) {
            void vadFunctionsRef.current.startListening();
          }
        }, 200);
      } catch (error) {
        console.error('❌ Error saving segment:', error);
        setIsRecordingActive(false);
        setSpeechStartTime(null);
        speechStartTimeRef.current = null;
      }
    };

    void saveSegment();
  }, [
    // Remove state dependencies since we're using refs
    addAudioSegment,
    recordingSession?.segments.length,
    tempQuestId
  ]);

  // Initialize VAD with simplified handlers
  const {
    startListening,
    stopListening,
    isListening,
    isSpeaking: _isSpeaking,
    currentLevel
  } = useSimpleVAD(handleSpeechStart, handleSpeechEnd, {
    sensitive: true,
    fastResponse: true
  });

  // Store VAD functions in ref
  useEffect(() => {
    vadFunctionsRef.current = { startListening, stopListening };
  }, [startListening, stopListening]);

  // Update levels for waveform display
  useEffect(() => {
    handleLevelChange(currentLevel);
  }, [currentLevel, handleLevelChange]);

  const handleBookSelect = (book: BibleBook) => {
    setSelectedBook(book);

    // Start VAD after a delay - this should work now since we're not creating competing Recording objects
    setTimeout(() => {
      console.log('Starting VAD...');
      void startListening();
    }, 500);
  };

  const handleBackToBookSelection = () => {
    void stopListening();

    // Clean up current recording
    // The VAD's recording object is managed internally, so we don't need to do anything here
    // unless we want to clear the mock segments we created.
    // For now, we'll just reset the state.
    setSelectedBook(null);
    setIsRecordingActive(false);
    setSpeechStartTime(null);
    setAudioLevels([]);
  };

  const handleDeleteSegment = useCallback(
    (segmentId: string) => {
      const segment = recordingSession?.segments.find(
        (s: any) => s.id === segmentId
      );
      if (!segment) return;

      Alert.alert(
        'Delete Recording',
        'Are you sure you want to delete this recording?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const deleteSegment = async () => {
                try {
                  // Delete the audio file
                  await FileSystem.deleteAsync(segment.audioUri, {
                    idempotent: true
                  });
                  // Remove from store
                  deleteAudioSegment(tempQuestId, segmentId);
                } catch (error) {
                  console.error('Error deleting segment:', error);
                }
              };
              void deleteSegment();
            }
          }
        ]
      );
    },
    [recordingSession, deleteAudioSegment, tempQuestId]
  );

  const handlePlaySegment = useCallback(
    (segment: { id: string; audioUri: string }) => {
      if (isPlaying && currentAudioId === segment.id) {
        void stopCurrentSound();
      } else {
        void playSound(segment.audioUri, segment.id);
      }
    },
    [isPlaying, currentAudioId, playSound, stopCurrentSound]
  );

  // Show book selection if no book is selected
  if (!selectedBook) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Select Book for Rapid Recording</Text>
        <Text style={styles.subtitle}>
          Choose a book to begin voice-activated recording
        </Text>

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <BookGrid
            books={OLD_TESTAMENT_BOOKS}
            title="Old Testament"
            onBookSelect={handleBookSelect}
            selectedBook={selectedBook}
          />

          <BookGrid
            books={NEW_TESTAMENT_BOOKS}
            title="New Testament"
            onBookSelect={handleBookSelect}
            selectedBook={selectedBook}
          />
        </ScrollView>
      </View>
    );
  }

  // Show recording interface
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToBookSelection}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Rapid Recording</Text>
      </View>

      {/* Book Info */}
      <View style={styles.bookInfo}>
        <Text style={styles.bookEmoji}>
          {BOOK_EMOJIS[selectedBook.id] || '📖'}
        </Text>
        <Text style={styles.bookTitle}>{selectedBook.name}</Text>
      </View>

      {/* VAD Status with Mini Waveform */}
      <View style={styles.vadStatus}>
        <MiniWaveform
          isListening={isListening}
          isRecording={isRecordingActive}
          level={currentLevel}
          levels={audioLevels}
        />
        <Text style={styles.vadText}>
          {!isListening
            ? 'Getting ready...'
            : isRecordingActive
              ? 'Recording...'
              : 'Listening...'}
        </Text>
      </View>

      {/* Timeline */}
      <ScrollView
        style={styles.timeline}
        contentContainerStyle={styles.timelineContent}
      >
        {recordingSession?.segments.map((segment: any) => (
          <View key={segment.id} style={styles.segmentCard}>
            <TouchableOpacity
              style={styles.segmentMenuButton}
              onPress={() => handleDeleteSegment(segment.id)}
            >
              <Ionicons name="trash" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.waveformContainer}>
              <View style={styles.waveform}>
                {/* Placeholder waveform */}
                {Array.from({ length: 40 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      { height: Math.random() * 20 + 5 }
                    ]}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.segmentPlayButton}
              onPress={() => handlePlaySegment(segment)}
            >
              <Ionicons
                name={
                  isPlaying && currentAudioId === segment.id ? 'pause' : 'play'
                }
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        ))}

        {recordingSession?.segments.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Start speaking to record audio segments
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.large
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.large
  },
  backButton: {
    padding: spacing.small,
    marginRight: spacing.medium
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.large
  },
  bookInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.large
  },
  bookEmoji: {
    fontSize: 32,
    marginRight: spacing.medium
  },
  bookTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  vadStatus: {
    alignItems: 'center',
    marginBottom: spacing.large
  },
  miniWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    marginBottom: spacing.small,
    paddingHorizontal: spacing.medium
  },
  miniWaveformBar: {
    width: 3,
    backgroundColor: colors.textSecondary,
    marginHorizontal: 1,
    borderRadius: 1.5,
    minHeight: 4
  },
  vadText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  timeline: {
    flex: 1
  },
  timelineContent: {
    paddingBottom: spacing.xlarge
  },
  segmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small
  },
  segmentMenuButton: {
    padding: spacing.small,
    marginRight: spacing.small
  },
  waveformContainer: {
    flex: 1,
    marginHorizontal: spacing.small
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40
  },
  waveformBar: {
    width: 2,
    backgroundColor: colors.textSecondary,
    marginHorizontal: 1,
    borderRadius: 1
  },
  segmentPlayButton: {
    padding: spacing.small,
    marginLeft: spacing.small
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xlarge
  },
  emptyStateText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  scrollContainer: {
    flex: 1
  },
  testamentSection: {
    marginBottom: spacing.xlarge
  },
  testamentTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.medium,
    textAlign: 'center'
  },
  bookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  bookCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.small,
    width: '48%',
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  selectedBookCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  bookName: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center'
  },
  selectedBookName: {
    color: colors.background
  }
});

export default RapidRecordingView;
