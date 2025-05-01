import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { languageService } from '@/database_services/languageService';
import type {
  SupportedLanguage,
  TranslationKey
} from '@/services/translations';
import { translations } from '@/services/translations';
import { useEffect, useState } from 'react';

// Define a type for interpolation values
type InterpolationValues = { [key: string]: string | number };

export function useTranslation(languageOverride?: string | null) {
  const { currentUser } = useAuth();
  const { currentLanguage } = useLanguage();
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
  const userLanguage = (languageOverride?.toLowerCase() ??
    profileLanguage?.english_name?.toLowerCase() ??
    currentLanguage?.english_name?.toLowerCase() ??
    'english') as SupportedLanguage;

  // Modify t function to accept optional interpolation values
  const t = (key: TranslationKey, values?: InterpolationValues): string => {
    if (!translations[key]) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    let translatedString = translations[key][userLanguage] || translations[key]['english'];

    // Replace placeholders like {{key}}
    if (values) {
      Object.keys(values).forEach((placeholder) => {
        const regex = new RegExp(`{{\s*${placeholder}\s*}}`, 'g');
        translatedString = translatedString.replace(regex, String(values[placeholder]));
      });
    }

    return translatedString;
  };

  return { t };
}
