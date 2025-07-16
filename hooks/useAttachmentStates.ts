// In a new hook file (useAttachmentStates.ts)
import type { AttachmentRecord } from '@powersync/attachments';
import { ATTACHMENT_TABLE, AttachmentState } from '@powersync/attachments';
import type { QueryResult } from '@powersync/react-native';
import { useEffect, useRef, useState } from 'react';
import { system } from '../db/powersync/system';

export function useAttachmentStates(attachmentIds: string[] = []) {
  const [attachmentStates, setAttachmentStates] = useState<
    Map<string, AttachmentRecord>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousStatesRef = useRef<Map<string, AttachmentRecord>>(new Map());
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Abort any previous query
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Build query based on whether we have specific IDs or want all records
    const query =
      attachmentIds.length > 0
        ? `SELECT * FROM ${ATTACHMENT_TABLE} WHERE id IN (${attachmentIds.map((id) => `'${id}'`).join(',')})`
        : `SELECT * FROM ${ATTACHMENT_TABLE}`;

    system.powersync.watch(
      query,
      [],
      {
        onResult: (results: QueryResult) => {
          const newStates = new Map<string, AttachmentRecord>();
          const currentPreviousStates = previousStatesRef.current;

          // Check if results and rows exist before accessing _array
          if (results.rows?._array) {
            results.rows._array.forEach((row) => {
              const record = row as unknown as AttachmentRecord;
              newStates.set(record.id, record);

              // Only log significant state changes
              const previousState = currentPreviousStates.get(record.id)?.state;
              if (
                previousState !== undefined &&
                previousState !== record.state
              ) {
                if (record.state === AttachmentState.SYNCED) {
                  console.log(
                    `💾 [ATTACHMENT] ✅ SYNCED: ${record.id} (was: ${previousState})`
                  );
                } else if (record.state === AttachmentState.QUEUED_SYNC) {
                  console.log(
                    `⏳ [ATTACHMENT] 🔄 QUEUED FOR DOWNLOAD: ${record.id} (was: ${previousState})`
                  );
                } else if (record.state === AttachmentState.QUEUED_DOWNLOAD) {
                  console.log(
                    `⬇️ [ATTACHMENT] 📥 DOWNLOADING: ${record.id} (was: ${previousState})`
                  );
                } else {
                  console.log(
                    `🔄 [ATTACHMENT] State changed: ${record.id} (${previousState} → ${record.state})`
                  );
                }
              }
            });
          }

          previousStatesRef.current = newStates;

          // Debounce the state updates to reduce render frequency
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }

          debounceTimeoutRef.current = setTimeout(() => {
            setAttachmentStates(new Map(newStates));
            setIsLoading(false);
          }, 100); // 100ms debounce
        },
        onError: (err) => console.error('useAttachmentStates watch error', err)
      },
      { signal: abortController.signal }
    );

    return () => {
      abortController.abort();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [JSON.stringify(attachmentIds.sort())]);

  return { attachmentStates, isLoading };
}
