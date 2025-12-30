import { AuthContext } from '@/contexts/AuthContext';
import { languoid as languoidTable } from '@/db/drizzleSchema';
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
import { useContext } from 'react';

type Languoid = typeof languoidTable.$inferSelect;

/**
 * Maps languoid.name or endonym to SupportedLanguage type
 * Handles the mapping from languoid names and endonyms to localization keys
 */
function mapLanguoidNameToSupportedLanguage(
  languoidName: string | null | undefined
): SupportedLanguage {
  if (!languoidName) return 'english';

  const normalized = languoidName.toLowerCase().trim();

  // Map languoid names and endonyms to SupportedLanguage values
  const mapping: Record<string, SupportedLanguage> = {
    // English names
    english: 'english',
    // Spanish names and endonyms
    spanish: 'spanish',
    español: 'spanish',
    espanol: 'spanish', // Without accent
    // Brazilian Portuguese names and endonyms
    'brazilian portuguese': 'brazilian_portuguese',
    'português brasileiro': 'brazilian_portuguese',
    'portugues brasileiro': 'brazilian_portuguese', // Without accent
    // Tok Pisin names
    'tok pisin': 'tok_pisin',
    // Indonesian names and endonyms
    'standard indonesian': 'indonesian',
    indonesian: 'indonesian',
    'bahasa indonesia': 'indonesian'
  };

  return mapping[normalized] ?? 'english';
}

// Define a type for interpolation values
// Use a Record as preferred by linter
export type InterpolationValues = Record<string, string | number>;

export function useLocalization(languageOverride?: string | null) {
  // Use useContext directly to avoid throwing if AuthProvider isn't ready yet
  // This allows useLocalization to work even before login as documented
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.currentUser ?? null;
  const currentLanguage = useLocalStore((state) => state.uiLanguage);

  // Get ui_languoid_id from user metadata
  const uiLanguoidId = currentUser?.user_metadata.ui_languoid_id;

  // Use useHybridData directly to fetch the user's languoid preference
  const { data } = useHybridData({
    dataType: 'languoid',
    queryKeyParams: [uiLanguoidId || ''],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.languoid.findMany({
        where: eq(languoidTable.id, uiLanguoidId || ''),
        limit: 1
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      if (!uiLanguoidId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('languoid')
        .select('*')
        .eq('id', uiLanguoidId)
        .overrideTypes<Languoid[]>();
      if (error) throw error;
      return data;
    },

    enableCloudQuery: !!uiLanguoidId
  });

  const profileLanguoid = data[0];

  // Get language with priority:
  // 1. Manual override (provided as prop)
  // 2. Authenticated user's profile languoid name
  // 3. Selected language from LanguageContext (for non-authenticated pages)
  // 4. Default to English
  let resolvedLanguageName: string | null | undefined = null;

  if (languageOverride) {
    resolvedLanguageName = languageOverride;
  } else if (profileLanguoid?.name) {
    resolvedLanguageName = profileLanguoid.name;
  } else if (
    currentLanguage &&
    'name' in currentLanguage &&
    typeof currentLanguage.name === 'string'
  ) {
    resolvedLanguageName = currentLanguage.name;
  }

  const userLanguage = mapLanguoidNameToSupportedLanguage(resolvedLanguageName);

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
