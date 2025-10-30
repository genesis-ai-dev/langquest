// In a new hook file (useAttachmentStates.ts)
import type { AttachmentRecord } from '@powersync/attachments';
import { ATTACHMENT_TABLE } from '@powersync/attachments';
// Import from native SDK - will be empty on web
import type { QueryResult as QueryResultNative } from '@powersync/react-native';
// Import from web SDK - will be empty on native
import type { QueryResult as QueryResultWeb } from '@powersync/web';
import { useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { system } from '../db/powersync/system';
// Use the correct type based on platform
type QueryResult = QueryResultNative | QueryResultWeb;

export function useAttachmentStates(
  attachmentIds: string[] = [],
  enabled: boolean = true
) {
  const [attachmentStates, setAttachmentStates] = useState<
    Map<string, AttachmentRecord>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousStatesRef = useRef<Map<string, AttachmentRecord>>(new Map());
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // If disabled, abort any existing query and clear state
    if (!enabled) {
      abortControllerRef.current?.abort();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      return;
    }

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
          // Process attachment states off the main thread using InteractionManager
          // This prevents blocking UI interactions during sync operations
          InteractionManager.runAfterInteractions(() => {
            if (abortController.signal.aborted) return;

            const newStates = new Map<string, AttachmentRecord>();

            // Check if results and rows exist before accessing _array
            if (results.rows?._array) {
              // Process in a single pass - more efficient than forEach
              const rows = results.rows._array;
              for (let i = 0; i < rows.length; i++) {
                const record = rows[i] as unknown as AttachmentRecord;
                newStates.set(record.id, record);
              }
            }

            previousStatesRef.current = newStates;

            // Debounce the state updates to reduce render frequency
            if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current);
            }

            // Dynamic debounce based on activity
            const getDebounceTiming = () => {
              const { useLocalStore } = require('../store/localStore');
              const attachmentSyncProgress =
                useLocalStore.getState().attachmentSyncProgress;
              // Use shorter debounce during active sync for snappier feel
              return attachmentSyncProgress.downloading ||
                attachmentSyncProgress.uploading
                ? 200 // 200ms during sync
                : 500; // 500ms when idle
            };

            debounceTimeoutRef.current = setTimeout(() => {
              if (!abortController.signal.aborted) {
                setAttachmentStates(new Map(newStates));
                setIsLoading(false);
              }
            }, getDebounceTiming());
          });
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
  }, [JSON.stringify(attachmentIds.sort()), enabled]);

  return { attachmentStates, isLoading };
}
