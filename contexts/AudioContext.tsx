import { Audio } from 'expo-av';
import React, { createContext, useContext, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

interface AudioContextType {
  playSound: (uri: string, audioId?: string) => Promise<void>;
  playSoundSequence: (uris: string[], audioId?: string) => Promise<void>;
  stopCurrentSound: () => Promise<void>;
  isPlaying: boolean;
  currentAudioId: string | null;
  position: number; // Keep for backward compatibility
  duration: number; // Keep for backward compatibility
  setPosition: (position: number) => Promise<void>;
  // NEW: SharedValues for high-performance UI updates
  positionShared: SharedValue<number>;
  durationShared: SharedValue<number>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [position, setPositionState] = useState(0);
  const [duration, setDuration] = useState(0);

  // NEW: Reanimated SharedValues for high-performance position tracking
  const positionShared = useSharedValue(0);
  const durationShared = useSharedValue(0);
  const cumulativePositionShared = useSharedValue(0); // SharedValue for worklet access

  const soundRef = useRef<Audio.Sound | null>(null);
  const positionUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const sequenceQueue = useRef<string[]>([]);
  const currentSequenceIndex = useRef<number>(0);
  const segmentDurations = useRef<number[]>([]); // Track duration of each segment
  // Use SharedValue instead of ref for worklet access (prevents serialization warnings)
  const isTrackingPosition = useSharedValue(false);

  // Store SharedValues in refs to satisfy React Compiler (they're stable references)
  const positionSharedRef = useRef(positionShared);
  const durationSharedRef = useRef(durationShared);
  const cumulativePositionSharedRef = useRef(cumulativePositionShared);
  const isTrackingPositionRef = useRef(isTrackingPosition);

  // Clear the position update interval
  const clearPositionInterval = () => {
    if (positionUpdateInterval.current) {
      clearInterval(positionUpdateInterval.current);
      positionUpdateInterval.current = null;
    }
  };

  // Start updating position at regular intervals when playing
  const startPositionTracking = () => {
    clearPositionInterval();
    isTrackingPositionRef.current.value = true;

    positionUpdateInterval.current = setInterval(() => {
      if (soundRef.current) {
        void soundRef.current.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            // Calculate cumulative position across all segments
            let cumulativeDuration = 0;
            for (let i = 0; i < currentSequenceIndex.current; i++) {
              cumulativeDuration += segmentDurations.current[i] || 0;
            }
            const totalPosition = cumulativeDuration + status.positionMillis;
            cumulativePositionSharedRef.current.value = totalPosition; // Update SharedValue
            setPositionState(totalPosition);
          }
        });
      }
    }, 100); // Update every 100ms for smoother animation
  };

  // NEW: Frame callback for high-performance SharedValue updates
  // This runs on the UI thread at 60fps for buttery smooth progress bars
  useFrameCallback(() => {
    'worklet';
    // Only update if actively tracking position
    // The isTrackingPosition check prevents updates after cleanup
    if (!isTrackingPosition.value) {
      return;
    }

    // Copy cumulative position to the main position SharedValue
    // This runs at 60fps on UI thread for buttery smooth progress bars!
    positionShared.value = cumulativePositionShared.value;
  });

  const stopCurrentSound = async () => {
    clearPositionInterval();
    // Update SharedValue via ref to satisfy React Compiler
    isTrackingPositionRef.current.value = false;

    // Reset sequence state
    sequenceQueue.current = [];
    currentSequenceIndex.current = 0;
    segmentDurations.current = [];
    // Update SharedValue via ref to satisfy React Compiler
    cumulativePositionSharedRef.current.value = 0;

    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    // Always reset state, even if soundRef.current is null
    // This fixes the issue where pause state gets stuck
    setIsPlaying(false);
    setCurrentAudioId(null);
    setPositionState(0);
    setDuration(0);

    // Reset SharedValues via refs to satisfy React Compiler
    positionSharedRef.current.value = 0;
    durationSharedRef.current.value = 0;
  };

  const setPosition = async (newPosition: number) => {
    if (soundRef.current && isPlaying) {
      await soundRef.current.setPositionAsync(newPosition);
      setPositionState(newPosition);
      // Update SharedValues via refs to satisfy React Compiler
      cumulativePositionSharedRef.current.value = newPosition;
      positionSharedRef.current.value = newPosition;
    }
  };

  const playNextInSequence = async () => {
    currentSequenceIndex.current++;
    if (currentSequenceIndex.current < sequenceQueue.current.length) {
      const nextUri = sequenceQueue.current[currentSequenceIndex.current];
      if (nextUri) {
        await playSound(nextUri, currentAudioId || undefined, true);
      }
    } else {
      // Sequence finished - reset all state
      sequenceQueue.current = [];
      currentSequenceIndex.current = 0;
      segmentDurations.current = [];
      // Reset SharedValues via refs to satisfy React Compiler
      cumulativePositionSharedRef.current.value = 0;
      positionSharedRef.current.value = 0;
      durationSharedRef.current.value = 0;
      isTrackingPositionRef.current.value = false;
      setIsPlaying(false);
      setCurrentAudioId(null);
      setPositionState(0);
      setDuration(0);
      clearPositionInterval();
    }
  };

  const playSound = async (
    uri: string,
    audioId?: string,
    isSequencePart = false
  ) => {
    // Stop current sound if any is playing (but preserve sequence state)
    if (soundRef.current) {
      clearPositionInterval();

      // Store the duration of the previous segment if part of a sequence
      if (isSequencePart && currentSequenceIndex.current > 0) {
        const prevStatus = await soundRef.current.getStatusAsync();
        if (prevStatus.isLoaded) {
          segmentDurations.current[currentSequenceIndex.current - 1] =
            prevStatus.durationMillis ?? 0;
        }
      }

      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    // Set up audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true
    });

    // Load and play new sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      if (audioId) {
        setCurrentAudioId(audioId);
      }

      // Get initial status to set the duration
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        const durationMs = status.durationMillis ?? 0;

        // Store this segment's duration
        segmentDurations.current[currentSequenceIndex.current] = durationMs;

        // Calculate total duration across all segments
        const totalDuration = segmentDurations.current.reduce(
          (sum, d) => sum + d,
          0
        );
        setDuration(totalDuration);
        durationSharedRef.current.value = totalDuration; // Update SharedValue
      }

      // Start tracking position
      startPositionTracking();

      // Set up listener for when sound finishes playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }

        if (status.didJustFinish) {
          clearPositionInterval();
          isTrackingPositionRef.current.value = false;
          void sound.unloadAsync();
          soundRef.current = null;

          // Check if there are more sounds in the sequence
          if (sequenceQueue.current.length > 0) {
            void playNextInSequence();
          } else {
            // No more sounds in sequence
            setIsPlaying(false);
            setCurrentAudioId(null);
            setPositionState(0);
            positionSharedRef.current.value = 0;
            durationSharedRef.current.value = 0;
          }
        }
      });
    } catch {
      setIsPlaying(false);
      setCurrentAudioId(null);
    }
  };

  const playSoundSequence = async (uris: string[], audioId?: string) => {
    if (uris.length === 0) return;

    // Stop any current playback
    await stopCurrentSound();

    // Set up sequence
    sequenceQueue.current = uris;
    currentSequenceIndex.current = 0;
    segmentDurations.current = new Array<number>(uris.length).fill(0);
    // Update SharedValue via ref to satisfy React Compiler
    cumulativePositionSharedRef.current.value = 0;

    // Preload all segment durations for accurate total duration
    // This helps calculate progress correctly from the start
    try {
      const durationPromises = uris.map(async (uri, index) => {
        const { sound } = await Audio.Sound.createAsync({ uri });
        const status = await sound.getStatusAsync();
        await sound.unloadAsync();
        if (status.isLoaded) {
          segmentDurations.current[index] = status.durationMillis ?? 0;
        }
      });
      await Promise.all(durationPromises);

      const totalDuration = segmentDurations.current.reduce(
        (sum, d) => sum + d,
        0
      );
      setDuration(totalDuration);
      durationSharedRef.current.value = totalDuration; // Update SharedValue
    } catch {
      // Failed to preload durations, will calculate on the fly
    }

    // Play first sound
    await playSound(uris[0]!, audioId, true);
  };

  // Ensure cleanup when the component unmounts
  React.useEffect(() => {
    return () => {
      clearPositionInterval();
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
      }
    };
  }, []);

  return (
    <AudioContext.Provider
      value={{
        playSound,
        playSoundSequence,
        stopCurrentSound,
        isPlaying,
        currentAudioId,
        position,
        duration,
        setPosition,
        positionShared,
        durationShared
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

/**
 * Hook to access audio playback functionality.
 * @param options - Configuration options
 * @param options.stopOnUnmount - Whether to stop audio when component unmounts (default: true)
 */
export function useAudio(options?: { stopOnUnmount?: boolean }) {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }

  const stopOnUnmount = options?.stopOnUnmount ?? true;
  const stopCurrentSoundRef = React.useRef(context.stopCurrentSound);

  // Keep ref updated with latest function
  React.useEffect(() => {
    stopCurrentSoundRef.current = context.stopCurrentSound;
  }, [context.stopCurrentSound]);

  // Stop playback when component unmounts (unless disabled)
  React.useEffect(() => {
    if (!stopOnUnmount) {
      return;
    }
    return () => {
      void stopCurrentSoundRef.current();
    };
  }, [stopOnUnmount]);

  return context;
}
