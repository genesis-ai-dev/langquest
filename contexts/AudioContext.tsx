import { Audio } from 'expo-av';
import React, { createContext, useContext, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

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
  waitForPlaybackEnd: (audioId: string) => Promise<void>;
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
  // Hybrid progress model:
  // - sparse native status callbacks for truth/corrections
  // - continuous UI-thread timing for smooth movement
  const STATUS_UPDATE_INTERVAL_MS = 5000;
  const DRIFT_CORRECTION_THRESHOLD_MS = 80;
  // How often to push React state (triggers re-renders). Keep low to reduce
  // JS-thread pressure — progress bars use SharedValues, not React state.
  const REACT_STATE_THROTTLE_MS = 100;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [position, setPositionState] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reanimated SharedValues for high-performance position tracking
  const positionShared = useSharedValue(0);
  const durationShared = useSharedValue(0);
  const cumulativePositionShared = useSharedValue(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const lastReactStateUpdateMs = useRef(0);
  const currentAudioIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const isAdvancingSegmentRef = useRef(false);
  const animationStartWallClockMsRef = useRef<number | null>(null);
  const animationStartPositionMsRef = useRef(0);
  const animationTargetPositionMsRef = useRef(0);
  // Wall-clock guard: ignore all status-callback position updates until this
  // timestamp. expo-av fires an unpredictable number of eager callbacks when
  // a sound loads/plays/seeks — not on the interval timer. Those early
  // callbacks carry real positions that, if applied, would hard-set
  // positionShared and interrupt the deterministic withTiming animation,
  // causing visible jumps at the very start of playback.
  const statusGuardUntilMsRef = useRef(0);
  const playbackCompletionWaitersRef = useRef<Map<string, Set<() => void>>>(
    new Map()
  );
  const sequenceSegments = useRef<AudioSegment[]>([]);
  const currentSequenceIndex = useRef<number>(0);
  const segmentDurations = useRef<number[]>([]); // Effective (trimmed) duration per segment

  // Store SharedValues in refs to satisfy React Compiler (they're stable references)
  const positionSharedRef = useRef(positionShared);
  const durationSharedRef = useRef(durationShared);
  const cumulativePositionSharedRef = useRef(cumulativePositionShared);

  const setCurrentAudioIdState = (audioId: string | null) => {
    currentAudioIdRef.current = audioId;
    setCurrentAudioId(audioId);
  };

  const setIsPlayingState = (playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlaying(playing);
  };

  const resolvePlaybackWaiters = (audioId: string | null) => {
    if (!audioId) return;
    const waiters = playbackCompletionWaitersRef.current.get(audioId);
    if (!waiters || waiters.size === 0) return;
    playbackCompletionWaitersRef.current.delete(audioId);
    waiters.forEach((resolve) => {
      try {
        resolve();
      } catch {
        // Ignore waiter errors
      }
    });
  };

  const waitForPlaybackEnd = async (audioId: string) => {
    if (!audioId) return;
    if (currentAudioIdRef.current !== audioId || !isPlayingRef.current) {
      return;
    }

    await new Promise<void>((resolve) => {
      const map = playbackCompletionWaitersRef.current;
      const existing = map.get(audioId);
      if (existing) {
        existing.add(resolve);
      } else {
        map.set(audioId, new Set([resolve]));
      }
    });
  };

  const clearStatusListener = () => {
    if (soundRef.current) {
      soundRef.current.setOnPlaybackStatusUpdate(null);
    }
  };

  const resetPredictedProgress = () => {
    animationStartWallClockMsRef.current = null;
    animationStartPositionMsRef.current = 0;
    animationTargetPositionMsRef.current = 0;
    statusGuardUntilMsRef.current = 0;
  };

  const cumulativeDurationBeforeCurrent = () => {
    let cumulativeDuration = 0;
    for (let i = 0; i < currentSequenceIndex.current; i++) {
      cumulativeDuration += segmentDurations.current[i] || 0;
    }
    return cumulativeDuration;
  };

  const startPredictedProgressAnimation = (
    fromTotalPosition: number,
    targetTotalPosition: number
  ) => {
    const from = Math.max(0, fromTotalPosition);
    const target = Math.max(from, targetTotalPosition);
    const remaining = target - from;

    animationStartWallClockMsRef.current = Date.now();
    animationStartPositionMsRef.current = from;
    animationTargetPositionMsRef.current = target;

    cumulativePositionSharedRef.current.value = from;
    positionSharedRef.current.value = from;

    if (remaining <= 0) return;

    positionSharedRef.current.value = withTiming(target, {
      duration: remaining,
      easing: Easing.linear
    });
  };

  const predictedPositionNow = () => {
    const startedAt = animationStartWallClockMsRef.current;
    if (!startedAt) return null;
    const elapsed = Date.now() - startedAt;
    const predicted = animationStartPositionMsRef.current + elapsed;
    return Math.min(animationTargetPositionMsRef.current, predicted);
  };

  const stopCurrentSound = async () => {
    const finishingAudioId = currentAudioIdRef.current;
    clearStatusListener();
    isAdvancingSegmentRef.current = false;
    resetPredictedProgress();

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

    setIsPlayingState(false);
    setCurrentAudioIdState(null);
    setPositionState(0);
    setDuration(0);

    positionSharedRef.current.value = 0;
    durationSharedRef.current.value = 0;
    resolvePlaybackWaiters(finishingAudioId);
  };

  const setPosition = async (newPosition: number) => {
    if (soundRef.current && isPlaying) {
      await soundRef.current.setPositionAsync(newPosition);
      setPositionState(newPosition);
      cumulativePositionSharedRef.current.value = newPosition;
      positionSharedRef.current.value = newPosition;
      resetPredictedProgress();
    }
  };

  const playNextInSequence = async () => {
    currentSequenceIndex.current++;
    if (currentSequenceIndex.current < sequenceSegments.current.length) {
      const nextSeg = sequenceSegments.current[currentSequenceIndex.current];
      if (nextSeg) {
        await playSegment(nextSeg, currentAudioId || undefined);
      }
    } else {
      // Sequence finished — reset all state
      isAdvancingSegmentRef.current = false;
      resetPredictedProgress();
      sequenceSegments.current = [];
      currentSequenceIndex.current = 0;
      segmentDurations.current = [];
      cumulativePositionSharedRef.current.value = 0;
      positionSharedRef.current.value = 0;
      durationSharedRef.current.value = 0;
      setIsPlayingState(false);
      resolvePlaybackWaiters(currentAudioIdRef.current);
      setCurrentAudioIdState(null);
      setPositionState(0);
      setDuration(0);
    }
  };

  /**
   * Load and play a single segment. Handles optional startMs (seek before
   * playing) and optional endMs (enforced by startPositionTracking).
   * Used internally by playSound and playNextInSequence.
   */
  const playSegment = async (segment: AudioSegment, audioId?: string) => {
    // Stop current sound if any is playing
    if (soundRef.current) {
      clearStatusListener();
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    isAdvancingSegmentRef.current = false;

    // Set up audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true
    });

    const shouldSeek = segment.startMs != null && segment.startMs > 0;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: segment.uri },
        { shouldPlay: !shouldSeek }
      );
      await sound.setProgressUpdateIntervalAsync(STATUS_UPDATE_INTERVAL_MS);

      soundRef.current = sound;
      setIsPlayingState(true);

      if (audioId) {
        setCurrentAudioIdState(audioId);
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

        const cumulativeBefore = cumulativeDurationBeforeCurrent();
        const targetTotal = cumulativeBefore + effectiveDuration;
        // Start deterministic motion immediately from expected segment start.
        // We intentionally ignore real-position reconciliation until the first
        // full status interval has elapsed to avoid rough startup hitching.
        startPredictedProgressAnimation(cumulativeBefore, targetTotal);
        // Guard: block all status-callback position writes for 1 second.
        // This lets the deterministic withTiming animation run uninterrupted
        // through the startup burst of eager expo-av callbacks.
        // animationStartWallClockMsRef was just set by the call above.
        statusGuardUntilMsRef.current =
          (animationStartWallClockMsRef.current ?? 0) + 1000;
      }

      // Set up listener for position updates + natural completion.
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }

        const now = Date.now();
        const guarded = now < statusGuardUntilMsRef.current;
        console.log(
          `[STATUS CB] posMillis=${status.positionMillis} guarded=${guarded} t=${now}`
        );

        const currentSeg =
          sequenceSegments.current[currentSequenceIndex.current];
        const cumulativeDuration = cumulativeDurationBeforeCurrent();
        const segStartMs = currentSeg?.startMs ?? 0;
        const positionInSegment = status.positionMillis - segStartMs;
        const totalPosition =
          cumulativeDuration + Math.max(0, positionInSegment);

        // While the guard is active, skip all position writes and drift
        // correction. The deterministic withTiming animation is running
        // smoothly on the UI thread and must not be interrupted by
        // real-position hard-sets from these early callbacks.
        if (!guarded) {
          cumulativePositionSharedRef.current.value = totalPosition;
          if (
            now - lastReactStateUpdateMs.current >=
            REACT_STATE_THROTTLE_MS
          ) {
            lastReactStateUpdateMs.current = now;
            setPositionState(totalPosition);
          }

          const currentTargetTotal =
            cumulativeDuration +
            (segmentDurations.current[currentSequenceIndex.current] || 0);
          const predicted = predictedPositionNow();
          const drift =
            predicted == null
              ? Number.POSITIVE_INFINITY
              : totalPosition - predicted;
          if (Math.abs(drift) >= DRIFT_CORRECTION_THRESHOLD_MS) {
            startPredictedProgressAnimation(totalPosition, currentTargetTotal);
          }
        }

        // Enforce endMs boundary for trimmed playback.
        if (
          currentSeg?.endMs != null &&
          status.positionMillis >= currentSeg.endMs &&
          !isAdvancingSegmentRef.current
        ) {
          isAdvancingSegmentRef.current = true;
          clearStatusListener();
          void sound.stopAsync().then(() => {
            void sound.unloadAsync();
            soundRef.current = null;
            void playNextInSequence();
          });
          return;
        }

        if (status.didJustFinish) {
          if (isAdvancingSegmentRef.current) return;
          isAdvancingSegmentRef.current = true;
          resetPredictedProgress();
          clearStatusListener();
          void sound.unloadAsync();
          soundRef.current = null;
          // playNextInSequence advances to the next segment, or resets
          // all state if no segments remain.
          void playNextInSequence();
        }
      });
    } catch {
      setIsPlayingState(false);
      setCurrentAudioIdState(null);
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
      resetPredictedProgress();
      clearStatusListener();
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
        waitForPlaybackEnd,
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
