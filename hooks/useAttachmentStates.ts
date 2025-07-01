// In a new hook file (useAttachmentStates.ts)
import { useEffect, useRef, useState } from 'react';
import { system } from '../db/powersync/system';
import { getLocalUriFromAssetId } from '../utils/attachmentUtils';

export function useAttachmentStates(attachmentIds: string[]) {
  const [attachmentUris, setAttachmentUris] = useState<Record<string, string>>(
    {}
  );
  const [loadingAttachments, setLoadingAttachments] = useState(
    attachmentIds.length > 0
  );
  const watchControllerRef = useRef<AbortController | null>(null);

  // Track attachment states instead of just IDs
  const processedAttachmentStates = useRef<Map<string, number>>(new Map());

  // Add a timestamp for when we started this hook
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    console.log(
      '[useAttachmentStates] Hook called with attachmentIds:',
      attachmentIds
    );

    // Reset the start time when attachmentIds change
    startTimeRef.current = Date.now();

    // Clear the processed states when attachmentIds change
    processedAttachmentStates.current.clear();

    if (!attachmentIds.length) {
      console.log(
        '[useAttachmentStates] No attachment IDs provided, setting loading to false'
      );
      setLoadingAttachments(false);
      return;
    }

    // Create a new abort controller for this watch
    const abortController = new AbortController();
    watchControllerRef.current = abortController;
    console.log('[useAttachmentStates] Created new abort controller');

    // Format the IDs for the SQL query
    const idsString = attachmentIds.map((id) => `'${id}'`).join(',');
    console.log('[useAttachmentStates] Formatted IDs for query:', idsString);

    console.log(
      '[useAttachmentStates] Starting PowerSync watch for attachments'
    );

    // Also make an immediate query to get any existing attachments
    system.powersync
      .getAll(`SELECT * FROM attachments WHERE id IN (${idsString})`)
      .then((attachments) => {
        void processAttachments(attachments);
      })
      .catch((error) => {
        console.error('[useAttachmentStates] Error in initial query:', error);
      });

    // Function to process attachments
    const processAttachments = (attachments: any[]) => {
      // Use functional state update to ensure we're building on the latest state
      let newUris: Record<string, string> = {};
      const hasChanges = false;

      // First get current values to work with
      setAttachmentUris((currentUris) => {
        newUris = { ...currentUris }; // Start with ALL current URIs

        for (const attachment of attachments) {
          const previousState = processedAttachmentStates.current.get(
            attachment.id
          );

          console.log(
            `[useAttachmentStates] Processing attachment: ${attachment.id}, State: ${attachment.state}, Previous state: ${previousState}`
          );

          if (previousState !== attachment.state) {
            processedAttachmentStates.current.set(
              attachment.id,
              attachment.state
            );

            if (attachment.state === 3) {
              // SYNCED state
              // Process synchronously for the initial update
              const existingUri = newUris[attachment.id];
              if (!existingUri) {
                getLocalUriFromAssetId(attachment.id)
                  .then((uri) => {
                    if (uri) {
                      // Use another functional update to add this URI safely
                      setAttachmentUris((latestUris) => ({
                        ...latestUris,
                        [attachment.id]: uri
                      }));
                      console.log(
                        `[useAttachmentStates] Added URI later: ${attachment.id}, ${uri}`
                      );
                    }
                  })
                  .catch((error) => {
                    console.error(
                      `[useAttachmentStates] Error getting URI: ${error}`
                    );
                  });
              }
            }
          } else {
            console.log(
              `[useAttachmentStates] Attachment state unchanged, skipping`
            );
          }
        }

        // Don't actually update state in this first pass - return unchanged
        return currentUris;
      });

      // After processing all attachments
      const foundCount = Object.keys(newUris).length;
      const timeoutReached = Date.now() - startTimeRef.current > 10000;
      const doneLoading = foundCount === attachmentIds.length || timeoutReached;

      setLoadingAttachments(!doneLoading);
    };

    // Set up the watch
    system.powersync.watch(
      `SELECT * FROM attachments WHERE id IN (${idsString})`,
      [],
      {
        onResult: (result) => {
          const attachments = result.rows?._array || [];
          processAttachments(attachments);
        }
      },
      { signal: abortController.signal }
    );

    // Add a timeout to stop waiting after 10 seconds
    const timeoutId = setTimeout(() => {
      if (loadingAttachments) {
        console.log(
          '[useAttachmentStates] Loading timeout reached, marking as done'
        );
        setLoadingAttachments(false);
      }
    }, 10000);

    // Clean up function
    return () => {
      console.log('[useAttachmentStates] Cleaning up watch');
      clearTimeout(timeoutId);
      if (watchControllerRef.current) {
        watchControllerRef.current.abort();
        watchControllerRef.current = null;
      }
    };
  }, [JSON.stringify(attachmentIds)]);

  return { attachmentUris, loadingAttachments };
}
