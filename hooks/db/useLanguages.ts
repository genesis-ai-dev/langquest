import { useSystem } from '@/contexts/SystemContext';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridQuery
} from '../useHybridQuery';

export type Language = InferSelectModel<typeof languageTable>;

export function useUIReadyLanguages() {
  const { db, supabaseConnector } = useSystem();

  // Main query using hybrid realtime query
  const {
    data: languages,
    isLoading: isLanguagesLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['languages'],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('language')
        .select('*')
        .eq('active', true)
        .eq('ui_ready', true)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.language.findMany({
        where: and(
          eq(languageTable.active, true),
          eq(languageTable.ui_ready, true)
        )
      })
    )
  });

  return { languages, isLanguagesLoading, ...rest };
}

/**
 * Returns { projects, isLoading, error }
 * Fetches projects from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useLanguages() {
  const { db, supabaseConnector } = useSystem();

  // Main query using hybrid realtime query
  const {
    data: languages,
    isLoading: isLanguagesLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['languages'],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('language')
        .select('*')
        .eq('active', true)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.language.findMany({
        where: eq(languageTable.active, true)
      })
    )
  });

  return { languages, isLanguagesLoading, ...rest };
}

function getLanguageByIdConfig(language_id?: string) {
  return createHybridQueryConfig({
    queryKey: ['language', language_id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('*')
        .eq('id', language_id)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: eq(languageTable.id, language_id!)
      })
    ),
    enabled: !!language_id
  });
}

export async function getLanguageById(language_id: string) {
  return (
    await hybridFetch(convertToFetchConfig(getLanguageByIdConfig(language_id)))
  )?.[0];
}

/**
 * Returns { language, isLoading, error }
 * Fetches a single language by ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useLanguageById(language_id?: string) {
  const {
    data: languageArray,
    isLoading: isLanguageLoading,
    ...rest
  } = useHybridQuery(getLanguageByIdConfig(language_id));

  const language = languageArray?.[0] || null;

  return { language, isLanguageLoading, ...rest };
}
