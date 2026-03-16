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
};

type UseSingleAudioControllerOptions = {
  audioContext: AudioContextLike;
  checkpointStore: AssetCheckpointStore;
  getAssetAudioUris: (assetId: string) => Promise<string[]>;
  onCurrentAssetChange?: (assetId: string | null) => void;
  onNoAudioFound?: (assetId: string) => void;
  onError?: (error: unknown, assetId: string) => void;
  log?: (message: string, assetId: string) => void;
};

export function useSingleAudioController({
  audioContext,
  checkpointStore,
  getAssetAudioUris,
  onCurrentAssetChange,
  onNoAudioFound,
  onError,
  log
}: UseSingleAudioControllerOptions) {
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
          onCurrentAssetChange?.(null);
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

  return { playAsset };
}
