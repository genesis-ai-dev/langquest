import { MiniMediaPlayer } from '@/components/MiniMediaPlayer';
import { useAudio } from '@/contexts/AudioContext';
import { useSingleAudioController } from '@/hooks/useSingleAudioController';
import { useLocalStore } from '@/store/localStore';
import React from 'react';
import { AppState } from 'react-native';

const MIN_VALID_POSITION_MS = 500;
const END_MARGIN_MS = 500;
const CHECKPOINT_AUTOSAVE_MS = 5000;

interface CheckpointMediaPlayerProps {
  checkpointKey: string | null;
  audioUris: string[];
  title?: string | null;
  subtitle?: string | null;
  seekStepMs?: number;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  ticks?: { pct: number }[];
  initialPositionMs?: number;
  autoStopMs?: number;
  /** When set with windowEndMs, the player UI and seeks are scoped to this passage window. */
  windowStartMs?: number;
  windowEndMs?: number;
}

function clampToWindow(
  positionMs: number,
  windowStart: number,
  windowEnd: number
): number {
  return Math.max(windowStart, Math.min(positionMs, windowEnd));
}

export function CheckpointMediaPlayer({
  checkpointKey,
  audioUris,
  title,
  subtitle,
  seekStepMs,
  className,
  disabled = false,
  loading: externalLoading = false,
  ticks,
  initialPositionMs,
  autoStopMs,
  windowStartMs,
  windowEndMs
}: CheckpointMediaPlayerProps) {
  const audioContext = useAudio({ stopOnUnmount: false });
  const [isLoadingAudio, setIsLoadingAudio] = React.useState(false);

  const hasWindow =
    typeof windowStartMs === 'number' &&
    typeof windowEndMs === 'number' &&
    windowEndMs > windowStartMs;

  const effectiveAutoStopMs = hasWindow ? windowEndMs : autoStopMs;

  // Refs so the stable checkpointStore closure reads the latest values
  const initialPositionMsRef = React.useRef(initialPositionMs);
  const windowStartMsRef = React.useRef(windowStartMs);
  const windowEndMsRef = React.useRef(windowEndMs);
  React.useEffect(() => {
    initialPositionMsRef.current = initialPositionMs;
    windowStartMsRef.current = windowStartMs;
    windowEndMsRef.current = windowEndMs;
  }, [initialPositionMs, windowStartMs, windowEndMs]);

  const checkpointStore = React.useMemo(
    () => ({
      saveAssetCheckpoint: (
        assetId: string,
        positionMs: number,
        durationMs?: number
      ) => {
        if (!assetId || !Number.isFinite(positionMs)) return;
        const normalizedPosition = Math.max(0, Math.floor(positionMs));

        const windowStart = windowStartMsRef.current;
        const windowEnd = windowEndMsRef.current;
        const inWindow =
          typeof windowStart === 'number' &&
          typeof windowEnd === 'number' &&
          windowEnd > windowStart;

        const shouldClearForStart = inWindow
          ? normalizedPosition <= windowStart + MIN_VALID_POSITION_MS
          : normalizedPosition < MIN_VALID_POSITION_MS;

        const endBoundary = inWindow
          ? windowEnd
          : typeof durationMs === 'number' &&
              Number.isFinite(durationMs) &&
              durationMs > 0
            ? durationMs
            : null;

        const shouldClearForEnd =
          endBoundary != null &&
          normalizedPosition >= Math.max(0, endBoundary - END_MARGIN_MS);

        const { setBibleAudioPosition } = useLocalStore.getState();
        if (shouldClearForStart || shouldClearForEnd) {
          setBibleAudioPosition(assetId, 0);
          return;
        }
        setBibleAudioPosition(assetId, normalizedPosition);
      },
      getAssetCheckpoint: (assetId: string) => {
        const { bibleAudioPositions } = useLocalStore.getState();
        const position = bibleAudioPositions[assetId] ?? 0;
        const saved = Number.isFinite(position)
          ? Math.max(0, Math.floor(position))
          : 0;

        const windowStart = windowStartMsRef.current;
        const windowEnd = windowEndMsRef.current;
        const inWindow =
          typeof windowStart === 'number' &&
          typeof windowEnd === 'number' &&
          windowEnd > windowStart;

        const fallback = inWindow
          ? windowStart
          : (initialPositionMsRef.current ?? 0);

        const resolved = saved > 0 ? saved : fallback;
        if (!inWindow) return resolved;
        return clampToWindow(resolved, windowStart, windowEnd);
      },
      clearAssetCheckpoint: (assetId: string) => {
        const { setBibleAudioPosition } = useLocalStore.getState();
        setBibleAudioPosition(assetId, 0);
      }
    }),
    []
  );

  const {
    playAsset,
    stopAndResetCurrentAsset,
    seekCurrentAssetTo,
    rewindCurrentAsset,
    forwardCurrentAsset
  } = useSingleAudioController({
    audioContext,
    checkpointStore,
    seekStepMs,
    getAssetAudioUris: async (assetId) => {
      if (!checkpointKey || assetId !== checkpointKey) return [];
      return audioUris;
    }
  });

  const isThisActive =
    !!checkpointKey &&
    (audioContext.isPlaying || audioContext.isPaused) &&
    audioContext.currentAudioId === checkpointKey;

  React.useEffect(() => {
    if (isThisActive) {
      setIsLoadingAudio(false);
    }
  }, [isThisActive]);

  const handlePlayPause = React.useCallback(() => {
    if (!isThisActive) {
      setIsLoadingAudio(true);
    }
    void playAsset(checkpointKey!);
  }, [isThisActive, playAsset, checkpointKey]);

  const playbackSnapshotRef = React.useRef({
    isPlaying: false,
    isPaused: false,
    currentAudioId: null as string | null,
    position: 0,
    duration: 0
  });
  const lastPersistAtRef = React.useRef(0);
  const lastPersistPositionRef = React.useRef(0);

  const persistSnapshot = React.useCallback(
    (
      reason: 'unmount' | 'app-background' | 'autosave' | 'pause',
      force = false
    ) => {
      if (!checkpointKey) return;

      const snapshot = playbackSnapshotRef.current;
      const isThisAudio =
        snapshot.currentAudioId === checkpointKey &&
        (snapshot.isPlaying || snapshot.isPaused);
      if (!isThisAudio) return;

      // Avoid excessive writes for periodic autosave.
      if (!force && reason === 'autosave') {
        const movedEnough =
          Math.abs(snapshot.position - lastPersistPositionRef.current) >= 1000;
        const now = Date.now();
        const waitedEnough =
          now - lastPersistAtRef.current >= CHECKPOINT_AUTOSAVE_MS;
        if (!movedEnough || !waitedEnough) return;
      }

      checkpointStore.saveAssetCheckpoint(
        checkpointKey,
        snapshot.position,
        snapshot.duration
      );
      lastPersistAtRef.current = Date.now();
      lastPersistPositionRef.current = snapshot.position;
    },
    [checkpointKey, checkpointStore]
  );

  React.useEffect(() => {
    playbackSnapshotRef.current = {
      isPlaying: audioContext.isPlaying,
      isPaused: audioContext.isPaused,
      currentAudioId: audioContext.currentAudioId,
      position: audioContext.position,
      duration: audioContext.duration
    };
  }, [
    audioContext.isPlaying,
    audioContext.isPaused,
    audioContext.currentAudioId,
    audioContext.position,
    audioContext.duration
  ]);

  // Save latest position when this player unmounts (tab/screen switch).
  React.useEffect(() => {
    return () => {
      persistSnapshot('unmount', true);
    };
  }, [persistSnapshot]);

  // Save immediately when this audio transitions from playing -> paused
  // (e.g. drawer close triggers pauseGlobal outside this component).
  const wasPlayingRef = React.useRef(false);
  React.useEffect(() => {
    const nowPlaying = isThisActive && audioContext.isPlaying;
    const nowPaused = isThisActive && audioContext.isPaused;
    if (wasPlayingRef.current && nowPaused) {
      persistSnapshot('pause', true);
    }
    wasPlayingRef.current = nowPlaying;
  }, [
    isThisActive,
    audioContext.isPlaying,
    audioContext.isPaused,
    persistSnapshot
  ]);

  // Autosave while this audio is active.
  React.useEffect(() => {
    if (!isThisActive) return;
    const intervalId = setInterval(() => {
      persistSnapshot('autosave');
    }, CHECKPOINT_AUTOSAVE_MS);
    return () => clearInterval(intervalId);
  }, [isThisActive, persistSnapshot]);

  // Best-effort save when app goes to background/inactive.
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        persistSnapshot('app-background', true);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [persistSnapshot]);

  // Auto-stop: pause when playback reaches the pericope end boundary
  const hasAutoStoppedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isThisActive) {
      hasAutoStoppedRef.current = false;
      return;
    }
    if (
      effectiveAutoStopMs &&
      audioContext.isPlaying &&
      audioContext.position >= effectiveAutoStopMs &&
      !hasAutoStoppedRef.current
    ) {
      hasAutoStoppedRef.current = true;
      void audioContext.pauseSound();
    }
    if (
      effectiveAutoStopMs &&
      audioContext.position < effectiveAutoStopMs - 1000
    ) {
      hasAutoStoppedRef.current = false;
    }
  }, [
    isThisActive,
    effectiveAutoStopMs,
    audioContext.isPlaying,
    audioContext.position,
    audioContext.pauseSound
  ]);

  // Keep playback inside the passage window when active
  React.useEffect(() => {
    if (!isThisActive || !hasWindow) return;
    const { position } = audioContext;
    if (position < windowStartMs! || position > windowEndMs!) {
      void seekCurrentAssetTo(
        clampToWindow(position, windowStartMs!, windowEndMs!)
      );
    }
  }, [
    isThisActive,
    hasWindow,
    windowStartMs,
    windowEndMs,
    audioContext.position,
    seekCurrentAssetTo
  ]);

  const effectiveSeekStepMs =
    typeof seekStepMs === 'number' &&
    Number.isFinite(seekStepMs) &&
    seekStepMs > 0
      ? seekStepMs
      : 5000;

  const windowDurationMs = hasWindow ? windowEndMs! - windowStartMs! : 0;

  const displayPositionMs = React.useMemo(() => {
    if (!hasWindow) {
      return isThisActive ? audioContext.position : 0;
    }
    if (!isThisActive) return 0;
    return Math.max(
      0,
      Math.min(audioContext.position - windowStartMs!, windowDurationMs)
    );
  }, [
    hasWindow,
    isThisActive,
    audioContext.position,
    windowStartMs,
    windowDurationMs
  ]);

  const displayDurationMs = React.useMemo(() => {
    if (hasWindow) return windowDurationMs;
    return isThisActive ? audioContext.duration : 0;
  }, [hasWindow, isThisActive, audioContext.duration, windowDurationMs]);

  const handleSeek = React.useCallback(
    (displayMs: number) => {
      if (!hasWindow) {
        void seekCurrentAssetTo(displayMs);
        return;
      }
      const absoluteMs = clampToWindow(
        displayMs + windowStartMs!,
        windowStartMs!,
        windowEndMs!
      );
      void seekCurrentAssetTo(absoluteMs);
    },
    [hasWindow, windowStartMs, windowEndMs, seekCurrentAssetTo]
  );

  const handleRewind = React.useCallback(() => {
    if (!hasWindow || !isThisActive) {
      void rewindCurrentAsset();
      return;
    }
    const target = Math.max(
      windowStartMs!,
      audioContext.position - effectiveSeekStepMs
    );
    void seekCurrentAssetTo(target);
  }, [
    hasWindow,
    isThisActive,
    windowStartMs,
    audioContext.position,
    effectiveSeekStepMs,
    rewindCurrentAsset,
    seekCurrentAssetTo
  ]);

  const handleForward = React.useCallback(() => {
    if (!hasWindow || !isThisActive) {
      void forwardCurrentAsset();
      return;
    }
    const target = Math.min(
      windowEndMs!,
      audioContext.position + effectiveSeekStepMs
    );
    void seekCurrentAssetTo(target);
  }, [
    hasWindow,
    isThisActive,
    windowEndMs,
    audioContext.position,
    effectiveSeekStepMs,
    forwardCurrentAsset,
    seekCurrentAssetTo
  ]);

  if (!checkpointKey || audioUris.length === 0) return null;

  return (
    <MiniMediaPlayer
      className={className}
      currentAssetName={title ?? 'Audio'}
      subtitle={subtitle}
      isPlaying={isThisActive && audioContext.isPlaying}
      isPaused={isThisActive && audioContext.isPaused}
      loading={externalLoading || isLoadingAudio}
      positionMs={displayPositionMs}
      durationMs={displayDurationMs}
      onSeek={handleSeek}
      onRewind={handleRewind}
      onPlayPause={handlePlayPause}
      onStop={() => void stopAndResetCurrentAsset()}
      onForward={handleForward}
      disabled={disabled}
      ticks={hasWindow ? undefined : ticks}
    />
  );
}
