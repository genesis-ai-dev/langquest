import { getCachedFiaPericope } from '@/utils/fia-cache';
import { useQuery } from '@tanstack/react-query';

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
  const { data, isLoading, error } = useQuery({
    queryKey: ['fia-pericope-steps', projectId, pericopeId],
    queryFn: async (): Promise<FiaPericopeStepsResponse | null> => {
      if (!projectId || !pericopeId) return null;

      const cached = await getCachedFiaPericope(pericopeId);
      if (cached) return cached;

      // Cache not ready yet — the attachment queue is downloading in the background.
      // Returning null lets react-query retry on the next refetchInterval tick.
      return null;
    },
    enabled: !!projectId && !!pericopeId,
    staleTime: Infinity,
    refetchInterval: (query) => (query.state.data ? false : 3_000),
    retry: false
  });

  return {
    data: data ?? null,
    isLoading,
    error
  };
}
