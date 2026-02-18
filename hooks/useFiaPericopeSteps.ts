import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
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

async function lookupFiaLanguageCode(
  languoidId: string
): Promise<string | null> {
  try {
    const localResult = await system.db.execute(
      `SELECT value FROM languoid_property
       WHERE languoid_id = '${languoidId}'
         AND key = 'fia_language_code'
         AND active = 1
       LIMIT 1`
    );

    if (localResult.rows?._array && localResult.rows._array.length > 0) {
      return (localResult.rows._array[0] as { value: string }).value;
    }
  } catch {
    // Fall through to cloud
  }

  const { data, error } = await system.supabaseConnector.client
    .from('languoid_property')
    .select('value')
    .eq('languoid_id', languoidId)
    .eq('key', 'fia_language_code')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
}

async function lookupSourceLanguoidId(
  projectId: string
): Promise<string | null> {
  try {
    const { data, error } = await system.supabaseConnector.client
      .from('project_language_link')
      .select('languoid_id')
      .eq('project_id', projectId)
      .eq('language_type', 'source')
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data.languoid_id;
  } catch {
    // Fall through to local
  }

  try {
    const result = await system.db.execute(
      `SELECT languoid_id FROM project_language_link
       WHERE project_id = '${projectId}'
         AND language_type = 'source'
         AND active = 1
       LIMIT 1`
    );
    const row = result.rows?._array?.[0] as
      | { languoid_id: string }
      | undefined;
    if (row) return row.languoid_id;
  } catch {
    // No result
  }

  return null;
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
