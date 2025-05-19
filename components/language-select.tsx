import type { Option } from '@/components/ui/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useSystem } from '@/contexts/SystemContext';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { Languages } from '@/lib/icons/Languages';
import { useLocalStore } from '@/store/localStore';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/react-native';
import { eq } from 'drizzle-orm';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const contentInsets = {
    top: insets.top,
    bottom: Platform.select({
      ios: insets.bottom,
      android: insets.bottom + 24
    }),
    left: 21,
    right: 21
  };

  const { db } = useSystem();
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

  const defaultLanguage = languages.find((l) => l.iso639_3 === 'eng');
  const selectedLanguage =
    languages.find((l) => l.id === value) ?? savedLanguage;

  const selectedOption: Option = {
    value: selectedLanguage?.id ?? defaultLanguage?.id ?? '',
    label: selectedLanguage?.native_name ?? defaultLanguage?.native_name ?? ''
  };

  return (
    <Select
      value={selectedOption}
      onValueChange={(option: Option | undefined) => {
        if (!option) return;
        const lang = languages.find((l) => l.id === option.value);
        if (lang) {
          setLanguage(lang);
          onChange?.(lang);
        }
      }}
    >
      <SelectTrigger className="flex-row items-center h-12 px-3 rounded-md border border-input bg-background">
        <Languages size={20} className="text-muted-foreground" />
        <SelectValue
          className="text-foreground text-sm native:text-base"
          placeholder={t('selectLanguage')}
        />
      </SelectTrigger>
      <SelectContent insets={contentInsets} className="w-full">
        {languages
          .filter((l) => l.native_name)
          .map((lang) => (
            <SelectItem key={lang.id} value={lang.id} label={lang.native_name!}>
              {lang.native_name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
};
