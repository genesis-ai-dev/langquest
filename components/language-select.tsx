import type { Option } from '@/components/ui/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import { LanguagesIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './ui/icon';

type Language = typeof languageTable.$inferSelect;

interface LanguageSelectProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string | null;
  onChange?: (language: Language) => void;
  label?: boolean;
  containerStyle?: object;
  className?: string;
  uiReadyOnly?: boolean;
}

export function getAllLanguageOption(language?: Language | null): Option {
  if (language) {
    return {
      value: language.id,
      label: language.native_name ?? language.english_name ?? ''
    };
  }
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
  value,
  onChange,
  setLanguagesLoaded,
  className,
  uiReadyOnly
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

  const setUILanguage = useLocalStore((state) => state.setUILanguage);
  const uiLanguage = useLocalStore((state) => state.uiLanguage);

  const setSavedLanguage = useLocalStore((state) => state.setSavedLanguage);

  const { t } = useLocalization();

  const conditions = [
    eq(languageTable.active, true),
    uiReadyOnly && eq(languageTable.ui_ready, true)
  ];

  // Use useHybridData to fetch ALL languages (not just UI-ready ones)
  const { data: languages } = useHybridData({
    dataType: 'all-languages',
    queryKeyParams: [uiReadyOnly],

    // PowerSync query using Drizzle - get all active languages
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: and(...conditions.filter(Boolean))
      })
    ),

    // Cloud query - get all active languages
    cloudQueryFn: async () => {
      let query = system.supabaseConnector.client
        .from('language')
        .select('*')
        .eq('active', true);

      if (uiReadyOnly) query = query.eq('ui_ready', true);

      const { data, error } = await query.overrideTypes<Language[]>();
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
    : (uiLanguage ?? languages.find((lang) => lang.locale === 'en'));

  const selectedOption = getAllLanguageOption(selectedLanguage);

  return (
    <Select
      value={selectedOption}
      onValueChange={(option) => {
        if (!option) return;
        const lang = languages.find((l) => l.id === option.value);
        if (lang) {
          // If onChange is provided, use it (controlled mode)
          setSavedLanguage(lang);
          if (onChange) onChange(lang);
          else setUILanguage(lang);
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
            <SelectItem key={lang.id} {...getAllLanguageOption(lang)!}>
              {lang.native_name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
};

LanguageSelect.displayName = 'LanguageSelect';
