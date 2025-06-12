import type { language } from '@/db/drizzleSchema';
import { useUIReadyLanguages } from '@/hooks/db/useLanguages';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalStore } from '@/store/localStore';
import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { CustomDropdown } from './CustomDropdown';

type Language = typeof language.$inferSelect;

interface LanguageSelectProps {
  value?: string;
  onChange?: (language: Language) => void;
  label?: boolean;
  containerStyle?: object;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
  value,
  onChange
}) => {
  const [showLanguages, setShowLanguages] = useState(false);
  const setLanguage = useLocalStore((state) => state.setLanguage);
  const savedLanguage = useLocalStore((state) => state.language);
  const { t } = useTranslation();

  const { languages } = useUIReadyLanguages();

  const defaultLanguage = languages?.find((l) => l.iso639_3 === 'eng');
  const selectedLanguage =
    languages?.find((l) => l.id === value) ?? savedLanguage;

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
      options={
        languages?.filter((l) => l.native_name).map((l) => l.native_name!) ?? []
      }
      onSelect={(langName) => {
        const lang = languages?.find((l) => l.native_name === langName);
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
