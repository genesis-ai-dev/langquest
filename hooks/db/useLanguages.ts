import { language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { useHybridSupabaseQuery } from '../useHybridSupabaseQuery';

export type Language = InferSelectModel<typeof language>;

export function useUIReadyLanguages() {
  const { db, supabaseConnector } = system;

  // Main query using hybrid realtime query
  const {
    data: languages,
    isLoading: isLanguagesLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['languages'],
    onlineFn: async ({ signal }) => {
      const { data, error } = await supabaseConnector.client
        .from('language')
        .select('*')
        .eq('active', true)
        .eq('ui_ready', true)
        .abortSignal(signal)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: db.query.language.findMany({
      where: and(eq(language.active, true), eq(language.ui_ready, true))
    })
  });

  return { languages, isLanguagesLoading, ...rest };
}

/**
 * Returns { projects, isLoading, error }
 * Fetches projects from Supabase (online) or local Drizzle DB (offline/downloaded)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useLanguages() {
  const { db, supabaseConnector } = system;

  // Main query using hybrid realtime query
  const {
    data: languages,
    isLoading: isLanguagesLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['languages'],
    onlineFn: async ({ signal }) => {
      const { data, error } = await supabaseConnector.client
        .from('language')
        .select('*')
        .eq('active', true)
        .abortSignal(signal)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: db.query.language.findMany({
      where: eq(language.active, true)
    })
  });

  return { languages, isLanguagesLoading, ...rest };
}

export function useLanguageNames(languageIds: string[] | string) {
  const { db, supabaseConnector } = system;

  const languageIdsArray = Array.isArray(languageIds)
    ? languageIds
    : [languageIds];
  // Main query using hybrid realtime query
  const {
    data: languages,
    isLoading: isLanguagesLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['languages'],
    onlineFn: async ({ signal }) => {
      const { data, error } = await supabaseConnector.client
        .from('language')
        .select('id, native_name, english_name')
        .eq('active', true)
        .in('id', languageIdsArray)
        .abortSignal(signal)
        .overrideTypes<
          { id: string; native_name: string; english_name: string }[]
        >();
      if (error) throw error;
      return data;
    },
    offlineQuery: db.query.language.findMany({
      columns: { id: true, native_name: true, english_name: true },
      where: (fields, { eq, inArray }) =>
        and(eq(fields.active, true), inArray(fields.id, languageIdsArray))
    })
  });

  return { languages, isLanguagesLoading, ...rest };
}

/**
 * Returns { language, isLoading, error }
 * Fetches a single language by ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useLanguageById(language_id?: string) {
  const { db, supabaseConnector } = system;

  const {
    data: languageArray,
    isLoading: isLanguageLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['language', language_id],
    enabled: !!language_id,
    onlineFn: async ({ signal }) => {
      const { data, error } = await supabaseConnector.client
        .from('language')
        .select('*')
        .eq('id', language_id)
        .abortSignal(signal)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: db.query.language.findMany({
      where: eq(language.id, language_id!)
    })
  });

  const language_result = languageArray?.[0] || null;

  return { language: language_result, isLanguageLoading, ...rest };
}

// Standalone function for use outside React components (like Zustand stores)
export async function getLanguageById(
  language_id: string
): Promise<Language | null> {
  try {
    // Try online first
    const { data, error } = await system.supabaseConnector.client
      .from('language')
      .select('*')
      .eq('id', language_id)
      .single<Language>();

    if (!error) {
      return data;
    }

    // Fallback to offline
    const offlineResult = await system.db.query.language.findFirst({
      where: eq(language.id, language_id)
    });

    return offlineResult || null;
  } catch (error) {
    console.error('Error fetching language by ID:', error);
    return null;
  }
}
