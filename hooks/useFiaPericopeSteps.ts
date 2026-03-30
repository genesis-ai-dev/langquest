import {
  getCachedFiaPericope,
  useFiaAttachmentStatus
} from '@/services/FiaAttachmentQueue';
import { useQuery } from '@tanstack/react-query';

// --- Types matching the edge function response ---

export interface FiaBlock {
  type: string;
  content: string | FiaBlock | (string | FiaBlock)[];
  style?: string;
  title?: string | null;
  level?: number;
  url?: string;
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
  nodeId: string;
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
  nodeId: string;
  term: string;
  hint: string;
  definition: string | null;
}

export interface FiaMap {
  id: string;
  nodeId: string;
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
  const attachmentStatus = useFiaAttachmentStatus(pericopeId);

  // completedAt changes when the queue finishes, causing the query to re-run
  // and pick up the freshly-cached file
  const cacheVersion = attachmentStatus?.completedAt ?? 0;

  const { data, isLoading, error } = useQuery({
    queryKey: ['fia-pericope-steps', projectId, pericopeId, cacheVersion],
    queryFn: (): FiaPericopeStepsResponse | null => {
      if (!pericopeId) return null;
      return getCachedFiaPericope(pericopeId);
    },
    enabled: !!projectId && !!pericopeId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchInterval: false,
    refetchOnMount: true,
    retry: false
  });

  const isQueueProcessing =
    attachmentStatus?.status === 'pending' ||
    attachmentStatus?.status === 'downloading';

  return {
    data: data ?? null,
    isLoading: isLoading || isQueueProcessing,
    error
  };
}
