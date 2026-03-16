import React from 'react';

export type PlayAllCheckpoint = {
  playlistKey: string;
  itemIndex: number;
  uriIndex: number;
  positionMs: number;
};

type SavePlayAllCheckpointOptions = {
  force?: boolean;
  throttleMs?: number;
};

const DEFAULT_PLAY_ALL_THROTTLE_MS = 500;
const MIN_VALID_POSITION_MS = 500;
const END_MARGIN_MS = 500;

export function useAudioPlaybackCheckpoint() {
  const assetCheckpointMapRef = React.useRef<Map<string, number>>(new Map());
  const playAllCheckpointRef = React.useRef<PlayAllCheckpoint | null>(null);
  const lastPlayAllUpdateAtRef = React.useRef(0);

  const saveAssetCheckpoint = React.useCallback(
    (assetId: string, positionMs: number, durationMs?: number) => {
      if (!assetId || !Number.isFinite(positionMs)) {
        return;
      }

      const normalizedPosition = Math.max(0, Math.floor(positionMs));
      if (normalizedPosition < MIN_VALID_POSITION_MS) {
        assetCheckpointMapRef.current.delete(assetId);
        return;
      }

      if (
        typeof durationMs === 'number' &&
        Number.isFinite(durationMs) &&
        durationMs > 0 &&
        normalizedPosition >= Math.max(0, durationMs - END_MARGIN_MS)
      ) {
        assetCheckpointMapRef.current.delete(assetId);
        return;
      }

      assetCheckpointMapRef.current.set(assetId, normalizedPosition);
    },
    []
  );

  const getAssetCheckpoint = React.useCallback((assetId: string): number => {
    return assetCheckpointMapRef.current.get(assetId) ?? 0;
  }, []);

  const clearAssetCheckpoint = React.useCallback((assetId: string) => {
    assetCheckpointMapRef.current.delete(assetId);
  }, []);

  const savePlayAllCheckpoint = React.useCallback(
    (checkpoint: PlayAllCheckpoint, options?: SavePlayAllCheckpointOptions) => {
      if (!checkpoint.playlistKey || !Number.isFinite(checkpoint.positionMs)) {
        return;
      }

      const now = Date.now();
      const force = options?.force === true;
      const throttleMs = options?.throttleMs ?? DEFAULT_PLAY_ALL_THROTTLE_MS;
      if (!force && now - lastPlayAllUpdateAtRef.current < throttleMs) {
        return;
      }

      playAllCheckpointRef.current = {
        ...checkpoint,
        positionMs: Math.max(0, Math.floor(checkpoint.positionMs))
      };
      lastPlayAllUpdateAtRef.current = now;
    },
    []
  );

  const getPlayAllCheckpoint = React.useCallback((): PlayAllCheckpoint | null => {
    return playAllCheckpointRef.current;
  }, []);

  const clearPlayAllCheckpoint = React.useCallback(() => {
    playAllCheckpointRef.current = null;
    lastPlayAllUpdateAtRef.current = 0;
  }, []);

  const clearAllCheckpoints = React.useCallback(() => {
    assetCheckpointMapRef.current.clear();
    playAllCheckpointRef.current = null;
    lastPlayAllUpdateAtRef.current = 0;
  }, []);

  return {
    saveAssetCheckpoint,
    getAssetCheckpoint,
    clearAssetCheckpoint,
    savePlayAllCheckpoint,
    getPlayAllCheckpoint,
    clearPlayAllCheckpoint,
    clearAllCheckpoints
  };
}
