import type { BibleReference } from '@/constants/bibleStructure';
import { formatBibleReference, getNextVerse } from '@/constants/bibleStructure';
import { useAudio } from '@/contexts/AudioContext';
import { useLocalization } from '@/hooks/useLocalization';
import type { AssetMarker, AudioSegment } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Alert,
  Modal as RNModal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import AudioRecorder from './AudioRecorder';

interface QuestInProgressProps {
  isVisible: boolean;
  questId: string;
  questName: string;
  projectId: string;
  initialReference: BibleReference;
  onClose: () => void;
}

interface VerseMilestone {
  id: string;
  verse: BibleReference;
  type: 'milestone';
  order: number;
}

interface SegmentItem extends AudioSegment {
  type: 'segment';
  _belongsToVerse: BibleReference;
}

type TimelineItem = SegmentItem | VerseMilestone;

// Drop zone indicator component
const DropZone: React.FC<{
  isVisible: boolean;
  position: 'above' | 'below';
}> = ({ isVisible, position }) => {
  if (!isVisible) return null;

  return (
    <View
      style={[
        styles.dropZone,
        position === 'above' ? styles.dropZoneAbove : styles.dropZoneBelow
      ]}
    >
      <View style={styles.dropZoneLine} />
      <Text style={styles.dropZoneText}>Drop milestone here</Text>
    </View>
  );
};

// Separate component for draggable milestone to avoid hook issues
interface DraggableMilestoneProps {
  milestone: VerseMilestone;
  index: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete: (id: string) => void;
  totalItems: number;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  draggedIndex: number | null;
}

const DraggableMilestone: React.FC<DraggableMilestoneProps> = ({
  milestone,
  index,
  onReorder,
  onDelete,
  totalItems,
  onDragStart,
  onDragEnd,
  draggedIndex: _draggedIndex
}) => {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      isDragging.value = true;
      runOnJS(onDragStart)(index);
    },
    onActive: (event) => {
      translateY.value = event.translationY;
    },
    onEnd: () => {
      // Calculate drop position based on vertical movement
      const itemHeight = 80; // Approximate height of timeline items
      const dropOffset = Math.round(translateY.value / itemHeight);
      const newIndex = Math.max(
        0,
        Math.min(totalItems - 1, index + dropOffset)
      );

      if (newIndex !== index) {
        runOnJS(onReorder)(index, newIndex);
      }

      translateY.value = withSpring(0);
      isDragging.value = false;
      runOnJS(onDragEnd)();
    }
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      zIndex: isDragging.value ? 1000 : 1,
      opacity: isDragging.value ? 0.8 : 1,
      elevation: isDragging.value ? 10 : 0
    };
  });

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={[animatedStyle]}>
        <View style={styles.milestoneCard}>
          <View style={styles.milestoneContent}>
            <Text style={styles.milestoneText}>
              {milestone.verse.chapter}:{milestone.verse.verse}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.milestoneDeleteButton}
            onPress={() => onDelete(milestone.id)}
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </PanGestureHandler>
  );
};

export default function QuestInProgress({
  isVisible,
  questId,
  questName: _questName,
  projectId: _projectId,
  initialReference,
  onClose
}: QuestInProgressProps) {
  const { t } = useLocalization();
  const { playSound, stopCurrentSound, isPlaying, currentAudioId } = useAudio();

  const {
    getRecordingSession,
    addAudioSegment,
    deleteAudioSegment,
    addAssetMarker,
    updateRecordingSession
  } = useLocalStore();

  const [currentReference, setCurrentReference] = useState(initialReference);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>(() => [
    // Start with the initial verse milestone
    {
      id: `milestone_${initialReference.book}_${initialReference.chapter}_${initialReference.verse}`,
      verse: initialReference,
      type: 'milestone',
      order: 0
    }
  ]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Use ref to track if timeline has been loaded to prevent loops
  const timelineLoadedRef = useRef(false);

  // Load timeline from store on mount - only once
  useEffect(() => {
    if (timelineLoadedRef.current) return;

    const storedSession = getRecordingSession(questId);
    if (
      storedSession &&
      (storedSession.segments.length > 0 || storedSession.markers.length > 1)
    ) {
      const loadedSegments = storedSession.segments.map((seg, idx) => ({
        ...seg,
        type: 'segment',
        _belongsToVerse: seg.verse,
        order: idx * 2 // Even orders for segments
      })) as SegmentItem[];

      const loadedMilestones = storedSession.markers.map((marker, idx) => ({
        id: `milestone_${Date.now() + idx}`,
        verse: initialReference, // Replace with actual logic to determine verse
        type: 'milestone',
        order: idx * 2 + 1 // Odd orders for milestones
      })) as VerseMilestone[];

      setTimelineItems([...loadedSegments, ...loadedMilestones]);
    }

    timelineLoadedRef.current = true;
  }, [questId, getRecordingSession, initialReference]);

  // Stable update function to prevent loops
  const updateSessionData = useCallback(
    (items: TimelineItem[]) => {
      const segments = items
        .filter((item): item is SegmentItem => item.type === 'segment')
        .map(({ _belongsToVerse, ...seg }) => seg);
      const markers = items
        .filter((item): item is VerseMilestone => item.type === 'milestone')
        .map((m, idx) => ({
          title: `${m.verse.chapter}:${m.verse.verse}`,
          position: idx
        })) as AssetMarker[];
      updateRecordingSession(questId, { segments, markers });
    },
    [questId, updateRecordingSession]
  );

  // Save timeline to store when items change - debounced to prevent loops
  useEffect(() => {
    if (!timelineLoadedRef.current) return;

    const timeoutId = setTimeout(() => {
      updateSessionData(timelineItems);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [timelineItems, updateSessionData]);

  const handleRecordingComplete = useCallback(
    async (tempUri: string) => {
      console.log('Temporary recording completed:', tempUri);

      try {
        // Check if the temporary file still exists
        const fileInfo = await FileSystem.getInfoAsync(tempUri);
        if (!fileInfo.exists) {
          console.error('Temporary recording file no longer exists:', tempUri);
          Alert.alert('Error', 'Recording file was not found');
          return;
        }

        // Create permanent directory
        const recordingsDir = `${FileSystem.documentDirectory}recordings/`;
        await FileSystem.makeDirectoryAsync(recordingsDir, {
          intermediates: true
        });

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `recording_${questId}_${timestamp}.m4a`;
        const permanentUri = `${recordingsDir}${filename}`;

        // Copy file to permanent location instead of moving
        await FileSystem.copyAsync({
          from: tempUri,
          to: permanentUri
        });

        console.log('Recording saved permanently to:', permanentUri);

        const segment: Omit<
          AudioSegment,
          'id' | 'questId' | 'createdAt' | 'order'
        > = {
          audioUri: permanentUri,
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0, // Will be calculated when we have actual recording duration
          verse: currentReference
        };

        addAudioSegment(questId, segment);

        // Add to timeline
        const newSegment: SegmentItem = {
          ...segment,
          id: `segment_${Date.now()}`,
          questId,
          createdAt: Date.now(),
          order: timelineItems.length,
          type: 'segment',
          _belongsToVerse: currentReference
        };

        setTimelineItems((prev) => [...prev, newSegment]);
      } catch (error) {
        console.error('Error saving recording:', error);
        Alert.alert('Error', 'Failed to save recording');
      }
    },
    [questId, currentReference, addAudioSegment, timelineItems.length]
  );

  const addVerseMilestone = useCallback(() => {
    const nextVerse = getNextVerse(currentReference);
    if (!nextVerse) return;

    const milestone: VerseMilestone = {
      id: `milestone_${nextVerse.book}_${nextVerse.chapter}_${nextVerse.verse}`,
      verse: nextVerse,
      type: 'milestone',
      order: timelineItems.length
    };

    setTimelineItems((prev) => [...prev, milestone]);
    addAssetMarker(questId, {
      title: formatBibleReference(nextVerse),
      position: milestone.order
    });

    // Update current reference to the new verse
    setCurrentReference(nextVerse);
  }, [currentReference, timelineItems.length, questId, addAssetMarker]);

  const reorderTimelineItems = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTimelineItems((prev) => {
        const newItems = [...prev];
        const [movedItem] = newItems.splice(fromIndex, 1);
        if (movedItem) {
          newItems.splice(toIndex, 0, movedItem);
        }

        // Update order values
        return newItems.map((item, index) => ({ ...item, order: index }));
      });
    },
    []
  );

  const handleDragStart = useCallback((index: number) => {
    setDraggedItemIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItemIndex(null);
  }, []);

  const deleteTimelineItem = useCallback(
    (itemId: string) => {
      const item = timelineItems.find((i) => i.id === itemId);
      if (!item) return;

      Alert.alert(
        `Delete ${item.type === 'segment' ? 'Recording' : 'Verse Marker'}`,
        'Are you sure?',
        [
          { text: t('cancel') },
          {
            text: 'Delete',
            onPress: () => {
              void (async () => {
                if (item.type === 'segment') {
                  // Delete audio file
                  try {
                    await FileSystem.deleteAsync(item.audioUri, {
                      idempotent: true
                    });
                    deleteAudioSegment(questId, itemId);
                  } catch (error) {
                    console.error('Error deleting audio file:', error);
                  }
                }

                // Remove from timeline
                setTimelineItems((prev) => prev.filter((i) => i.id !== itemId));
              })();
            }
          }
        ]
      );
    },
    [timelineItems, questId, deleteAudioSegment, t]
  );

  const playSegment = useCallback(
    (segment: SegmentItem) => {
      if (isPlaying && currentAudioId === segment.id) {
        void stopCurrentSound();
      } else {
        void playSound(segment.audioUri, segment.id);
      }
    },
    [isPlaying, currentAudioId, playSound, stopCurrentSound]
  );

  // Check if we should show a drop zone for a given position
  const shouldShowDropZone = useCallback(
    (index: number, position: 'above' | 'below') => {
      if (draggedItemIndex === null) return false;

      // Don't show drop zone on the dragged item itself
      if (index === draggedItemIndex) return false;

      // Show drop zone above/below based on drag direction
      if (position === 'above' && index === draggedItemIndex + 1) return true;
      if (position === 'below' && index === draggedItemIndex - 1) return true;

      // Show drop zones for potential drop positions
      const dragDirection = draggedItemIndex < index ? 'down' : 'up';
      if (
        dragDirection === 'down' &&
        position === 'above' &&
        index > draggedItemIndex
      )
        return true;
      if (
        dragDirection === 'up' &&
        position === 'below' &&
        index < draggedItemIndex
      )
        return true;

      return false;
    },
    [draggedItemIndex]
  );

  // Memoize the render function to prevent re-creation on every render
  const renderTimelineItem = useCallback(
    (item: TimelineItem, index: number) => {
      const showDropZoneAbove = shouldShowDropZone(index, 'above');
      const showDropZoneBelow = shouldShowDropZone(index, 'below');

      return (
        <View key={item.id}>
          <DropZone isVisible={showDropZoneAbove} position="above" />

          {item.type === 'milestone' ? (
            <DraggableMilestone
              milestone={item}
              index={index}
              onReorder={reorderTimelineItems}
              onDelete={deleteTimelineItem}
              totalItems={timelineItems.length}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedIndex={draggedItemIndex}
            />
          ) : (
            <View
              style={[
                styles.segmentCard,
                draggedItemIndex !== null &&
                  index !== draggedItemIndex &&
                  styles.segmentCardDimmed
              ]}
            >
              <TouchableOpacity style={styles.segmentMenuButton}>
                <Ionicons
                  name="ellipsis-vertical"
                  size={16}
                  color={colors.textSecondary}
                />
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
                style={styles.segmentEditButton}
                onPress={() => playSegment(item)}
              >
                <Ionicons
                  name={
                    isPlaying && currentAudioId === item.id ? 'pause' : 'play'
                  }
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          )}

          <DropZone isVisible={showDropZoneBelow} position="below" />
        </View>
      );
    },
    [
      shouldShowDropZone,
      reorderTimelineItems,
      deleteTimelineItem,
      timelineItems.length,
      handleDragStart,
      handleDragEnd,
      draggedItemIndex,
      playSegment,
      isPlaying,
      currentAudioId
    ]
  );

  const timelineContent = useMemo(
    () => (
      <ScrollView
        style={styles.timeline}
        contentContainerStyle={styles.timelineContent}
      >
        {timelineItems.map((item, index) => renderTimelineItem(item, index))}

        {/* Add Verse Button */}
        <TouchableOpacity
          style={styles.addVerseButton}
          onPress={addVerseMilestone}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>
    ),
    [timelineItems, renderTimelineItem, addVerseMilestone]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RNModal
        visible={isVisible}
        animationType="slide"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.progressSection}>
              <View style={styles.progressStep}>
                <Text style={styles.progressNumber}>3</Text>
              </View>
              <View style={styles.progressComplete}>
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={colors.background}
                />
              </View>
              <Text style={styles.progressText}>Publish</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Book Title */}
          <View style={styles.bookSection}>
            <View style={styles.bookHeader}>
              <TouchableOpacity style={styles.playBookButton}>
                <Ionicons name="play" size={24} color={colors.background} />
              </TouchableOpacity>
              <Text style={styles.bookTitle}>Genesis</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
          </View>

          {/* Audio Recorder */}
          <View style={styles.recorderSection}>
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              resetRecording={() => {
                // Reset recording state if needed
              }}
            />
          </View>

          {/* Timeline */}
          {timelineContent}
        </SafeAreaView>
      </RNModal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.large
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.large
  },
  progressStep: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small
  },
  progressNumber: {
    color: colors.background,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  progressComplete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small
  },
  progressText: {
    color: colors.text,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  closeButton: {
    padding: spacing.small
  },
  bookSection: {
    padding: spacing.large,
    paddingTop: 0
  },
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  playBookButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.medium
  },
  bookTitle: {
    fontSize: fontSizes.xxxlarge,
    fontWeight: 'bold',
    color: colors.text
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 2,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    width: '30%',
    backgroundColor: colors.textSecondary,
    borderRadius: 2
  },
  recorderSection: {
    padding: spacing.large,
    paddingTop: 0
  },
  timeline: {
    flex: 1,
    paddingHorizontal: spacing.large
  },
  timelineContent: {
    paddingBottom: spacing.xlarge
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.medium,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small
  },
  milestoneContent: {
    flex: 1,
    alignItems: 'center'
  },
  milestoneText: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text
  },
  milestoneDeleteButton: {
    padding: spacing.small
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
  segmentCardDimmed: {
    opacity: 0.5
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
  segmentEditButton: {
    padding: spacing.small,
    marginLeft: spacing.small
  },
  addVerseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    marginTop: spacing.medium
  },
  // Drop zone styles
  dropZone: {
    alignItems: 'center',
    paddingVertical: spacing.small
  },
  dropZoneAbove: {
    marginBottom: -spacing.small
  },
  dropZoneBelow: {
    marginTop: -spacing.small
  },
  dropZoneLine: {
    width: '100%',
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
    marginBottom: spacing.xsmall
  },
  dropZoneText: {
    fontSize: fontSizes.small,
    color: colors.primary,
    fontWeight: '600'
  }
});
