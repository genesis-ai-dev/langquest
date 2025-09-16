import type { Option } from '@/components/ui/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { language } from '@/db/drizzleSchema';
import { useUIReadyLanguages } from '@/hooks/db/useLanguages';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
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
  className?: string;
}

export function getLanguageOption(language?: Language | null): Option {
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

  const { languages } = useUIReadyLanguages();

  useEffect(() => {
    if (languages.length > 0) {
      setLanguagesLoaded?.(true);
    }
  }, [languages, setLanguagesLoaded]);

  const defaultLanguage = languages.find((l) => l.iso639_3 === 'eng');

  // Use controlled value if provided, otherwise fall back to saved language
  const selectedLanguage = value
    ? languages.find((l) => l.id === value)
    : savedLanguage;

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
