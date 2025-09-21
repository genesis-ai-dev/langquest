import type { Option } from '@/components/ui/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { language } from '@/db/drizzleSchema';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import { LanguagesIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './ui/icon';

type Language = typeof language.$inferSelect;

interface AllLanguagesSelectProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string;
  onChange?: (language: Language) => void;
  label?: boolean;
  containerStyle?: object;
  className?: string;
}

export function getAllLanguageOption(language?: Language | null): Option {
  if (language) {
    return {
      value: language.id,
      label: language.native_name ?? language.english_name ?? ''
    };
  }
}

export const AllLanguagesSelect: React.FC<AllLanguagesSelectProps> = ({
  value,
  onChange,
  setLanguagesLoaded,
  className
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

  // Use useHybridData to fetch ALL languages (not just UI-ready ones)
  const { data: languages } = useHybridData<Language>({
    dataType: 'all-languages',
    queryKeyParams: ['all'],

    // PowerSync query using Drizzle - get all active languages
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: eq(languageTable.active, true)
      })
    ),

    // Cloud query - get all active languages
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('*')
        .eq('active', true)
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

  // Use controlled value if provided, otherwise fall back to saved language
  // Don't set a default language on mount - let it be empty until user selects
  const selectedLanguage = value
    ? languages.find((l) => l.id === value)
    : savedLanguage;

  const selectedOption: Option | undefined = selectedLanguage
    ? {
        value: selectedLanguage.id,
        label:
          selectedLanguage.native_name ?? selectedLanguage.english_name ?? ''
      }
    : undefined;

  return (
    <Select
      value={selectedOption}
      onValueChange={(option: Option | undefined) => {
        if (!option) return;
        const lang = languages.find((l) => l.id === option.value);
        if (lang) {
          // If onChange is provided, use it (controlled mode)
          if (onChange) {
            onChange(lang);
          } else {
            // Otherwise, update local store (uncontrolled mode)
            setLanguage(lang);
          }
        }
      }}
    >
      <SelectTrigger
        className={cn(`h-12 flex-row items-center rounded-md px-3`, className)}
      >
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

AllLanguagesSelect.displayName = 'AllLanguagesSelect';
