// In a new hook file (useAttachmentStates.ts)
import type { AttachmentRecord } from '@powersync/attachments';
import { ATTACHMENT_TABLE, AttachmentState } from '@powersync/attachments';
// Import from native SDK - will be empty on web
import type { QueryResult as QueryResultNative } from '@powersync/react-native';
import { useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { system } from '../db/powersync/system';
// Use the correct type based on platform
type QueryResult = QueryResultNative;

export function useAttachmentStates(
  attachmentIds: string[] = [],
  enabled = true
) {
  const { isAuthenticated } = useAuth();
  const isPowerSyncReady = system.isPowerSyncInitialized();
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
      // Use setTimeout to avoid calling setState synchronously in effect
      setTimeout(() => setIsLoading(false), 0);
      return;
    }

    // For anonymous users or when PowerSync isn't initialized, skip local queries
    // Audio will be loaded directly from Supabase storage URLs
    if (!isAuthenticated || !isPowerSyncReady) {
      // Use setTimeout to avoid calling setState synchronously in effect
      setTimeout(() => {
        setIsLoading(false);
        // Return empty map for anonymous users - audio will be handled via cloud URLs
        setAttachmentStates(new Map());
      }, 0);
      return;
    }

    // Abort any previous query
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Build query based on whether we have specific IDs or want all records
    // Filter out ARCHIVED attachments - they're not part of active sync progress
    const query =
      attachmentIds.length > 0
        ? `SELECT * FROM ${ATTACHMENT_TABLE} WHERE id IN (${attachmentIds.map((id) => `'${id}'`).join(',')}) AND state < ${AttachmentState.ARCHIVED}`
        : `SELECT * FROM ${ATTACHMENT_TABLE} WHERE state < ${AttachmentState.ARCHIVED}`;

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
              for (const row of rows) {
                const record = row as unknown as AttachmentRecord;
                newStates.set(record.id, record);
              }
            }

            previousStatesRef.current = newStates;

            // Debounce the state updates to reduce render frequency
            if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current);
            }

            // Fixed debounce timing to avoid circular dependency with store
            // Using 300ms as a balanced value for responsive UI without excessive updates
            const DEBOUNCE_MS = 300;

            debounceTimeoutRef.current = setTimeout(() => {
              if (!abortController.signal.aborted) {
                setAttachmentStates(new Map(newStates));
                setIsLoading(false);
              }
            }, DEBOUNCE_MS);
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
  }, [enabled, attachmentIds, isAuthenticated, isPowerSyncReady]);

  return { attachmentStates, isLoading };
}
