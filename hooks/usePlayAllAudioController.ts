import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import React from 'react';
import type { PlayAllCheckpoint } from './useAudioPlaybackCheckpoint';

type PlaybackStatus = {
  playing: boolean;
  didJustFinish: boolean;
  currentTime: number;
  duration: number;
};

type PlayAllCheckpointStore = {
  savePlayAllCheckpoint: (
    checkpoint: PlayAllCheckpoint,
    options?: { force?: boolean; throttleMs?: number }
  ) => void;
  getPlayAllCheckpoint: () => PlayAllCheckpoint | null;
  clearPlayAllCheckpoint: () => void;
};

export type PlayAllPlaylistItem = {
  assetId: string;
  uris: string[];
  metadata?: {
    label?: string;
    listIndex?: number;
  };
};

type CurrentAssetPayload = {
  assetId: string | null;
  itemIndex: number | null;
  metadata?: PlayAllPlaylistItem['metadata'];
};

type StatusPayload = {
  item: PlayAllPlaylistItem;
  itemIndex: number;
  uriIndex: number;
  playlistLength: number;
};

type UsePlayAllAudioControllerOptions = {
  checkpointStore: PlayAllCheckpointStore;
  onCurrentAssetChange?: (payload: CurrentAssetPayload) => void;
  onPlaybackStatusUpdate?: (
    status: PlaybackStatus,
    payload: StatusPayload
  ) => void;
  onStopped?: () => void;
  onFinished?: () => void;
  onError?: (error: unknown) => void;
};

type TogglePlayAllOptions = {
  playlist: PlayAllPlaylistItem[];
  startItemIndex?: number;
  playlistKey?: string;
};

type StopReason = 'manual' | 'cancelled' | 'finished' | 'error';
type StopOptions = {
  clearCheckpoint?: boolean;
  persistPosition?: boolean;
};

export function usePlayAllAudioController({
  checkpointStore,
  onCurrentAssetChange,
  onPlaybackStatusUpdate,
  onStopped,
  onFinished,
  onError
}: UsePlayAllAudioControllerOptions) {
  const [isPlayAllRunning, setIsPlayAllRunning] = React.useState(false);
  const [isPlayAllPaused, setIsPlayAllPaused] = React.useState(false);
  const isPlayAllRunningRef = React.useRef(false);
  const isPlayAllPausedRef = React.useRef(false);
  const currentPlayerRef = React.useRef<AudioPlayer | null>(null);
  const currentPlayerSubscriptionRef = React.useRef<{ remove: () => void } | null>(
    null
  );
  const currentSegmentResolveRef = React.useRef<(() => void) | null>(null);
  const seekTimeoutIdsRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );
  const currentPlaylistKeyRef = React.useRef<string | null>(null);
  const currentItemIndexRef = React.useRef<number | null>(null);
  const currentUriIndexRef = React.useRef<number | null>(null);

  const onCurrentAssetChangeRef = React.useRef(onCurrentAssetChange);
  const onPlaybackStatusUpdateRef = React.useRef(onPlaybackStatusUpdate);
  const onStoppedRef = React.useRef(onStopped);
  const onFinishedRef = React.useRef(onFinished);
  const onErrorRef = React.useRef(onError);

  React.useEffect(() => {
    onCurrentAssetChangeRef.current = onCurrentAssetChange;
  }, [onCurrentAssetChange]);
  React.useEffect(() => {
    onPlaybackStatusUpdateRef.current = onPlaybackStatusUpdate;
  }, [onPlaybackStatusUpdate]);
  React.useEffect(() => {
    onStoppedRef.current = onStopped;
  }, [onStopped]);
  React.useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const clearSeekTimeouts = React.useCallback(() => {
    seekTimeoutIdsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    seekTimeoutIdsRef.current.clear();
  }, []);

  const notifyCurrentAssetChange = React.useCallback(
    (payload: CurrentAssetPayload) => {
      onCurrentAssetChangeRef.current?.(payload);
    },
    []
  );

  const releaseCurrentPlayer = React.useCallback(() => {
    currentPlayerSubscriptionRef.current?.remove();
    currentPlayerSubscriptionRef.current = null;

    if (!currentPlayerRef.current) {
      return;
    }

    try {
      currentPlayerRef.current.pause();
      currentPlayerRef.current.release();
    } catch {
      // Ignore release errors during stop/cleanup
    } finally {
      currentPlayerRef.current = null;
    }
  }, []);

  const persistCurrentPosition = React.useCallback(() => {
    if (
      !currentPlayerRef.current ||
      !currentPlayerRef.current.isLoaded ||
      !currentPlaylistKeyRef.current ||
      currentItemIndexRef.current === null ||
      currentUriIndexRef.current === null
    ) {
      return;
    }

    checkpointStore.savePlayAllCheckpoint(
      {
        playlistKey: currentPlaylistKeyRef.current,
        itemIndex: currentItemIndexRef.current,
        uriIndex: currentUriIndexRef.current,
        positionMs: currentPlayerRef.current.currentTime * 1000
      },
      { force: true }
    );
  }, [checkpointStore]);

  const stopPlayAll = React.useCallback(
    (reason: StopReason = 'manual', options?: StopOptions) => {
      const shouldPersistPosition = options?.persistPosition ?? reason === 'manual';
      const shouldClearCheckpoint =
        options?.clearCheckpoint ?? (reason === 'finished' || reason === 'error');

      if (shouldPersistPosition) {
        persistCurrentPosition();
      }

      isPlayAllRunningRef.current = false;
      isPlayAllPausedRef.current = false;
      setIsPlayAllRunning(false);
      setIsPlayAllPaused(false);

      currentSegmentResolveRef.current?.();
      currentSegmentResolveRef.current = null;

      releaseCurrentPlayer();
      clearSeekTimeouts();

      currentPlaylistKeyRef.current = null;
      currentItemIndexRef.current = null;
      currentUriIndexRef.current = null;

      notifyCurrentAssetChange({ assetId: null, itemIndex: null });

      if (shouldClearCheckpoint) {
        checkpointStore.clearPlayAllCheckpoint();
      }

      if (reason === 'manual') {
        onStoppedRef.current?.();
      } else if (reason === 'finished') {
        onFinishedRef.current?.();
      }
    },
    [
      checkpointStore,
      clearSeekTimeouts,
      notifyCurrentAssetChange,
      persistCurrentPosition,
      releaseCurrentPlayer
    ]
  );

  const pausePlayAll = React.useCallback(() => {
    if (
      !isPlayAllRunningRef.current ||
      isPlayAllPausedRef.current ||
      !currentPlayerRef.current
    ) {
      return;
    }

    try {
      persistCurrentPosition();
      currentPlayerRef.current.pause();
      isPlayAllPausedRef.current = true;
      setIsPlayAllPaused(true);
    } catch {
      // Ignore pause errors and keep current state.
    }
  }, [persistCurrentPosition]);

  const resumePlayAll = React.useCallback(() => {
    if (
      !isPlayAllRunningRef.current ||
      !isPlayAllPausedRef.current ||
      !currentPlayerRef.current
    ) {
      return;
    }

    try {
      currentPlayerRef.current.play();
      isPlayAllPausedRef.current = false;
      setIsPlayAllPaused(false);
    } catch {
      // Ignore resume errors and keep current state.
    }
  }, []);

  const togglePlayPausePlayAll = React.useCallback(() => {
    if (!isPlayAllRunningRef.current) {
      return;
    }
    if (isPlayAllPausedRef.current) {
      resumePlayAll();
      return;
    }
    pausePlayAll();
  }, [pausePlayAll, resumePlayAll]);

  const stopAndResetPlayAll = React.useCallback(() => {
    stopPlayAll('manual', {
      clearCheckpoint: true,
      persistPosition: false
    });
  }, [stopPlayAll]);

  const togglePlayAll = React.useCallback(
    async ({ playlist, startItemIndex = 0, playlistKey }: TogglePlayAllOptions) => {
      if (isPlayAllRunningRef.current) {
        stopPlayAll('manual');
        return;
      }

      if (playlist.length === 0) {
        return;
      }

      const effectivePlaylistKey =
        playlistKey ??
        playlist.map((item) => `${item.assetId}:${item.uris.length}`).join('|');

      const savedCheckpoint = checkpointStore.getPlayAllCheckpoint();
      const shouldResume =
        savedCheckpoint?.playlistKey === effectivePlaylistKey &&
        savedCheckpoint.itemIndex >= 0;

      const resolvedStartItemIndex = shouldResume
        ? Math.min(savedCheckpoint.itemIndex, playlist.length - 1)
        : Math.min(Math.max(0, startItemIndex), playlist.length - 1);

      if (resolvedStartItemIndex >= playlist.length) {
        return;
      }

      isPlayAllRunningRef.current = true;
      isPlayAllPausedRef.current = false;
      setIsPlayAllRunning(true);
      setIsPlayAllPaused(false);
      currentPlaylistKeyRef.current = effectivePlaylistKey;

      try {
        for (
          let itemIndex = resolvedStartItemIndex;
          itemIndex < playlist.length;
          itemIndex++
        ) {
          if (!isPlayAllRunningRef.current) {
            stopPlayAll('cancelled');
            return;
          }

          const item = playlist[itemIndex];
          if (!item || item.uris.length === 0) {
            continue;
          }

          notifyCurrentAssetChange({
            assetId: item.assetId,
            itemIndex,
            metadata: item.metadata
          });

          const startUriIndex =
            shouldResume &&
            savedCheckpoint &&
            itemIndex === resolvedStartItemIndex &&
            savedCheckpoint.uriIndex >= 0
              ? Math.min(savedCheckpoint.uriIndex, item.uris.length - 1)
              : 0;

          for (
            let uriIndex = startUriIndex;
            uriIndex < item.uris.length;
            uriIndex++
          ) {
            if (!isPlayAllRunningRef.current) {
              stopPlayAll('cancelled');
              return;
            }

            const uri = item.uris[uriIndex];
            if (!uri) {
              continue;
            }

            currentItemIndexRef.current = itemIndex;
            currentUriIndexRef.current = uriIndex;

            const resumePositionMs =
              shouldResume &&
              savedCheckpoint &&
              itemIndex === resolvedStartItemIndex &&
              uriIndex === startUriIndex
                ? Math.max(0, savedCheckpoint.positionMs)
                : 0;

            await new Promise<void>((resolve) => {
              let settled = false;
              const settle = () => {
                if (settled) {
                  return;
                }
                settled = true;
                currentSegmentResolveRef.current = null;
                resolve();
              };

              currentSegmentResolveRef.current = settle;

              try {
                const player = createAudioPlayer(uri);
                currentPlayerRef.current = player;
                player.play();

                if (resumePositionMs > 0) {
                  const seekInterval = setInterval(() => {
                    if (!player.isLoaded) {
                      return;
                    }
                    clearInterval(seekInterval);
                    player.seekTo(resumePositionMs / 1000);
                  }, 20);

                  const seekTimeoutId = setTimeout(() => {
                    clearInterval(seekInterval);
                    seekTimeoutIdsRef.current.delete(seekTimeoutId);
                  }, 2000);
                  seekTimeoutIdsRef.current.add(seekTimeoutId);
                }

                currentPlayerSubscriptionRef.current = player.addListener(
                  'playbackStatusUpdate',
                  (status) => {
                    const playbackStatus = status as PlaybackStatus;

                    onPlaybackStatusUpdateRef.current?.(playbackStatus, {
                      item,
                      itemIndex,
                      uriIndex,
                      playlistLength: playlist.length
                    });

                    if (playbackStatus.playing) {
                      checkpointStore.savePlayAllCheckpoint({
                        playlistKey: effectivePlaylistKey,
                        itemIndex,
                        uriIndex,
                        positionMs: playbackStatus.currentTime * 1000
                      });
                    }

                    if (!playbackStatus.didJustFinish) {
                      return;
                    }

                    const isLastUriInItem = uriIndex >= item.uris.length - 1;
                    const nextItemIndex = isLastUriInItem
                      ? itemIndex + 1
                      : itemIndex;
                    const nextUriIndex = isLastUriInItem ? 0 : uriIndex + 1;

                    if (nextItemIndex < playlist.length) {
                      checkpointStore.savePlayAllCheckpoint(
                        {
                          playlistKey: effectivePlaylistKey,
                          itemIndex: nextItemIndex,
                          uriIndex: nextUriIndex,
                          positionMs: 0
                        },
                        { force: true }
                      );
                    } else {
                      checkpointStore.clearPlayAllCheckpoint();
                    }

                    releaseCurrentPlayer();
                    settle();
                  }
                );
              } catch {
                releaseCurrentPlayer();
                settle();
              }
            });
          }
        }

        stopPlayAll('finished');
      } catch (error) {
        onErrorRef.current?.(error);
        stopPlayAll('error');
      }
    },
    [checkpointStore, notifyCurrentAssetChange, releaseCurrentPlayer, stopPlayAll]
  );

  React.useEffect(() => {
    return () => {
      stopPlayAll('manual');
    };
  }, [stopPlayAll]);

  return {
    isPlayAllRunning,
    isPlayAllPaused,
    isPlayAllRunningRef,
    isPlayAllPausedRef,
    togglePlayAll,
    stopPlayAll,
    stopAndResetPlayAll,
    pausePlayAll,
    resumePlayAll,
    togglePlayPausePlayAll
  };
}
