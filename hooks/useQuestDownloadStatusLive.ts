import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import React from 'react';

/**
 * Watch SQLite directly for quest download_profiles changes.
 *
 * Memory safety: Uses AbortController for cleanup, only watches when questId exists,
 * and all async operations check abort signal to prevent state updates after unmount.
 */
export function useQuestDownloadStatusLive(questId: string | null): boolean {
  const { currentUser } = useAuth();
  const [isDownloaded, setIsDownloaded] = React.useState(false);

  React.useEffect(() => {
    if (!questId || !currentUser?.id) {
      setIsDownloaded(false);
      return;
    }

    const abortController = new AbortController();
    let isMounted = true;
    const shouldProceed = () => !abortController.signal.aborted && isMounted;

    const applyDownloaded = (profiles: unknown) => {
      if (!shouldProceed()) return;
      const parsed =
        typeof profiles === 'string' ? JSON.parse(profiles) : profiles;
      setIsDownloaded(
        Array.isArray(parsed) && parsed.includes(currentUser.id)
      );
    };

    const checkDownloadStatus = async () => {
      try {
        const quest = await system.db.query.quest.findFirst({
          where: (fields, { eq }) => eq(fields.id, questId),
          columns: { download_profiles: true }
        });

        if (!shouldProceed()) return;

        if (quest?.download_profiles) {
          applyDownloaded(quest.download_profiles);
        } else {
          setIsDownloaded(false);
        }
      } catch (error) {
        if (!shouldProceed()) return;
        console.error('Error checking download status:', error);
        setIsDownloaded(false);
      }
    };

    void checkDownloadStatus();

    system.powersync.watch(
      `SELECT download_profiles FROM quest WHERE id = ?`,
      [questId],
      {
        onResult: (result) => {
          if (!shouldProceed()) return;

          try {
            const firstRow = result.rows?._array?.[0] as
              | { download_profiles?: string | string[] }
              | undefined;
            if (firstRow?.download_profiles) {
              applyDownloaded(firstRow.download_profiles);
            } else {
              setIsDownloaded(false);
            }
          } catch (error) {
            if (!shouldProceed()) return;
            console.error(
              'Error parsing download status from watch:',
              error
            );
            setIsDownloaded(false);
          }
        },
        onError: (err) => {
          if (!shouldProceed()) return;
          console.error('Watch error:', err);
        }
      },
      { signal: abortController.signal }
    );

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [questId, currentUser?.id]);

  return isDownloaded;
}
