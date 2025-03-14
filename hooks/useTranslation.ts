import { useAuth } from '@/contexts/AuthContext';
import { languageService } from '@/database_services/languageService';
import {
  SupportedLanguage,
  TranslationKey,
  translations
} from '@/services/translations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export function useTranslation(languageOverride?: string | null) {
  const { currentUser } = useAuth();
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

  // Get language from user's uiLanguage relation
  const userLanguage =
    (languageOverride?.toLowerCase() as SupportedLanguage) ||
    (profileLanguage?.english_name?.toLowerCase() as SupportedLanguage) ||
    'english';

  const t = (key: TranslationKey): string => {
    if (!translations[key]) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    return translations[key][userLanguage] || translations[key]['english'];
  };

  return { t };
}
