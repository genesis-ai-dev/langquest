import { useAuth } from '@/contexts/AuthContext';
import {
  lookupFiaLanguageCode,
  lookupSourceLanguoidId
} from '@/utils/languoidLookups';
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
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const { data, isLoading, error } = useQuery({
    queryKey: ['fia-pericope-steps', projectId, pericopeId],
    queryFn: async (): Promise<FiaPericopeStepsResponse | null> => {
      if (!projectId || !pericopeId) return null;

      const sourceLanguoidId = await lookupSourceLanguoidId(projectId);
      if (!sourceLanguoidId) {
        throw new Error('Could not find source languoid for project');
      }

      const fiaCode = await lookupFiaLanguageCode(sourceLanguoidId);
      if (!fiaCode) {
        throw new Error(
          `No FIA language code found for languoid ${sourceLanguoidId}`
        );
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/fia-pericope-steps`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ pericopeId, fiaLanguageCode: fiaCode })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `FIA pericope steps request failed (${response.status}): ${errorText}`
        );
      }

      return response.json();
    },
    enabled: !!projectId && !!pericopeId && !!supabaseUrl,
    staleTime: Infinity,
    retry: 2
  });

  return {
    data: data ?? null,
    isLoading,
    error
  };
}
