import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
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
 *   Audio.setAudioModeAsync(...)     →  setAudioModeAsync(...)  (similar)
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
  // Progress model: preload durations upfront, then start a withTiming
  // animation right at sound.play() so the bar appears at 0% when audio
  // begins. Single segments animate 1:1 with audio duration. Multi-segment
  // sequences use padding for inter-segment gaps, then retime on the last
  // segment. Status callbacks update React state but don't touch positionShared.
  const MERGED_SEGMENT_PADDING_MS = 250;
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

  const soundRef = useRef<AudioPlayer | null>(null);
  const soundListenerRef = useRef<{ remove: () => void } | null>(null);
  const lastReactStateUpdateMs = useRef(0);
  const currentAudioIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const isAdvancingSegmentRef = useRef(false);
  const useSequenceLevelProgressRef = useRef(false);
  const hasRetimedLastSegmentRef = useRef(false);
  const playbackSessionRef = useRef(0);
  const preloadedSegmentRef = useRef<{
    index: number;
    sound: AudioPlayer;
  } | null>(null);
  const endpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationStartWallClockMsRef = useRef<number | null>(null);
  const animationStartPositionMsRef = useRef(0);
  const animationTargetPositionMsRef = useRef(0);
  const animationDurationMsRef = useRef(0);
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

  // expo-audio players load asynchronously; wait until duration/position are usable.
  const waitForPlayerLoaded = async (player: AudioPlayer): Promise<void> => {
    if (player.isLoaded) return;
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(resolve, 5000);
      const checkId = setInterval(() => {
        if (!player.isLoaded) return;
        clearInterval(checkId);
        clearTimeout(timeoutId);
        resolve();
      }, 10);
    });
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
    if (currentAudioIdRef.current !== audioId) {
      return;
    }
    // Allow waiting during startup before first status.playing callback.
    if (!isPlayingRef.current && !soundRef.current) {
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
    soundListenerRef.current?.remove();
    soundListenerRef.current = null;
  };

  const clearEndpointTimer = () => {
    if (endpointTimerRef.current != null) {
      clearTimeout(endpointTimerRef.current);
      endpointTimerRef.current = null;
    }
  };

  const resetPredictedProgress = () => {
    animationStartWallClockMsRef.current = null;
    animationStartPositionMsRef.current = 0;
    animationTargetPositionMsRef.current = 0;
    animationDurationMsRef.current = 0;
    statusGuardUntilMsRef.current = 0;
  };

  const cumulativeDurationBeforeCurrent = () => {
    let cumulativeDuration = 0;
    for (let i = 0; i < currentSequenceIndex.current; i++) {
      cumulativeDuration += segmentDurations.current[i] || 0;
    }
    return cumulativeDuration;
  };

  const totalSequenceDuration = () =>
    segmentDurations.current.reduce((sum, d) => sum + d, 0);

  const unloadPreloadedSegment = async () => {
    const preloaded = preloadedSegmentRef.current;
    preloadedSegmentRef.current = null;
    if (!preloaded) return;
    try {
      preloaded.sound.pause();
      await Promise.resolve(preloaded.sound.release());
    } catch {
      // Ignore preload unload errors
    }
  };

  const preloadSegmentAtIndex = async (index: number, sessionId: number) => {
    if (!useSequenceLevelProgressRef.current) return;
    if (index < 0 || index >= sequenceSegments.current.length) return;
    if (sessionId !== playbackSessionRef.current) return;

    const existing = preloadedSegmentRef.current;
    if (existing?.index === index) return;

    await unloadPreloadedSegment();
    if (sessionId !== playbackSessionRef.current) return;

    const segment = sequenceSegments.current[index];
    if (!segment) return;

    try {
      const sound = createAudioPlayer(segment.uri, { updateInterval: 50 });
      await waitForPlayerLoaded(sound);

      const shouldSeek = segment.startMs != null && segment.startMs > 0;
      if (shouldSeek) {
        await sound.seekTo(segment.startMs! / 1000);
      }

      if (sessionId !== playbackSessionRef.current) {
        try {
          void sound.release();
        } catch {
          // Ignore stale preload unload errors
        }
        return;
      }

      preloadedSegmentRef.current = { index, sound };
    } catch {
      // Preload failures are non-fatal; segment will load on demand.
    }
  };

  const startPredictedProgressAnimation = (
    fromTotalPosition: number,
    targetTotalPosition: number,
    durationOverrideMs?: number
  ) => {
    const from = Math.max(0, fromTotalPosition);
    const target = Math.max(from, targetTotalPosition);
    const distance = target - from;
    const duration =
      durationOverrideMs == null
        ? distance
        : Math.max(0, Math.round(durationOverrideMs));

    animationStartWallClockMsRef.current = Date.now();
    animationStartPositionMsRef.current = from;
    animationTargetPositionMsRef.current = target;
    animationDurationMsRef.current = duration;

    cumulativePositionSharedRef.current.value = from;
    positionSharedRef.current.value = from;

    if (distance <= 0 || duration <= 0) return;

    positionSharedRef.current.value = withTiming(target, {
      duration,
      easing: Easing.linear
    });
  };

  const predictedPositionNow = () => {
    const startedAt = animationStartWallClockMsRef.current;
    if (!startedAt) return null;
    const elapsed = Date.now() - startedAt;
    const duration = animationDurationMsRef.current;
    const from = animationStartPositionMsRef.current;
    const target = animationTargetPositionMsRef.current;
    const distance = target - from;
    if (duration <= 0 || distance <= 0) return target;
    const progress = Math.max(0, Math.min(1, elapsed / duration));
    return from + distance * progress;
  };

  const stopCurrentSound = async () => {
    playbackSessionRef.current += 1;
    const finishingAudioId = currentAudioIdRef.current;
    clearEndpointTimer();
    clearStatusListener();
    isAdvancingSegmentRef.current = false;
    useSequenceLevelProgressRef.current = false;
    hasRetimedLastSegmentRef.current = false;
    resetPredictedProgress();

    // Reset sequence state
    sequenceSegments.current = [];
    currentSequenceIndex.current = 0;
    segmentDurations.current = [];
    cumulativePositionSharedRef.current.value = 0;

    if (soundRef.current) {
      soundRef.current.pause();
      soundRef.current.release();
      soundRef.current = null;
    }
    await unloadPreloadedSegment();

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
      await soundRef.current.seekTo(newPosition / 1000);
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
      playbackSessionRef.current += 1;
      isAdvancingSegmentRef.current = false;
      useSequenceLevelProgressRef.current = false;
      hasRetimedLastSegmentRef.current = false;
      await unloadPreloadedSegment();
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
    clearEndpointTimer();
    if (soundRef.current) {
      clearStatusListener();
      soundRef.current.pause();
      soundRef.current.release();
      soundRef.current = null;
    }
    isAdvancingSegmentRef.current = false;

    // Set up audio mode
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: true
    });

    const shouldSeek = segment.startMs != null && segment.startMs > 0;
    const segmentIndex = currentSequenceIndex.current;
    const preloaded = preloadedSegmentRef.current;
    const canUsePreloaded = preloaded?.index === segmentIndex;
    let lastSegmentRemainingMsAtStart: number | null = null;
    let initialPaddedWallClock: number | null = null;
    let isFirstSegment = false;
    let isLastSegment = false;

    try {
      let sound: AudioPlayer;
      if (canUsePreloaded) {
        sound = preloaded.sound;
        preloadedSegmentRef.current = null;
      } else {
        sound = createAudioPlayer(segment.uri, { updateInterval: 50 });
        await waitForPlayerLoaded(sound);
      }

      soundRef.current = sound;

      if (audioId) {
        setCurrentAudioIdState(audioId);
      }

      // Seek to startMs before starting playback (unless preloaded segment
      // was already seeked during background preload).
      if (shouldSeek && !canUsePreloaded) {
        await sound.seekTo(segment.startMs! / 1000);
      }

      // Get initial status to set the duration
      if (sound.isLoaded) {
        const fullDurationMs = sound.duration * 1000;

        // Effective duration for this segment (respecting start/end)
        const startMs = segment.startMs ?? 0;
        const endMs = segment.endMs ?? fullDurationMs;
        const effectiveDuration = Math.max(0, endMs - startMs);

        // Store this segment's effective duration
        segmentDurations.current[currentSequenceIndex.current] =
          effectiveDuration;

        isFirstSegment = currentSequenceIndex.current === 0;
        isLastSegment =
          currentSequenceIndex.current ===
          sequenceSegments.current.length - 1;

        if (isFirstSegment && !isLastSegment) {
          // Multi-segment: compute padded wall-clock for initial animation
          // (started after sound.play() below).
          const seqTotal = totalSequenceDuration();
          initialPaddedWallClock =
            seqTotal +
            sequenceSegments.current.length * MERGED_SEGMENT_PADDING_MS;
        } else if (isLastSegment && !hasRetimedLastSegmentRef.current) {
          const cumulativeBefore = cumulativeDurationBeforeCurrent();
          const segStartMs = segment.startMs ?? 0;
          const playedInSegmentAtStart = Math.max(
            0,
            sound.currentTime * 1000 - segStartMs
          );
          const playedTotalAtStart =
            cumulativeBefore + playedInSegmentAtStart;
          const remainingTotal =
            totalSequenceDuration() - playedTotalAtStart;
          lastSegmentRemainingMsAtStart = Math.max(0, remainingTotal);
        }
      }

      // Set up listener for position updates + natural completion.
      // Track whether the player has actually started playing, used as a guard
      // so that the !status.playing fallback doesn't fire on initial load.
      let hasStartedPlaying = false;
      soundListenerRef.current = sound.addListener(
        'playbackStatusUpdate',
        (status) => {
          if (!status.isLoaded) {
            return;
          }

          const now = Date.now();
          const currentSeg =
            sequenceSegments.current[currentSequenceIndex.current];
          const cumulativeDuration = cumulativeDurationBeforeCurrent();
          const segStartMs = currentSeg?.startMs ?? 0;
          const currentPositionMs = status.currentTime * 1000;
          const positionInSegment = currentPositionMs - segStartMs;
          const totalPosition =
            cumulativeDuration + Math.max(0, positionInSegment);
          const sequenceTotalDuration = totalSequenceDuration();

          if (status.playing && !hasStartedPlaying) {
            hasStartedPlaying = true;
            setIsPlayingState(true);

            // Start bar at 0% when playback actually starts, then speed-match
            // using measured already-played audio so end-time stays exact.
            if (isFirstSegment) {
              const alreadyPlayed = Math.max(0, totalPosition);
              const durationOverrideMs = isLastSegment
                ? Math.max(0, sequenceTotalDuration - alreadyPlayed)
                : Math.max(
                    0,
                    (initialPaddedWallClock ?? sequenceTotalDuration) -
                      alreadyPlayed
                  );
              startPredictedProgressAnimation(
                0,
                sequenceTotalDuration,
                durationOverrideMs
              );

              if (isLastSegment) {
                hasRetimedLastSegmentRef.current = true;
              }
            } else if (
              isLastSegment &&
              lastSegmentRemainingMsAtStart != null &&
              !hasRetimedLastSegmentRef.current &&
              useSequenceLevelProgressRef.current
            ) {
              const predicted = predictedPositionNow();
              const fromPosition = Math.max(
                cumulativeDurationBeforeCurrent(),
                predicted ?? positionSharedRef.current.value
              );
              if (sequenceTotalDuration > fromPosition) {
                startPredictedProgressAnimation(
                  fromPosition,
                  sequenceTotalDuration,
                  Math.max(0, sequenceTotalDuration - totalPosition)
                );
              }
              hasRetimedLastSegmentRef.current = true;
            }

            statusGuardUntilMsRef.current =
              (animationStartWallClockMsRef.current ?? now) + 1000;
          }

          const guarded = now < statusGuardUntilMsRef.current;

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
          }

          // Safety-net: if the setTimeout timer hasn't fired yet but the
          // native position has already reached/passed endMs, stop now.
          if (
            currentSeg?.endMs != null &&
            currentPositionMs >= currentSeg.endMs - 10 &&
            !isAdvancingSegmentRef.current
          ) {
            isAdvancingSegmentRef.current = true;
            clearEndpointTimer();
            clearStatusListener();
            sound.pause();
            sound.release();
            if (soundRef.current === sound) {
              soundRef.current = null;
            }
            void playNextInSequence();
            return;
          }

          // expo-audio doesn't fire didJustFinish reliably on all platforms.
          // Fallback: treat playing→false (after having started) as completion,
          // since the listener is always removed before any manual pause/stop.
          if (status.didJustFinish || (hasStartedPlaying && !status.playing)) {
            if (isAdvancingSegmentRef.current) return;
            isAdvancingSegmentRef.current = true;
            clearStatusListener();
            sound.release();
            if (soundRef.current === sound) {
              soundRef.current = null;
            }
            // playNextInSequence advances to the next segment, or resets
            // all state if no segments remain.
            void playNextInSequence();
          }
        }
      );
      sound.play();

      // Precise endpoint timer started immediately after play(), using the
      // pre-calculated clip duration. This avoids waiting for a status
      // callback (which can be stale/late) before scheduling the stop.
      if (segment.endMs != null) {
        const seekPos = segment.startMs ?? 0;
        const clipDurationMs = segment.endMs - seekPos;
        if (clipDurationMs > 0) {
          clearEndpointTimer();
          const capturedSession = playbackSessionRef.current;
          endpointTimerRef.current = setTimeout(() => {
            endpointTimerRef.current = null;
            if (capturedSession !== playbackSessionRef.current) return;
            if (isAdvancingSegmentRef.current) return;
            isAdvancingSegmentRef.current = true;
            clearStatusListener();
            sound.pause();
            sound.release();
            if (soundRef.current === sound) {
              soundRef.current = null;
            }
            void playNextInSequence();
          }, clipDurationMs);
        }
      }

      // Preload exactly one segment ahead while current segment is playing.
      if (useSequenceLevelProgressRef.current) {
        const currentSession = playbackSessionRef.current;
        const nextIndex = segmentIndex + 1;
        void preloadSegmentAtIndex(nextIndex, currentSession);
      }
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
    playbackSessionRef.current += 1;

    // Always set up sequence state — even for single segments — so that
    // trim enforcement (startMs/endMs) works via startPositionTracking.
    sequenceSegments.current = segments;
    currentSequenceIndex.current = 0;
    segmentDurations.current = new Array<number>(segments.length).fill(0);
    cumulativePositionSharedRef.current.value = 0;
    useSequenceLevelProgressRef.current = true;
    hasRetimedLastSegmentRef.current = false;

    // Preload durations for accurate total display and padded animation.
    // NOTE: Process sequentially to avoid ExoPlayer threading issues on Android.
    try {
      for (let index = 0; index < segments.length; index++) {
        const seg = segments[index]!;
        const sound = createAudioPlayer(seg.uri);
        await waitForPlayerLoaded(sound);
        if (sound.isLoaded) {
          const fullMs = sound.duration * 1000;
          const startMs = seg.startMs ?? 0;
          const endMs = seg.endMs ?? fullMs;
          segmentDurations.current[index] = Math.max(0, endMs - startMs);
        }
        sound.release();
      }

      const totalDuration = totalSequenceDuration();
      setDuration(totalDuration);
      durationSharedRef.current.value = totalDuration;
    } catch {
      // Failed to preload durations, will calculate on the fly
      useSequenceLevelProgressRef.current = false;
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
      playbackSessionRef.current += 1;
      clearEndpointTimer();
      resetPredictedProgress();
      clearStatusListener();
      if (soundRef.current) {
        soundRef.current.release();
      }
      void unloadPreloadedSegment();
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
 * @param options.stopOnUnmount - Whether to stop audio when component unmounts (default: false)
 */
export function useAudio(options?: { stopOnUnmount?: boolean }) {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }

  // Default to false so transient/virtualized consumers (e.g., list cards)
  // do not accidentally stop shared playback when they unmount.
  const stopOnUnmount = options?.stopOnUnmount ?? false;
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
