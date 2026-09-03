import { language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

export type Language = InferSelectModel<typeof language>;

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
  } = useHybridData({
    dataType: 'language-by-id',
    queryKeyParams: [language_id || ''],
    offlineQuery: toCompilableQuery(
      db.query.language.findMany({
        where: eq(language.id, language_id!)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('language')
        .select('*')
        .eq('id', language_id)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!language_id,
    enableOfflineQuery: !!language_id
  });

  const language_result = languageArray[0] || null;

  return { language: language_result, isLanguageLoading, ...rest };
}
