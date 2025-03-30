import { language } from '@/db/drizzleSchema';
import { useSystem } from '@/db/powersync/system';
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
  onChange,
  label = true,
  containerStyle
}) => {
  const { db } = useSystem();
  const [showLanguages, setShowLanguages] = useState(false);
  const { t } = useTranslation();

  const { data: languages } = useQuery(
    toCompilableQuery(
      db.query.language.findMany({
        where: eq(language.ui_ready, true)
      })
    )
  );

  const defaultLanguage = languages?.find((l) => l.iso639_3 === 'eng');
  const selectedLanguage = languages?.find((l) => l.id === value);

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
