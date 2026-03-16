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

type PlayAllSeekMode = 'boundary-jump' | 'carry-over';

type UsePlayAllAudioControllerOptions = {
  checkpointStore: PlayAllCheckpointStore;
  seekMode?: PlayAllSeekMode;
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

type PlayAllJumpTarget = {
  itemIndex: number;
  uriIndex: number;
  positionMs: number;
};

const DEFAULT_SEEK_STEP_MS = 5000;
const SEEK_DEBOUNCE_MS = 500;

export function usePlayAllAudioController({
  checkpointStore,
  seekMode = 'boundary-jump',
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
  const currentPlaylistRef = React.useRef<PlayAllPlaylistItem[]>([]);
  const currentItemIndexRef = React.useRef<number | null>(null);
  const currentUriIndexRef = React.useRef<number | null>(null);
  const pendingJumpTargetRef = React.useRef<PlayAllJumpTarget | null>(null);
  const segmentDurationMsMapRef = React.useRef<Map<string, number>>(new Map());
  const lastSeekActionAtRef = React.useRef(0);
  const lastSegmentPositionMsRef = React.useRef(0);
  const lastSegmentDurationMsRef = React.useRef(0);
  const lastStatusItemIndexRef = React.useRef<number | null>(null);
  const lastStatusUriIndexRef = React.useRef<number | null>(null);

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
      currentPlaylistRef.current = [];
      currentItemIndexRef.current = null;
      currentUriIndexRef.current = null;
      pendingJumpTargetRef.current = null;
      lastSegmentPositionMsRef.current = 0;
      lastSegmentDurationMsRef.current = 0;
      lastStatusItemIndexRef.current = null;
      lastStatusUriIndexRef.current = null;

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

  const navigateToItemIndex = React.useCallback(
    (targetItemIndex: number) => {
      if (
        !isPlayAllRunningRef.current ||
        !currentPlaylistKeyRef.current ||
        currentPlaylistRef.current.length === 0
      ) {
        return;
      }

      const clampedTargetItemIndex = Math.max(
        0,
        Math.min(targetItemIndex, currentPlaylistRef.current.length - 1)
      );
      pendingJumpTargetRef.current = {
        itemIndex: clampedTargetItemIndex,
        uriIndex: 0,
        positionMs: 0
      };

      checkpointStore.savePlayAllCheckpoint(
        {
          playlistKey: currentPlaylistKeyRef.current,
          itemIndex: clampedTargetItemIndex,
          uriIndex: 0,
          positionMs: 0
        },
        { force: true }
      );

      isPlayAllPausedRef.current = false;
      setIsPlayAllPaused(false);
      releaseCurrentPlayer();
      currentSegmentResolveRef.current?.();
    },
    [checkpointStore, releaseCurrentPlayer]
  );

  const seekInCurrentSegment = React.useCallback(
    (deltaMs: number) => {
      if (
        !isPlayAllRunningRef.current ||
        !currentPlaylistKeyRef.current ||
        currentItemIndexRef.current === null ||
        currentUriIndexRef.current === null ||
        !currentPlayerRef.current ||
        !currentPlayerRef.current.isLoaded
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastSeekActionAtRef.current < SEEK_DEBOUNCE_MS) {
        return;
      }
      lastSeekActionAtRef.current = now;

      const playlist = currentPlaylistRef.current;
      if (playlist.length === 0) {
        return;
      }

      const currentItemIndex = currentItemIndexRef.current;
      const currentUriIndex = currentUriIndexRef.current;
      const currentItem = playlist[currentItemIndex];
      if (!currentItem || currentUriIndex >= currentItem.uris.length) {
        return;
      }

      const rawPlayerCurrentTimeMs = currentPlayerRef.current.currentTime * 1000;
      const rawPlayerDurationMs = currentPlayerRef.current.duration * 1000;
      const playerPositionMs = Number.isFinite(rawPlayerCurrentTimeMs)
        ? Math.max(0, rawPlayerCurrentTimeMs)
        : 0;
      const playerDurationMs = Number.isFinite(rawPlayerDurationMs)
        ? Math.max(0, rawPlayerDurationMs)
        : 0;
      const hasStatusForCurrentSegment =
        lastStatusItemIndexRef.current === currentItemIndex &&
        lastStatusUriIndexRef.current === currentUriIndex;
      const statusPositionMs = hasStatusForCurrentSegment
        ? Math.max(0, lastSegmentPositionMsRef.current)
        : 0;
      const currentSegmentCacheKey = `${currentItemIndex}:${currentUriIndex}`;
      const cachedCurrentDurationMs = Math.max(
        0,
        segmentDurationMsMapRef.current.get(currentSegmentCacheKey) ?? 0
      );
      const statusDurationMs = hasStatusForCurrentSegment
        ? Math.max(0, lastSegmentDurationMsRef.current)
        : 0;
      // Use the most conservative "known good" values to avoid jumping segments due to stale 0s.
      const currentPositionMs = Math.max(playerPositionMs, statusPositionMs);
      const currentDurationMs = Math.max(
        playerDurationMs,
        cachedCurrentDurationMs,
        statusDurationMs
      );

      const getSegmentDurationMs = (itemIndex: number, uriIndex: number) => {
        const key = `${itemIndex}:${uriIndex}`;
        const cached = segmentDurationMsMapRef.current.get(key);
        if (typeof cached === 'number' && cached > 0) {
          return cached;
        }
        if (itemIndex === currentItemIndex && uriIndex === currentUriIndex) {
          return currentDurationMs > 0 ? currentDurationMs : null;
        }
        return null;
      };

      const jumpTo = (target: PlayAllJumpTarget) => {
        if (!currentPlaylistKeyRef.current) {
          return;
        }
        pendingJumpTargetRef.current = target;
        checkpointStore.savePlayAllCheckpoint(
          {
            playlistKey: currentPlaylistKeyRef.current,
            itemIndex: target.itemIndex,
            uriIndex: target.uriIndex,
            positionMs: target.positionMs
          },
          { force: true }
        );
        isPlayAllPausedRef.current = false;
        setIsPlayAllPaused(false);
        releaseCurrentPlayer();
        currentSegmentResolveRef.current?.();
      };

      const applyLocalSeek = (positionMs: number) => {
        const safeDurationMs = currentDurationMs > 0 ? currentDurationMs : positionMs;
        const clampedPositionMs = Math.max(0, Math.min(positionMs, safeDurationMs));
        currentPlayerRef.current?.seekTo(clampedPositionMs / 1000);
        lastSegmentPositionMsRef.current = clampedPositionMs;
        checkpointStore.savePlayAllCheckpoint(
          {
            playlistKey: currentPlaylistKeyRef.current!,
            itemIndex: currentItemIndex,
            uriIndex: currentUriIndex,
            positionMs: clampedPositionMs
          },
          { force: true }
        );
      };

      const resolveBoundaryJumpTarget = (): PlayAllJumpTarget | null => {
        if (deltaMs < 0) {
          const targetPosition = currentPositionMs + deltaMs;
          if (targetPosition >= 0) {
            applyLocalSeek(targetPosition);
            return null;
          }
          if (currentUriIndex > 0) {
            return {
              itemIndex: currentItemIndex,
              uriIndex: currentUriIndex - 1,
              positionMs: 0
            };
          }
          if (currentItemIndex > 0) {
            const prevItemIndex = currentItemIndex - 1;
            const prevItem = playlist[prevItemIndex];
            const lastUriIndex = Math.max(0, (prevItem?.uris.length ?? 1) - 1);
            return {
              itemIndex: prevItemIndex,
              uriIndex: lastUriIndex,
              positionMs: 0
            };
          }
          applyLocalSeek(0);
          return null;
        }

        const targetPosition = currentPositionMs + deltaMs;
        if (currentDurationMs <= 0) {
          // When duration is unknown, prefer local seek to avoid accidental jumps.
          applyLocalSeek(targetPosition);
          return null;
        }
        if (targetPosition <= currentDurationMs) {
          applyLocalSeek(targetPosition);
          return null;
        }
        if (currentUriIndex < currentItem.uris.length - 1) {
          return {
            itemIndex: currentItemIndex,
            uriIndex: currentUriIndex + 1,
            positionMs: 0
          };
        }
        if (currentItemIndex < playlist.length - 1) {
          return {
            itemIndex: currentItemIndex + 1,
            uriIndex: 0,
            positionMs: 0
          };
        }
        applyLocalSeek(currentDurationMs);
        return null;
      };

      const resolveCarryOverTarget = (): PlayAllJumpTarget | null => {
        if (deltaMs === 0) {
          return null;
        }

        if (deltaMs < 0) {
          let remainingMs = Math.abs(deltaMs);
          let probeItemIndex = currentItemIndex;
          let probeUriIndex = currentUriIndex;
          let probePositionMs = currentPositionMs;

          while (remainingMs > 0) {
            if (probePositionMs >= remainingMs) {
              return {
                itemIndex: probeItemIndex,
                uriIndex: probeUriIndex,
                positionMs: probePositionMs - remainingMs
              };
            }

            remainingMs -= probePositionMs;
            if (probeUriIndex > 0) {
              probeUriIndex -= 1;
            } else if (probeItemIndex > 0) {
              probeItemIndex -= 1;
              const prevItem = playlist[probeItemIndex];
              probeUriIndex = Math.max(0, (prevItem?.uris.length ?? 1) - 1);
            } else {
              return {
                itemIndex: 0,
                uriIndex: 0,
                positionMs: 0
              };
            }

            const prevDurationMs = getSegmentDurationMs(probeItemIndex, probeUriIndex);
            if (prevDurationMs === null) {
              return {
                itemIndex: probeItemIndex,
                uriIndex: probeUriIndex,
                positionMs: 0
              };
            }
            probePositionMs = prevDurationMs;
          }
          return null;
        }

        let remainingMs = deltaMs;
        let probeItemIndex = currentItemIndex;
        let probeUriIndex = currentUriIndex;
        let probePositionMs = currentPositionMs;

        while (remainingMs > 0) {
          const probeDurationMs = getSegmentDurationMs(probeItemIndex, probeUriIndex);
          if (probeDurationMs === null) {
            return {
              itemIndex: probeItemIndex,
              uriIndex: probeUriIndex,
              positionMs: probePositionMs
            };
          }

          const availableMs = Math.max(0, probeDurationMs - probePositionMs);
          if (remainingMs <= availableMs) {
            return {
              itemIndex: probeItemIndex,
              uriIndex: probeUriIndex,
              positionMs: probePositionMs + remainingMs
            };
          }

          remainingMs -= availableMs;
          const probeItem = playlist[probeItemIndex];
          if (probeUriIndex < (probeItem?.uris.length ?? 1) - 1) {
            probeUriIndex += 1;
          } else if (probeItemIndex < playlist.length - 1) {
            probeItemIndex += 1;
            probeUriIndex = 0;
          } else {
            return {
              itemIndex: probeItemIndex,
              uriIndex: probeUriIndex,
              positionMs: probeDurationMs
            };
          }
          probePositionMs = 0;
        }
        return null;
      };

      const target =
        seekMode === 'carry-over'
          ? resolveCarryOverTarget()
          : resolveBoundaryJumpTarget();

      if (!target) {
        return;
      }

      if (target.itemIndex === currentItemIndex && target.uriIndex === currentUriIndex) {
        applyLocalSeek(target.positionMs);
        return;
      }

      jumpTo(target);
    },
    [checkpointStore, releaseCurrentPlayer, seekMode]
  );

  const rewindPlayAll = React.useCallback(() => {
    seekInCurrentSegment(-DEFAULT_SEEK_STEP_MS);
  }, [seekInCurrentSegment]);

  const forwardPlayAll = React.useCallback(() => {
    seekInCurrentSegment(DEFAULT_SEEK_STEP_MS);
  }, [seekInCurrentSegment]);

  const nextPlayAllItem = React.useCallback(() => {
    if (
      !isPlayAllRunningRef.current ||
      currentItemIndexRef.current === null ||
      currentPlaylistRef.current.length === 0
    ) {
      return;
    }

    const targetItemIndex = Math.min(
      currentItemIndexRef.current + 1,
      currentPlaylistRef.current.length - 1
    );
    if (targetItemIndex === currentItemIndexRef.current) {
      return;
    }
    navigateToItemIndex(targetItemIndex);
  }, [navigateToItemIndex]);

  const previousPlayAllItem = React.useCallback(() => {
    if (!isPlayAllRunningRef.current || currentItemIndexRef.current === null) {
      return;
    }

    const targetItemIndex = Math.max(currentItemIndexRef.current - 1, 0);
    if (targetItemIndex === currentItemIndexRef.current) {
      return;
    }
    navigateToItemIndex(targetItemIndex);
  }, [navigateToItemIndex]);

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
      currentPlaylistRef.current = playlist;
      pendingJumpTargetRef.current = null;

      let shouldUseInitialCheckpoint = shouldResume;

      try {
        for (let itemIndex = resolvedStartItemIndex; itemIndex < playlist.length; ) {
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

          const pendingJumpTargetForCurrentItem = (() => {
            const value = pendingJumpTargetRef.current;
            if (!value) {
              return null;
            }
            const target = value as PlayAllJumpTarget;
            if (target.itemIndex !== itemIndex) {
              return null;
            }
            return target;
          })();

          const startUriIndex =
            pendingJumpTargetForCurrentItem
              ? Math.min(
                  pendingJumpTargetForCurrentItem.uriIndex,
                  item.uris.length - 1
                )
              : shouldUseInitialCheckpoint &&
                  savedCheckpoint &&
                  itemIndex === resolvedStartItemIndex &&
                  savedCheckpoint.uriIndex >= 0
                ? Math.min(savedCheckpoint.uriIndex, item.uris.length - 1)
                : 0;

          let jumpedToAnotherItem = false;
          for (let uriIndex = startUriIndex; uriIndex < item.uris.length; uriIndex++) {
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
              pendingJumpTargetForCurrentItem && uriIndex === startUriIndex
                ? Math.max(0, pendingJumpTargetForCurrentItem.positionMs)
                : shouldUseInitialCheckpoint &&
                    savedCheckpoint &&
                    itemIndex === resolvedStartItemIndex &&
                    uriIndex === startUriIndex
                  ? Math.max(0, savedCheckpoint.positionMs)
                  : 0;

            if (pendingJumpTargetForCurrentItem && uriIndex === startUriIndex) {
              pendingJumpTargetRef.current = null;
            }

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
                    lastStatusItemIndexRef.current = itemIndex;
                    lastStatusUriIndexRef.current = uriIndex;
                    const statusCurrentTimeMs = playbackStatus.currentTime * 1000;
                    if (Number.isFinite(statusCurrentTimeMs) && statusCurrentTimeMs >= 0) {
                      lastSegmentPositionMsRef.current = statusCurrentTimeMs;
                    }
                    const statusDurationMs = playbackStatus.duration * 1000;
                    if (Number.isFinite(statusDurationMs) && statusDurationMs > 0) {
                      lastSegmentDurationMsRef.current = statusDurationMs;
                      segmentDurationMsMapRef.current.set(
                        `${itemIndex}:${uriIndex}`,
                        statusDurationMs
                      );
                    }

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

            const jumpTarget = pendingJumpTargetRef.current as PlayAllJumpTarget | null;
            if (jumpTarget !== null) {
              shouldUseInitialCheckpoint = false;
              itemIndex = Math.max(
                0,
                Math.min(jumpTarget.itemIndex, playlist.length - 1)
              );
              jumpedToAnotherItem = true;
              break;
            }
          }

          shouldUseInitialCheckpoint = false;
          if (jumpedToAnotherItem) {
            continue;
          }
          itemIndex++;
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
    togglePlayPausePlayAll,
    nextPlayAllItem,
    previousPlayAllItem,
    rewindPlayAll,
    forwardPlayAll
  };
}
