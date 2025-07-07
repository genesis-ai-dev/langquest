// In a new hook file (useAttachmentStates.ts)
import type { AttachmentRecord } from '@powersync/attachments';
import { ATTACHMENT_TABLE, AttachmentState } from '@powersync/attachments';
import type { QueryResult } from '@powersync/react-native';
import { useEffect, useRef, useState } from 'react';
import { system } from '../db/powersync/system';

export function useAttachmentStates(attachmentIds: string[]) {
  const [attachmentStates, setAttachmentStates] = useState<
    Map<string, AttachmentRecord>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousStatesRef = useRef<Map<string, AttachmentRecord>>(new Map());

  useEffect(() => {
    if (!attachmentIds.length) {
      setIsLoading(false);
      return;
    }

    // Abort any previous query
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const formattedIds = attachmentIds.map((id) => `'${id}'`).join(',');

    system.powersync.watch(
      `SELECT * FROM ${ATTACHMENT_TABLE} WHERE id IN (${formattedIds})`,
      [],
      {
        onResult: (results: QueryResult) => {
          const newStates = new Map<string, AttachmentRecord>();
          const currentPreviousStates = previousStatesRef.current;

          results.rows?._array.forEach((row) => {
            const record = row as unknown as AttachmentRecord;
            newStates.set(record.id, record);

            // Only log significant state changes
            const previousState = currentPreviousStates.get(record.id)?.state;
            if (previousState !== undefined && previousState !== record.state) {
              if (record.state === AttachmentState.SYNCED) {
                // SYNCED state
                console.log(`[Attachment] Synced: ${record.id}`);
              } else if (record.state === AttachmentState.QUEUED_SYNC) {
                // QUEUED state
                console.log(`[Attachment] Queued: ${record.id}`);
              }
            }
          });

          previousStatesRef.current = newStates;
          setAttachmentStates(newStates);
          setIsLoading(false);
        },
        onError: (err) => console.error('useAttachmentStates watch error', err)
      },
      { signal: abortController.signal }
    );

    return () => {
      abortController.abort();
      // if (subscription && typeof subscription === 'function') {
      //   subscription();
      // }
    };
  }, [JSON.stringify(attachmentIds.sort())]);

  return { attachmentStates, isLoading };
}
