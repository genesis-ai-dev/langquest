import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';

/**
 * Dead simple: Watch SQLite directly for quest download_profiles changes.
 * No cache, no optimistic updates, just query the source of truth.
 *
 * Memory safety: Uses AbortController for cleanup, only watches when questId exists,
 * and all async operations check abort signal to prevent state updates after unmount.
 *
 * Automatically invalidates assets queries when quest becomes downloaded.
 */
export function useQuestDownloadStatusLive(questId: string | null): boolean {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [isDownloaded, setIsDownloaded] = React.useState(false);
  const prevDownloadedRef = React.useRef(false);

  React.useEffect(() => {
    // Early return - no watch created if no questId or user
    if (!questId || !currentUser?.id) {
      setIsDownloaded(false);
      prevDownloadedRef.current = false;
      return;
    }

    // Abort controller to cancel watch on cleanup - critical for memory safety
    const abortController = new AbortController();
    let isMounted = true;

    // Reset ref when questId changes
    prevDownloadedRef.current = false;

    // Helper to check if we should proceed (defensive check for async operations)
    const shouldProceed = () => !abortController.signal.aborted && isMounted;

    // Query SQLite directly - the single source of truth
    const checkDownloadStatus = async () => {
      try {
        const quest = await system.db.query.quest.findFirst({
          where: (fields, { eq }) => eq(fields.id, questId),
          columns: { download_profiles: true }
        });

        // Memory safety: don't update state if component unmounted
        if (!shouldProceed()) return;

        if (quest?.download_profiles) {
          const profiles =
            typeof quest.download_profiles === 'string'
              ? JSON.parse(quest.download_profiles)
              : quest.download_profiles;
          const downloaded =
            Array.isArray(profiles) && profiles.includes(currentUser.id);

          // Double-check before state update (defensive - state can change during async)
          if (!shouldProceed()) return;

          // Invalidate assets queries when quest becomes downloaded (initial check)
          const wasDownloaded = prevDownloadedRef.current;
          if (!wasDownloaded && downloaded) {
            console.log(
              `🔄 [Quest Download] Quest ${questId.slice(0, 8)}... became downloaded - invalidating assets queries`
            );
            // Invalidate all asset queries for this quest (handles all search variations)
            void queryClient.invalidateQueries({
              queryKey: ['assets', 'by-quest', questId],
              exact: false
            });
            // Also invalidate general assets queries
            void queryClient.invalidateQueries({
              queryKey: ['assets']
            });
          }

          prevDownloadedRef.current = downloaded;
          setIsDownloaded(downloaded);
        } else {
          if (!shouldProceed()) return;
          setIsDownloaded(false);
        }
      } catch (error) {
        // Only log/update if component still mounted
        if (!shouldProceed()) return;
        console.error('Error checking download status:', error);
        setIsDownloaded(false);
      }
    };

    // Initial check
    void checkDownloadStatus();

    // Watch for changes using PowerSync watch
    // Note: watch doesn't return an unwatch function, use abort controller instead
    // Memory safety: abort signal will stop watch callbacks from firing after cleanup

    system.powersync.watch(
      `SELECT download_profiles FROM quest WHERE id = ?`,
      [questId],
      {
        onResult: (result) => {
          // Memory safety: check abort and mount status before any work
          if (!shouldProceed()) return;

          try {
            // result.rows._array contains the rows
            // Check if results and rows exist before accessing _array
            let firstRow: unknown;
            if (result.rows?._array) {
              firstRow = result.rows._array[0];
            }
            if (firstRow) {
              const row = firstRow as {
                download_profiles?: string | string[];
              };
              const profiles = row.download_profiles;
              if (profiles) {
                const parsed =
                  typeof profiles === 'string'
                    ? JSON.parse(profiles)
                    : profiles;
                const downloaded =
                  Array.isArray(parsed) && parsed.includes(currentUser.id);

                // Double-check before state update (defensive programming)
                if (!shouldProceed()) return;

                // Invalidate assets queries when quest becomes downloaded
                // This ensures assets list refreshes when navigating into newly downloaded quest
                const wasDownloaded = prevDownloadedRef.current;
                if (!wasDownloaded && downloaded) {
                  console.log(
                    `🔄 [Quest Download] Quest ${questId.slice(0, 8)}... became downloaded - invalidating assets queries`
                  );
                  // Invalidate all asset queries for this quest (handles all search variations)
                  void queryClient.invalidateQueries({
                    queryKey: ['assets', 'by-quest', questId],
                    exact: false
                  });
                  // Also invalidate general assets queries
                  void queryClient.invalidateQueries({
                    queryKey: ['assets']
                  });
                }

                prevDownloadedRef.current = downloaded;
                setIsDownloaded(downloaded);
              } else {
                if (!shouldProceed()) return;
                setIsDownloaded(false);
              }
            } else {
              if (!shouldProceed()) return;
              setIsDownloaded(false);
            }
          } catch (error) {
            // Only log/update if component still mounted
            if (!shouldProceed()) return;
            console.error('Error parsing download status from watch:', error);
            setIsDownloaded(false);
          }
        },
        onError: (err) => {
          // Only log if component still mounted
          if (!shouldProceed()) return;
          console.error('Watch error:', err);
        }
      },
      { signal: abortController.signal }
    );

    // Cleanup: abort watch and mark as unmounted
    return () => {
      isMounted = false;
      abortController.abort();
      // Watch will stop calling callbacks due to abort signal
    };
  }, [questId, currentUser?.id, queryClient]);

  return isDownloaded;
}
