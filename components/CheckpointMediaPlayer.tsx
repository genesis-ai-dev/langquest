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
  seekStepMs?: number;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  ticks?: { pct: number }[];
  initialPositionMs?: number;
  autoStopMs?: number;
}

export function CheckpointMediaPlayer({
  checkpointKey,
  audioUris,
  title,
  seekStepMs,
  className,
  disabled = false,
  loading: externalLoading = false,
  ticks,
  initialPositionMs,
  autoStopMs
}: CheckpointMediaPlayerProps) {
  const audioContext = useAudio({ stopOnUnmount: false });
  const [isLoadingAudio, setIsLoadingAudio] = React.useState(false);

  // Ref so the stable checkpointStore closure reads the latest value
  const initialPositionMsRef = React.useRef(initialPositionMs);
  React.useEffect(() => {
    initialPositionMsRef.current = initialPositionMs;
  }, [initialPositionMs]);

  const checkpointStore = React.useMemo(
    () => ({
      saveAssetCheckpoint: (
        assetId: string,
        positionMs: number,
        durationMs?: number
      ) => {
        if (!assetId || !Number.isFinite(positionMs)) return;
        const normalizedPosition = Math.max(0, Math.floor(positionMs));
        const shouldClearForStart = normalizedPosition < MIN_VALID_POSITION_MS;
        const shouldClearForEnd =
          typeof durationMs === 'number' &&
          Number.isFinite(durationMs) &&
          durationMs > 0 &&
          normalizedPosition >= Math.max(0, durationMs - END_MARGIN_MS);

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
        return saved > 0 ? saved : (initialPositionMsRef.current ?? 0);
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
      autoStopMs &&
      audioContext.isPlaying &&
      audioContext.position >= autoStopMs &&
      !hasAutoStoppedRef.current
    ) {
      hasAutoStoppedRef.current = true;
      void audioContext.pauseSound();
    }
    if (autoStopMs && audioContext.position < autoStopMs - 1000) {
      hasAutoStoppedRef.current = false;
    }
  }, [
    isThisActive,
    autoStopMs,
    audioContext.isPlaying,
    audioContext.position,
    audioContext.pauseSound
  ]);

  if (!checkpointKey || audioUris.length === 0) return null;

  return (
    <MiniMediaPlayer
      className={className}
      currentAssetName={title ?? 'Audio'}
      isPlaying={isThisActive && audioContext.isPlaying}
      isPaused={isThisActive && audioContext.isPaused}
      loading={externalLoading || isLoadingAudio}
      positionMs={isThisActive ? audioContext.position : 0}
      durationMs={isThisActive ? audioContext.duration : 0}
      onSeek={(ms) => void seekCurrentAssetTo(ms)}
      onRewind={() => void rewindCurrentAsset()}
      onPlayPause={handlePlayPause}
      onStop={() => void stopAndResetCurrentAsset()}
      onForward={() => void forwardCurrentAsset()}
      disabled={disabled}
      ticks={ticks}
    />
  );
}
