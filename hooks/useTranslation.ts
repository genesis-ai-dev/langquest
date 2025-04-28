import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { languageService } from '@/database_services/languageService';
import {
  SupportedLanguage,
  TranslationKey,
  translations
} from '@/services/translations';
import { useEffect, useState } from 'react';

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
    getLanguage();
  }, [currentUser]);

  // Get language with priority:
  // 1. Manual override (provided as prop)
  // 2. Authenticated user's profile language
  // 3. Selected language from LanguageContext (for non-authenticated pages)
  // 4. Default to English
  const userLanguage =
    (languageOverride?.toLowerCase() as SupportedLanguage) ||
    (profileLanguage?.english_name?.toLowerCase() as SupportedLanguage) ||
    (currentLanguage?.english_name?.toLowerCase() as SupportedLanguage) ||
    'english';

  const t = (key: TranslationKey): string => {
    if (!(key in translations)) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    const translation = translations[key as keyof typeof translations];
    return translation[userLanguage] || translation['english'];
  };

  return { t };
}
