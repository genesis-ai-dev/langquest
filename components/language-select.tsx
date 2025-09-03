import type { Option } from '@/components/ui/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { LanguagesIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './ui/icon';

type Language = typeof language.$inferSelect;

interface LanguageSelectProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
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

  const setLanguage = useLocalStore((state) => state.setLanguage);
  const savedLanguage = useLocalStore((state) => state.language);
  const { t } = useLocalization();

  const { data: languages } = useHybridData<Language>({
    dataType: 'languages',
    queryKeyParams: ['ui-ready'],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: (languageTable, { eq, and }) =>
          and(eq(languageTable.active, true), eq(languageTable.ui_ready, true))
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('*')
        .eq('active', true)
        .eq('ui_ready', true)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (languages.length > 0) {
      setLanguagesLoaded?.(true);
    }
  }, [languages, setLanguagesLoaded]);

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
      <SelectTrigger className="h-12 flex-row items-center rounded-md px-3">
        <Icon as={LanguagesIcon} className="text-muted-foreground" />
        <SelectValue
          className="text-base text-foreground"
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
