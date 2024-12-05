import { useAuth } from '@/contexts/AuthContext';
import { translations, TranslationKey, SupportedLanguage } from '@/services/translations';

export function useTranslation() {
  const { currentUser } = useAuth();
  
  // Get language from user's uiLanguage relation
  const userLanguage = (
    currentUser?.uiLanguage?.englishName?.toLowerCase() as SupportedLanguage
  ) || 'english';
  
  const t = (key: TranslationKey): string => {
    if (!translations[key]) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    return translations[key][userLanguage] || translations[key]['english'];
  };

  return { t };
}