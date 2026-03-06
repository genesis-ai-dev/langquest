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
import React, { createContext, useCallback, useContext, useMemo } from 'react';

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
    'bahasa indonesia': 'indonesian',
    // Nepali names and endonyms
    nepali: 'nepali',
    नेपाली: 'nepali',
    // Hindi names and endonyms
    hindi: 'hindi',
    हिन्दी: 'hindi',
    हिंदी: 'hindi',
    // Burmese names and endonyms
    burmese: 'burmese',
    မြန်မာ: 'burmese',
    myanmar: 'burmese',
    // Thai names and endonyms
    thai: 'thai',
    ไทย: 'thai',
    // Mandarin names and endonyms
    mandarin: 'mandarin',
    'mandarin chinese': 'mandarin',
    普通话: 'mandarin',
    中文: 'mandarin',
    chinese: 'mandarin'
  };

  return mapping[normalized] ?? 'english';
}

// Define a type for interpolation values
// Use a Record as preferred by linter
export type InterpolationValues = Record<string, string | number>;

// ---------------------------------------------------------------------------
// Context: single source of localization data for the entire app
// ---------------------------------------------------------------------------

interface LocalizationContextValue {
  userLanguage: SupportedLanguage;
  t: (key: LocalizationKey, options?: InterpolationValues | number) => string;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(
  null
);

/**
 * Provider that makes a single PowerSync query for the user's languoid.
 * Must be rendered inside PowerSyncContext, AuthProvider, and QueryProvider.
 */
export function LocalizationProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.currentUser ?? null;
  const currentLanguage = useLocalStore((state) => state.uiLanguage);

  const uiLanguoidId =
    currentUser?.user_metadata.ui_languoid_id ??
    currentUser?.user_metadata.ui_language_id;

  // Single useHybridData call for the entire app
  const { data } = useHybridData({
    dataType: 'languoid',
    queryKeyParams: [uiLanguoidId || ''],

    offlineQuery: toCompilableQuery(
      system.db.query.languoid.findMany({
        where: eq(languoidTable.id, uiLanguoidId || ''),
        limit: 1
      })
    ),

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

  // Resolve the active language
  let resolvedLanguageName: string | null | undefined = null;

  if (profileLanguoid?.name) {
    resolvedLanguageName = profileLanguoid.name;
  } else if (currentLanguage) {
    const langAny = currentLanguage as any;
    if (langAny.name && typeof langAny.name === 'string') {
      resolvedLanguageName = langAny.name;
    } else if (
      langAny.english_name &&
      typeof langAny.english_name === 'string'
    ) {
      resolvedLanguageName = langAny.english_name;
    }
  }

  const userLanguage = mapLanguoidNameToSupportedLanguage(
    resolvedLanguageName
  ) as SupportedLanguage;

  const t = useCallback(
    (key: LocalizationKey, options?: InterpolationValues | number): string => {
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
    },
    [userLanguage]
  );

  const value = useMemo(() => ({ userLanguage, t }), [userLanguage, t]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook – same API as before, zero PowerSync listeners
// ---------------------------------------------------------------------------

export function useLocalization(languageOverride?: string | null) {
  const ctx = useContext(LocalizationContext);

  // Fallback when rendered outside the provider (e.g. pre-auth screens)
  const fallbackLanguage = useLocalStore((state) => state.uiLanguage);

  if (!ctx) {
    // Outside provider – use static English fallback with no DB query
    let resolvedLang: SupportedLanguage = 'english';
    if (languageOverride) {
      resolvedLang = mapLanguoidNameToSupportedLanguage(languageOverride);
    } else if (fallbackLanguage) {
      const langAny = fallbackLanguage as any;
      if (langAny.name && typeof langAny.name === 'string') {
        resolvedLang = mapLanguoidNameToSupportedLanguage(langAny.name);
      } else if (
        langAny.english_name &&
        typeof langAny.english_name === 'string'
      ) {
        resolvedLang = mapLanguoidNameToSupportedLanguage(langAny.english_name);
      }
    }

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
      let translatedString = entry[resolvedLang] ?? entry.english;

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

    return { t, currentLanguage: resolvedLang };
  }

  // If a language override is provided, build a local t() that uses it
  if (languageOverride) {
    const overrideLang = mapLanguoidNameToSupportedLanguage(
      languageOverride
    ) as SupportedLanguage;

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
      let translatedString = entry[overrideLang] ?? entry.english;

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

    return { t, currentLanguage: overrideLang };
  }

  return { t: ctx.t, currentLanguage: ctx.userLanguage };
}
