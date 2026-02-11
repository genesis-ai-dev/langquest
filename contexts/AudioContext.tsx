import { Audio } from 'expo-av';
import React, { createContext, useContext, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

/**
 * EXPO-AUDIO MIGRATION NOTES
 * When migrating from expo-av to expo-audio, only this file needs to change.
 * The public interface (AudioContextType) stays the same.
 *
 * Key API changes:
 *   expo-av                          →  expo-audio
 *   ─────────────────────────────────────────────────
 *   Audio.Sound.createAsync({uri})   →  useAudioPlayer(uri) or new AudioPlayer(uri)
 *   sound.playAsync()                →  player.play()
 *   sound.stopAsync()                →  player.pause() / player.remove()
 *   sound.unloadAsync()              →  player.remove()
 *   sound.getStatusAsync()           →  player.status / player.duration / player.currentTime
 *   sound.setPositionAsync(ms)       →  player.seekTo(seconds)  ← NOTE: seconds, not ms
 *   sound.setOnPlaybackStatusUpdate  →  player.addListener('playbackStatusUpdate', ...)
 *   Audio.setAudioModeAsync(...)     →  Audio.setAudioModeAsync(...)  (similar)
 *
 * AssetAudio (services/assetAudio.ts) also has one direct expo-av usage in
 * loadDuration() that will need updating at the same time.
 */

export interface AudioSegment {
  uri: string;
  startMs?: number;
  endMs?: number;
}

/** Any input playSound accepts: a single URI, an array of URIs, a single
 *  AudioSegment, or an array of AudioSegments (plain strings and AudioSegments
 *  can be mixed freely in arrays). */
export type PlayInput = string | AudioSegment | (string | AudioSegment)[];

interface AudioContextType {
  playSound: (input: PlayInput, audioId?: string) => Promise<void>;
  /** @deprecated Use playSound — it now accepts all input types */
  playSoundSequence: (
    segments: (string | AudioSegment)[],
    audioId?: string
  ) => Promise<void>;
  stopCurrentSound: () => Promise<void>;
  isPlaying: boolean;
  currentAudioId: string | null;
  position: number; // Keep for backward compatibility
  duration: number; // Keep for backward compatibility
  setPosition: (position: number) => Promise<void>;
  // SharedValues for high-performance UI updates (60fps via Reanimated)
  positionShared: SharedValue<number>;
  durationShared: SharedValue<number>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [position, setPositionState] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reanimated SharedValues for high-performance position tracking
  const positionShared = useSharedValue(0);
  const durationShared = useSharedValue(0);
  const cumulativePositionShared = useSharedValue(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const positionUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const sequenceSegments = useRef<AudioSegment[]>([]);
  const currentSequenceIndex = useRef<number>(0);
  const segmentDurations = useRef<number[]>([]); // Effective (trimmed) duration per segment
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

  // Start updating position at regular intervals when playing.
  // Also enforces endMs: if the current segment has an endMs and the
  // playback position reaches it, stops the current sound and advances.
  const startPositionTracking = () => {
    clearPositionInterval();
    isTrackingPositionRef.current.value = true;

    positionUpdateInterval.current = setInterval(() => {
      if (soundRef.current) {
        void soundRef.current.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            // Check endMs boundary for the current segment
            const currentSeg =
              sequenceSegments.current[currentSequenceIndex.current];
            if (
              currentSeg?.endMs != null &&
              status.positionMillis >= currentSeg.endMs
            ) {
              // Reached the end boundary — stop and advance
              clearPositionInterval();
              isTrackingPositionRef.current.value = false;
              void soundRef.current?.stopAsync().then(() => {
                void soundRef.current?.unloadAsync();
                soundRef.current = null;
                void playNextInSequence();
              });
              return;
            }

            // Calculate cumulative position across all segments.
            // For the current segment, subtract startMs so position starts
            // from 0 relative to the effective region.
            let cumulativeDuration = 0;
            for (let i = 0; i < currentSequenceIndex.current; i++) {
              cumulativeDuration += segmentDurations.current[i] || 0;
            }
            const segStartMs = currentSeg?.startMs ?? 0;
            const positionInSegment = status.positionMillis - segStartMs;
            const totalPosition =
              cumulativeDuration + Math.max(0, positionInSegment);
            cumulativePositionSharedRef.current.value = totalPosition;
            setPositionState(totalPosition);
          }
        });
      }
    }, 100);
  };

  // Frame callback for high-performance SharedValue updates
  // This runs on the UI thread at 60fps for buttery smooth progress bars
  useFrameCallback(() => {
    'worklet';
    if (!isTrackingPosition.value) {
      return;
    }
    positionShared.value = cumulativePositionShared.value;
  });

  const stopCurrentSound = async () => {
    clearPositionInterval();
    isTrackingPositionRef.current.value = false;

    // Reset sequence state
    sequenceSegments.current = [];
    currentSequenceIndex.current = 0;
    segmentDurations.current = [];
    cumulativePositionSharedRef.current.value = 0;

    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    setIsPlaying(false);
    setCurrentAudioId(null);
    setPositionState(0);
    setDuration(0);

    positionSharedRef.current.value = 0;
    durationSharedRef.current.value = 0;
  };

  const setPosition = async (newPosition: number) => {
    if (soundRef.current && isPlaying) {
      await soundRef.current.setPositionAsync(newPosition);
      setPositionState(newPosition);
      cumulativePositionSharedRef.current.value = newPosition;
      positionSharedRef.current.value = newPosition;
    }
  };

  const playNextInSequence = async () => {
    currentSequenceIndex.current++;
    if (
      currentSequenceIndex.current < sequenceSegments.current.length
    ) {
      const nextSeg =
        sequenceSegments.current[currentSequenceIndex.current];
      if (nextSeg) {
        await playSegment(nextSeg, currentAudioId || undefined);
      }
    } else {
      // Sequence finished — reset all state
      sequenceSegments.current = [];
      currentSequenceIndex.current = 0;
      segmentDurations.current = [];
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

  /**
   * Load and play a single segment. Handles optional startMs (seek before
   * playing) and optional endMs (enforced by startPositionTracking).
   * Used internally by playSound and playNextInSequence.
   */
  const playSegment = async (
    segment: AudioSegment,
    audioId?: string
  ) => {
    // Stop current sound if any is playing
    if (soundRef.current) {
      clearPositionInterval();
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

    const shouldSeek =
      segment.startMs != null && segment.startMs > 0;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: segment.uri },
        { shouldPlay: !shouldSeek }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      if (audioId) {
        setCurrentAudioId(audioId);
      }

      // Seek to startMs before starting playback
      if (shouldSeek) {
        await sound.setPositionAsync(segment.startMs!, {
          toleranceMillisBefore: 0,
          toleranceMillisAfter: 0
        });
        await sound.playAsync();
      }

      // Get initial status to set the duration
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        const fullDurationMs = status.durationMillis ?? 0;

        // Effective duration for this segment (respecting start/end)
        const startMs = segment.startMs ?? 0;
        const endMs = segment.endMs ?? fullDurationMs;
        const effectiveDuration = Math.max(0, endMs - startMs);

        // Store this segment's effective duration
        segmentDurations.current[currentSequenceIndex.current] =
          effectiveDuration;

        // Calculate total duration across all segments
        const totalDuration = segmentDurations.current.reduce(
          (sum, d) => sum + d,
          0
        );
        setDuration(totalDuration);
        durationSharedRef.current.value = totalDuration;
      }

      // Start tracking position (also enforces endMs boundary)
      startPositionTracking();

      // Set up listener for when sound finishes naturally
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }

        if (status.didJustFinish) {
          clearPositionInterval();
          isTrackingPositionRef.current.value = false;
          void sound.unloadAsync();
          soundRef.current = null;
          // playNextInSequence advances to the next segment, or resets
          // all state if no segments remain.
          void playNextInSequence();
        }
      });
    } catch {
      setIsPlaying(false);
      setCurrentAudioId(null);
    }
  };

  /**
   * Unified playback function. Accepts any combination of URIs and segments:
   *   playSound("file.m4a", audioId)
   *   playSound(["a.m4a", "b.m4a"], audioId)
   *   playSound({ uri: "file.m4a", startMs: 500, endMs: 3000 }, audioId)
   *   playSound([seg1, seg2], audioId)
   */
  const playSound = async (input: PlayInput, audioId?: string) => {
    // Normalize any input shape to AudioSegment[]
    const raw = Array.isArray(input) ? input : [input];
    const segments: AudioSegment[] = raw.map((s) =>
      typeof s === 'string' ? { uri: s } : s
    );
    if (segments.length === 0) return;

    // Stop any current playback
    await stopCurrentSound();

    // Always set up sequence state — even for single segments — so that
    // trim enforcement (startMs/endMs) works via startPositionTracking.
    sequenceSegments.current = segments;
    currentSequenceIndex.current = 0;
    segmentDurations.current = new Array<number>(segments.length).fill(0);
    cumulativePositionSharedRef.current.value = 0;

    // For multi-segment sequences, preload durations for accurate total display.
    // Single segments get their duration set inside playSegment.
    // NOTE: Process sequentially to avoid ExoPlayer threading issues on Android.
    if (segments.length > 1) {
      try {
        for (let index = 0; index < segments.length; index++) {
          const seg = segments[index]!;
          const { sound } = await Audio.Sound.createAsync({ uri: seg.uri });
          const status = await sound.getStatusAsync();
          await sound.unloadAsync();
          if (status.isLoaded) {
            const fullMs = status.durationMillis ?? 0;
            const startMs = seg.startMs ?? 0;
            const endMs = seg.endMs ?? fullMs;
            segmentDurations.current[index] = Math.max(0, endMs - startMs);
          }
        }

        const totalDuration = segmentDurations.current.reduce(
          (sum, d) => sum + d,
          0
        );
        setDuration(totalDuration);
        durationSharedRef.current.value = totalDuration;
      } catch {
        // Failed to preload durations, will calculate on the fly
      }
    }

    // Play first segment
    await playSegment(segments[0]!, audioId);
  };

  /** @deprecated Use playSound — it now accepts all input types */
  const playSoundSequence = async (
    input: (string | AudioSegment)[],
    audioId?: string
  ) => {
    await playSound(input, audioId);
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
