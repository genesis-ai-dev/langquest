import { useAuth } from '@/contexts/AuthContext';
import type { language } from '@/db/drizzleSchema';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type {
  LocalizationKey,
  SupportedLanguage
} from '@/services/localizations';
import { localizations } from '@/services/localizations';
import { useLocalStore } from '@/store/localStore';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';

type Language = typeof language.$inferSelect;

// Define a type for interpolation values
// Use a Record as preferred by linter
export type InterpolationValues = Record<string, string | number>;

export function useLocalization(languageOverride?: string | null) {
  const { currentUser } = useAuth();
  const currentLanguage = useLocalStore((state) => state.uiLanguage);

  const uiLanguageId = currentUser?.user_metadata.ui_language_id;

  // Use useHybridData directly to fetch the user's language preference
  const { data } = useHybridData({
    dataType: 'language',
    queryKeyParams: [uiLanguageId || ''],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: eq(languageTable.id, uiLanguageId || ''),
        limit: 1
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      if (!uiLanguageId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('*')
        .eq('id', uiLanguageId)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },

    enableCloudQuery: !!uiLanguageId
  });

  const profileLanguage = data[0];
  // Get language with priority:
  // 1. Manual override (provided as prop)
  // 2. Authenticated user's profile language
  // 3. Selected language from LanguageContext (for non-authenticated pages)
  // 4. Default to English
  const userLanguage = (
    languageOverride?.toLowerCase() ??
    profileLanguage?.english_name?.toLowerCase() ??
    currentLanguage?.english_name?.toLowerCase() ??
    'english'
  ).replace(/ /g, '_') as SupportedLanguage;

  // t function to accept optional interpolation values and use 'localizations'
  const t = (
    key: LocalizationKey,
    options?: InterpolationValues | number
  ): string => {
    if (!(key in localizations)) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    const entry = localizations[key] as Partial<
      Record<SupportedLanguage, string>
    > & {
      english: string;
    };
    let translatedString = entry[userLanguage] ?? entry.english;

    // If options is a number, treat as a single value for a placeholder like {{value}}
    if (typeof options === 'number') {
      translatedString = translatedString.replace(
        /{{ *value *}}/g,
        String(options)
      );
    } else if (options) {
      Object.keys(options).forEach((placeholder) => {
        const regex = new RegExp(`\\{ *${placeholder} *\\}`, 'g');
        translatedString = translatedString.replace(
          regex,
          String(options[placeholder])
        );
      });
    }

    return translatedString;
  };

  return { t };
}
