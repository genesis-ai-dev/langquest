import { useSystem } from '@/contexts/SystemContext';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalStore } from '@/store/localStore';
import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/react-native';
import { eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
import { CustomDropdown } from './CustomDropdown';

type Language = typeof language.$inferSelect;

interface LanguageSelectProps {
  setLanguagesLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string;
  onChange?: (language: Language) => void;
  label?: boolean;
  containerStyle?: object;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
  value,
  onChange,
  setLanguagesLoaded
}) => {
  const { db } = useSystem();
  const [showLanguages, setShowLanguages] = useState(false);
  const setLanguage = useLocalStore((state) => state.setLanguage);
  const savedLanguage = useLocalStore((state) => state.language);
  const { t } = useTranslation();

  const { data: languages } = useQuery(
    toCompilableQuery(
      db.query.language.findMany({
        where: eq(language.ui_ready, true)
      })
    )
  );

  useEffect(() => {
    if (languages.length > 0) {
      setLanguagesLoaded(true);
    }
  }, [languages, setLanguagesLoaded]);

  const defaultLanguage = languages.find((l) => l.iso639_3 === 'eng');
  const selectedLanguage =
    languages.find((l) => l.id === value) ?? savedLanguage;
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
        if (lang) {
          setLanguage(lang);
          onChange?.(lang);
        }
      }}
      isOpen={showLanguages}
      onToggle={() => setShowLanguages(!showLanguages)}
      search={true}
      searchPlaceholder={t('search')}
      fullWidth={true}
    />
  );
};
