import React from 'react';

type AudioContextLike = {
  isPlaying: boolean;
  isPaused: boolean;
  currentAudioId: string | null;
  position: number;
  duration: number;
  playSound: (uri: string, audioId?: string) => Promise<void>;
  playSoundSequence: (uris: string[], audioId?: string) => Promise<void>;
  pauseSound: () => Promise<void>;
  resumeSound: () => Promise<void>;
  stopCurrentSound: () => Promise<void>;
  setPosition: (position: number) => Promise<void>;
};

type AssetCheckpointStore = {
  saveAssetCheckpoint: (
    assetId: string,
    positionMs: number,
    durationMs?: number
  ) => void;
  getAssetCheckpoint: (assetId: string) => number;
  clearAssetCheckpoint?: (assetId: string) => void;
};

type UseSingleAudioControllerOptions = {
  audioContext: AudioContextLike;
  checkpointStore: AssetCheckpointStore;
  getAssetAudioUris: (assetId: string) => Promise<string[]>;
  seekStepMs?: number;
  onCurrentAssetChange?: (assetId: string | null) => void;
  onNoAudioFound?: (assetId: string) => void;
  onError?: (error: unknown, assetId: string) => void;
  log?: (message: string, assetId: string) => void;
};

const SINGLE_SEEK_STEP_MS = 5000;
const SINGLE_SEEK_DEBOUNCE_MS = 500;

export function useSingleAudioController({
  audioContext,
  checkpointStore,
  getAssetAudioUris,
  seekStepMs,
  onCurrentAssetChange,
  onNoAudioFound,
  onError,
  log
}: UseSingleAudioControllerOptions) {
  const lastSeekActionAtRef = React.useRef(0);
  const effectiveSeekStepMs =
    typeof seekStepMs === 'number' && Number.isFinite(seekStepMs) && seekStepMs > 0
      ? seekStepMs
      : SINGLE_SEEK_STEP_MS;

  const playAsset = React.useCallback(
    async (assetId: string) => {
      try {
        const isThisAssetPlaying =
          audioContext.isPlaying && audioContext.currentAudioId === assetId;
        const isThisAssetPaused =
          audioContext.isPaused && audioContext.currentAudioId === assetId;

        if (isThisAssetPlaying) {
          log?.('pause', assetId);
          checkpointStore.saveAssetCheckpoint(
            assetId,
            audioContext.position,
            audioContext.duration
          );
          await audioContext.pauseSound();
          onCurrentAssetChange?.(assetId);
          return;
        }

        if (isThisAssetPaused) {
          log?.('resume', assetId);
          await audioContext.resumeSound();
          onCurrentAssetChange?.(assetId);
          return;
        }

        if (
          audioContext.currentAudioId &&
          (audioContext.isPlaying || audioContext.isPaused)
        ) {
          checkpointStore.saveAssetCheckpoint(
            audioContext.currentAudioId,
            audioContext.position,
            audioContext.duration
          );
          await audioContext.stopCurrentSound();
        }

        log?.('play', assetId);
        const uris = await getAssetAudioUris(assetId);
        if (uris.length === 0) {
          onNoAudioFound?.(assetId);
          return;
        }

        onCurrentAssetChange?.(assetId);
        if (uris.length === 1 && uris[0]) {
          await audioContext.playSound(uris[0], assetId);
        } else {
          await audioContext.playSoundSequence(uris, assetId);
        }

        // Resume from last known position for this asset (if any).
        const savedPosition = checkpointStore.getAssetCheckpoint(assetId);
        if (savedPosition > 0) {
          await audioContext.setPosition(savedPosition);
        }
      } catch (error) {
        onError?.(error, assetId);
      }
    },
    [
      audioContext,
      checkpointStore,
      getAssetAudioUris,
      log,
      onCurrentAssetChange,
      onError,
      onNoAudioFound
    ]
  );

  const toggleCurrentAssetPlayPause = React.useCallback(async () => {
    const currentAssetId = audioContext.currentAudioId;
    if (!currentAssetId) {
      return;
    }

    if (audioContext.isPlaying) {
      checkpointStore.saveAssetCheckpoint(
        currentAssetId,
        audioContext.position,
        audioContext.duration
      );
      await audioContext.pauseSound();
      onCurrentAssetChange?.(currentAssetId);
      return;
    }

    if (audioContext.isPaused) {
      await audioContext.resumeSound();
      onCurrentAssetChange?.(currentAssetId);
    }
  }, [
    audioContext,
    checkpointStore,
    onCurrentAssetChange
  ]);

  const stopAndResetCurrentAsset = React.useCallback(async () => {
    const currentAssetId = audioContext.currentAudioId;
    if (!currentAssetId) {
      return;
    }

    await audioContext.stopCurrentSound();
    checkpointStore.clearAssetCheckpoint?.(currentAssetId);
    onCurrentAssetChange?.(null);
  }, [audioContext, checkpointStore, onCurrentAssetChange]);

  const seekCurrentAssetBy = React.useCallback(
    async (deltaMs: number) => {
      const currentAssetId = audioContext.currentAudioId;
      if (!currentAssetId || (!audioContext.isPlaying && !audioContext.isPaused)) {
        return;
      }

      const now = Date.now();
      if (now - lastSeekActionAtRef.current < SINGLE_SEEK_DEBOUNCE_MS) {
        return;
      }
      lastSeekActionAtRef.current = now;

      const safeDuration = Math.max(0, audioContext.duration);
      const target = audioContext.position + deltaMs;
      const nextPosition =
        safeDuration > 0
          ? Math.max(0, Math.min(target, safeDuration))
          : Math.max(0, target);

      await audioContext.setPosition(nextPosition);
      checkpointStore.saveAssetCheckpoint(currentAssetId, nextPosition, safeDuration);
    },
    [audioContext, checkpointStore]
  );

  const rewindCurrentAsset = React.useCallback(
    async (stepMs?: number) => {
      const effectiveStep =
        typeof stepMs === 'number' && Number.isFinite(stepMs) && stepMs > 0
          ? stepMs
          : effectiveSeekStepMs;
      await seekCurrentAssetBy(-effectiveStep);
    },
    [effectiveSeekStepMs, seekCurrentAssetBy]
  );

  const forwardCurrentAsset = React.useCallback(
    async (stepMs?: number) => {
      const effectiveStep =
        typeof stepMs === 'number' && Number.isFinite(stepMs) && stepMs > 0
          ? stepMs
          : effectiveSeekStepMs;
      await seekCurrentAssetBy(effectiveStep);
    },
    [effectiveSeekStepMs, seekCurrentAssetBy]
  );

  return {
    playAsset,
    toggleCurrentAssetPlayPause,
    stopAndResetCurrentAsset,
    rewindCurrentAsset,
    forwardCurrentAsset
  };
}
