import { system } from '@/db/powersync/system';
import {
  fetchAndCacheFiaPericope,
  getCachedFiaPericope
} from '@/utils/fia-cache';
import { AttachmentState } from '@powersync/attachments';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// --- Types matching the edge function response ---

export interface FiaBlock {
  type: string;
  content: string | FiaBlock | FiaBlock[];
  style?: string;
  title?: string | null;
  level?: number;
}

export interface FiaStepData {
  stepId: string;
  title: string;
  textJson: FiaBlock[] | null;
  textPlain: string;
  audioUrl: string | null;
}

export interface FiaMediaItem {
  id: string;
  title: string;
  description: string;
  assets: Array<{
    type: string;
    imageUrl: string | null;
    title: string;
    description: string;
  }>;
}

export interface FiaTerm {
  id: string;
  term: string;
  hint: string;
  definition: string | null;
}

export interface FiaMap {
  id: string;
  title: string;
  imageUrl: string;
}

export interface FiaPericopeStepsResponse {
  steps: FiaStepData[];
  mediaItems: FiaMediaItem[];
  terms: FiaTerm[];
  maps: FiaMap[];
}

export function useFiaPericopeSteps(
  projectId: string | undefined,
  pericopeId: string | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = ['fia-pericope-steps', projectId, pericopeId];

  // Watch the fia_attachments table for this pericope's record becoming SYNCED.
  // When the queue finishes downloading, this invalidates the query reactively
  // instead of polling.
  useEffect(() => {
    if (!projectId || !pericopeId) return;

    const attachmentId = `${projectId}__${pericopeId}`;
    const abortController = new AbortController();

    system.powersync.watch(
      `SELECT state FROM fia_attachments WHERE id = ?`,
      [attachmentId],
      {
        onResult: (result) => {
          const row = result.rows?._array?.[0] as { state: number } | undefined;
          if (row?.state === AttachmentState.SYNCED) {
            void queryClient.invalidateQueries({ queryKey });
          }
        }
      },
      { signal: abortController.signal }
    );

    return () => abortController.abort();
  }, [projectId, pericopeId, queryClient, queryKey]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId || !pericopeId) return null;

      const cached = await getCachedFiaPericope(pericopeId);
      if (cached) return cached;

      const session = await system.supabaseConnector.client.auth.getSession();
      const token = session.data.session?.access_token;
      await fetchAndCacheFiaPericope(projectId, pericopeId, token);
      return await getCachedFiaPericope(pericopeId);
    },
    enabled: !!projectId && !!pericopeId,
    staleTime: Infinity,
    retry: 1
  });

  return {
    data: data ?? null,
    isLoading,
    error
  };
}
