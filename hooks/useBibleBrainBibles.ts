import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useQuery } from '@tanstack/react-query';

// --- Types matching the edge function response ---

export interface BibleBrainBible {
  id: string;
  name: string;
  vname: string | null;
  hasText: boolean;
  hasAudio: boolean;
  textFilesetId: string | null;
  audioFilesetId: string | null;
}

interface ListBiblesResponse {
  bibles: BibleBrainBible[];
}

// --- Lookup helpers ---

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
    const row = result.rows?._array?.[0] as { languoid_id: string } | undefined;
    if (row) return row.languoid_id;
  } catch {
    // No result
  }

  return null;
}

async function lookupIso639_3(languoidId: string): Promise<string | null> {
  try {
    const localResult = await system.db.execute(
      `SELECT unique_identifier FROM languoid_source
       WHERE languoid_id = '${languoidId}'
         AND name = 'iso639-3'
         AND active = 1
       LIMIT 1`
    );

    if (localResult.rows?._array && localResult.rows._array.length > 0) {
      return (localResult.rows._array[0] as { unique_identifier: string })
        .unique_identifier;
    }
  } catch {
    // Fall through to cloud
  }

  const { data, error } = await system.supabaseConnector.client
    .from('languoid_source')
    .select('unique_identifier')
    .eq('languoid_id', languoidId)
    .eq('name', 'iso639-3')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.unique_identifier;
}

// --- Hook ---

export function useBibleBrainBibles(projectId: string | undefined) {
  const { session } = useAuth();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  const { data, isLoading, error } = useQuery({
    queryKey: ['bible-brain-bibles', projectId],
    queryFn: async (): Promise<ListBiblesResponse | null> => {
      if (!projectId) return null;

      const sourceLanguoidId = await lookupSourceLanguoidId(projectId);
      if (!sourceLanguoidId) {
        throw new Error('Could not find source languoid for project');
      }

      const iso = await lookupIso639_3(sourceLanguoidId);
      if (!iso) {
        throw new Error(
          `No ISO 639-3 code found for languoid ${sourceLanguoidId}`
        );
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/bible-brain-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ action: 'list-bibles', iso639_3: iso })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bible Brain list-bibles request failed (${response.status}): ${errorText}`
        );
      }

      return response.json();
    },
    enabled: !!projectId && !!supabaseUrl,
    staleTime: Infinity,
    retry: 2
  });

  return {
    bibles: data?.bibles ?? [],
    isLoading,
    error
  };
}
