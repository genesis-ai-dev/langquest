// In a new hook file (useAttachmentStates.ts)
import { useState, useEffect, useRef } from 'react';
import { system } from '../db/powersync/system';
import { AttachmentState } from '@powersync/attachments';
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
        processAttachments(attachments);
      })
      .catch((error) => {
        console.error('[useAttachmentStates] Error in initial query:', error);
      });

    // Function to process attachments
    const processAttachments = async (attachments: any[]) => {
      console.log(
        '[useAttachmentStates] Processing attachments count:',
        attachments.length
      );

      const newUris = { ...attachmentUris };
      let hasChanges = false;

      for (const attachment of attachments) {
        const previousState = processedAttachmentStates.current.get(
          attachment.id
        );

        console.log(
          `[useAttachmentStates] Processing attachment: ${attachment.id}, State: ${attachment.state}, Previous state: ${previousState}`
        );

        // Process if state is different or we haven't processed it before
        if (previousState !== attachment.state) {
          // Update the state we've seen
          processedAttachmentStates.current.set(
            attachment.id,
            attachment.state
          );

          // Only try to get URI if the attachment is synced (state 3)
          if (attachment.state === 3) {
            console.log(
              `[useAttachmentStates] Attachment is SYNCED, getting local URI`
            );

            try {
              const uri = await getLocalUriFromAssetId(attachment.id);
              if (uri) {
                console.log(
                  `[useAttachmentStates] Got URI for attachment: ${attachment.id}, ${uri}`
                );
                newUris[attachment.id] = uri;
                hasChanges = true;
              } else {
                console.log(
                  `[useAttachmentStates] No URI found for attachment: ${attachment.id}`
                );
              }
            } catch (error) {
              console.error(
                `[useAttachmentStates] Error getting URI: ${error}`
              );
            }
          } else {
            console.log(
              `[useAttachmentStates] Attachment not SYNCED, skipping URI lookup`
            );
          }
        } else {
          console.log(
            `[useAttachmentStates] Attachment state unchanged, skipping`
          );
        }
      }

      if (hasChanges) {
        console.log(
          '[useAttachmentStates] Setting new attachment URIs:',
          newUris
        );
        setAttachmentUris(newUris);
      }

      // Count how many attachments we have URIs for
      const foundCount = Object.keys(newUris).length;

      // Check if we're done loading:
      // 1. We have URIs for all attachments, or
      // 2. We've been running for more than 10 seconds (timeout)
      const timeoutReached = Date.now() - startTimeRef.current > 10000;

      // Done if we found all or timeout reached
      const doneLoading = foundCount === attachmentIds.length || timeoutReached;

      console.log(
        `[useAttachmentStates] Found ${foundCount}/${attachmentIds.length} attachments, ` +
          `timeout reached: ${timeoutReached}, done loading: ${doneLoading}`
      );

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
