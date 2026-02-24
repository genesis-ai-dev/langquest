import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer
} from 'expo-audio';
import React, { createContext, useContext, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

interface AudioContextType {
  playSound: (uri: string, audioId?: string) => Promise<void>;
  playSoundSequence: (uris: string[], audioId?: string) => Promise<void>;
  stopCurrentSound: () => Promise<void>;
  pauseSound: () => Promise<void>;
  resumeSound: () => Promise<void>;
  isPlaying: boolean;
  isPaused: boolean;
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
  const [isPaused, setIsPaused] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [position, setPositionState] = useState(0);
  const [duration, setDuration] = useState(0);

  // NEW: Reanimated SharedValues for high-performance position tracking
  const positionShared = useSharedValue(0);
  const durationShared = useSharedValue(0);
  const cumulativePositionShared = useSharedValue(0); // SharedValue for worklet access

  const playerRef = useRef<AudioPlayer | null>(null);
  const playerListenerRef = useRef<{ remove: () => void } | null>(null);
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

  // Helper to wait for an AudioPlayer to finish loading
  const waitForPlayerLoaded = (player: AudioPlayer): Promise<void> => {
    return new Promise((resolve) => {
      if (player.isLoaded) {
        resolve();
        return;
      }
      const check = setInterval(() => {
        if (player.isLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 10);
      // Safety timeout to avoid hanging forever
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 5000);
    });
  };

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
      if (playerRef.current?.isLoaded) {
        // Calculate cumulative position across all segments
        let cumulativeDuration = 0;
        for (let i = 0; i < currentSequenceIndex.current; i++) {
          cumulativeDuration += segmentDurations.current[i] || 0;
        }
        const totalPosition =
          cumulativeDuration + playerRef.current.currentTime * 1000;
        cumulativePositionSharedRef.current.value = totalPosition; // Update SharedValue
        setPositionState(totalPosition);
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

    if (playerRef.current) {
      playerListenerRef.current?.remove();
      playerListenerRef.current = null;
      playerRef.current.pause();
      playerRef.current.release();
      playerRef.current = null;
    }

    setIsPlaying(false);
    setIsPaused(false);
    setCurrentAudioId(null);
    setPositionState(0);
    setDuration(0);

    positionSharedRef.current.value = 0;
    durationSharedRef.current.value = 0;
  };

  const pauseSound = async () => {
    if (playerRef.current && isPlaying) {
      clearPositionInterval();
      isTrackingPositionRef.current.value = false;
      playerRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };

  const resumeSound = async () => {
    if (playerRef.current && isPaused) {
      playerRef.current.play();
      setIsPlaying(true);
      setIsPaused(false);
      startPositionTracking();
    }
  };

  const setPosition = async (newPosition: number) => {
    if (playerRef.current && (isPlaying || isPaused)) {
      playerRef.current.seekTo(newPosition / 1000);
      setPositionState(newPosition);
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
      setIsPaused(false);
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
    // Stop current player if any is playing (but preserve sequence state)
    if (playerRef.current) {
      clearPositionInterval();

      // Store the duration of the previous segment if part of a sequence
      if (isSequencePart && currentSequenceIndex.current > 0) {
        if (playerRef.current.isLoaded) {
          segmentDurations.current[currentSequenceIndex.current - 1] =
            playerRef.current.duration * 1000;
        }
      }

      playerListenerRef.current?.remove();
      playerListenerRef.current = null;
      playerRef.current.pause();
      playerRef.current.release();
      playerRef.current = null;
    }

    // Set up audio mode
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: true
    });

    // Load and play new sound
    try {
      const player = createAudioPlayer(uri);
      player.play();

      playerRef.current = player;
      setIsPlaying(true);
      setIsPaused(false);

      if (audioId) {
        setCurrentAudioId(audioId);
      }

      // Wait for player to load to get duration
      await waitForPlayerLoaded(player);
      if (player.isLoaded) {
        const durationMs = player.duration * 1000;

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

      // Set up listener for when playback finishes
      playerListenerRef.current = player.addListener(
        'playbackStatusUpdate',
        (status) => {
          if (!status.didJustFinish) return;

          clearPositionInterval();
          isTrackingPositionRef.current.value = false;
          playerListenerRef.current?.remove();
          playerListenerRef.current = null;
          player.release();
          playerRef.current = null;

          // Check if there are more sounds in the sequence
          if (sequenceQueue.current.length > 0) {
            void playNextInSequence();
          } else {
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentAudioId(null);
            setPositionState(0);
            positionSharedRef.current.value = 0;
            durationSharedRef.current.value = 0;
          }
        }
      );
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
    // NOTE: Process sequentially to avoid ExoPlayer threading issues on Android
    // (ExoPlayer requires all player operations on the main thread)
    try {
      for (let index = 0; index < uris.length; index++) {
        const uri = uris[index]!;
        const player = createAudioPlayer(uri);
        await waitForPlayerLoaded(player);
        if (player.isLoaded) {
          segmentDurations.current[index] = player.duration * 1000;
        }
        player.release();
      }

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
      if (playerRef.current) {
        playerListenerRef.current?.remove();
        playerRef.current.release();
      }
    };
  }, []);

  return (
    <AudioContext.Provider
      value={{
        playSound,
        playSoundSequence,
        stopCurrentSound,
        pauseSound,
        resumeSound,
        isPlaying,
        isPaused,
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
