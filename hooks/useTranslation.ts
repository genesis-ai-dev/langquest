import { useAuth } from '@/contexts/AuthContext';
import { languageService } from '@/database_services/languageService';
import type {
  SupportedLanguage,
  TranslationKey
} from '@/services/localizations';
import { localizations } from '@/services/localizations';
import { useLocalStore } from '@/store/localStore';
import { useEffect, useState } from 'react';

// Define a type for interpolation values
// Use a Record as preferred by linter
export type InterpolationValues = Record<string, string | number>;

export function useTranslation(languageOverride?: string | null) {
  const { currentUser } = useAuth();
  const currentLanguage = useLocalStore((state) => state.language);
  const [profileLanguage, setProfileLanguage] = useState<Awaited<
    ReturnType<typeof languageService.getLanguageById>
  > | null>(null);

  useEffect(() => {
    const getLanguage = async () => {
      if (!currentUser?.ui_language_id) return;
      const language = await languageService.getLanguageById(
        currentUser.ui_language_id
      );
      setProfileLanguage(language);
    };
    void getLanguage();
  }, [currentUser]);

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
    key: TranslationKey,
    options?: InterpolationValues | number
  ): string => {
    if (!(key in localizations)) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    let translatedString =
      localizations[key]![userLanguage] || localizations[key]!.english;

    // If options is a number, treat as a single value for a placeholder like {{value}}
    if (typeof options === 'number') {
      translatedString = translatedString.replace(
        /{{ *value *}}/g,
        String(options)
      );
    } else if (options) {
      Object.keys(options).forEach((placeholder) => {
        const regex = new RegExp(`{{ *${placeholder} *}}`, 'g');
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
