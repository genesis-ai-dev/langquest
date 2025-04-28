import { useSystem } from '@/contexts/SystemContext';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
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
  onChange
}) => {
  const { db } = useSystem();
  const [showLanguages, setShowLanguages] = useState(false);
  const [savedLanguage, setSavedLanguage] = useState<Language | null>(null);
  const { t } = useTranslation();

  const { data: languages } = useQuery(
    toCompilableQuery(
      db.query.language.findMany({
        where: eq(language.ui_ready, true)
      })
    )
  );

  const defaultLanguage = languages.find((l) => l.iso639_3 === 'eng');
  const selectedLanguage =
    languages.find((l) => l.id === value) ?? savedLanguage;

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
    void saveLanguage();
  }, [value]);

  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const savedId = await AsyncStorage.getItem('selectedLanguageId');
        const fetchedLanguage = languages.find((l) => l.id === savedId);
        if (fetchedLanguage) setSavedLanguage(fetchedLanguage);
      } catch (error) {
        console.error('Error loading saved language:', error);
      }
    };
    void loadSavedLanguage();
  }, [languages]);

  return (
    <CustomDropdown
      renderLeftIcon={() => (
        <Ionicons
          name="language"
          size={20}
          color={colors.text}
          style={{ marginRight: spacing.medium }}
        />
      )}
      value={
        selectedLanguage?.native_name ?? defaultLanguage?.native_name ?? ''
      }
      options={languages
        .filter((l) => l.native_name)
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
