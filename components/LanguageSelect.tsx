import { languageService } from '@/database_services/languageService';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { CustomDropdown } from './CustomDropdown';

type Language = typeof language.$inferSelect;

interface LanguageSelectProps {
  value?: string;
  onChange: (language: Language) => void;
  label?: boolean;
  containerStyle?: object;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
  value,
  onChange,
  label = true,
  containerStyle
}) => {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [showLanguages, setShowLanguages] = useState(false);
  const { t } = useTranslation();

  // Load languages
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const loadedLanguages = await languageService.getUiReadyLanguages();
        setLanguages(loadedLanguages);

        // If no value is set, try to get saved language ID
        if (!value) {
          const savedLanguageId =
            await AsyncStorage.getItem('selectedLanguageId');
          const savedLanguage = loadedLanguages.find(
            (l) => l.id === savedLanguageId
          );
          if (savedLanguage) {
            onChange(savedLanguage);
          } else if (loadedLanguages.length > 0) {
            // Fallback to English or first language
            const englishLang = loadedLanguages.find(
              (l) =>
                l.english_name?.toLowerCase() === 'english' ||
                l.native_name?.toLowerCase() === 'english'
            );
            onChange(englishLang || loadedLanguages[0]);
          }
        }
      } catch (error) {
        console.error('Error loading languages:', error);
        Alert.alert('Error', t('failedLoadLanguages'));
      }
    };
    loadLanguages();
  }, []);

  // Save language when it changes
  useEffect(() => {
    const saveLanguage = async () => {
      try {
        if (value) {
          await AsyncStorage.setItem('selectedLanguageId', value);
        }
      } catch (error) {
        console.error('Error saving language:', error);
      }
    };
    saveLanguage();
  }, [value]);

  return (
    <CustomDropdown
      value={languages.find((l) => l.id === value)?.native_name || ''}
      options={languages
        .filter((l) => l.native_name !== null)
        .map((l) => l.native_name!)}
      onSelect={(langName) => {
        const lang = languages.find((l) => l.native_name === langName);
        if (lang) onChange(lang);
      }}
      isOpen={showLanguages}
      onToggle={() => setShowLanguages(!showLanguages)}
      search={true}
      searchPlaceholder={t('search')}
      fullWidth={true}
    />
  );
};
