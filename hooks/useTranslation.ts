import { useAuth } from '@/contexts/AuthContext';
import { languageService } from '@/database_services/languageService';
import {
  SupportedLanguage,
  TranslationKey,
  translations
} from '@/services/translations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Define a type for interpolation values
type InterpolationValues = { [key: string]: string | number };

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
