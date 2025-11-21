import type { Option } from '@/components/ui/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { languoid } from '@/db/drizzleSchema';
import { useLanguoids, useUIReadyLanguoids } from '@/hooks/db/useLanguoids';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import { LanguagesIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './ui/icon';

type Languoid = typeof languoid.$inferSelect;

interface LanguageSelectProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string | null;
  onChange?: (languoid: Languoid) => void;
  label?: boolean;
  containerStyle?: object;
  className?: string;
  uiReadyOnly?: boolean;
}

export function getAllLanguageOption(languoid?: Languoid | null): Option {
  if (languoid) {
    return {
      value: languoid.id,
      label: languoid.name ?? ''
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

  // Use useUIReadyLanguoids if uiReadyOnly, otherwise use useLanguoids
  const { languoids: uiReadyLanguoids } = useUIReadyLanguoids();
  const { languoids: allLanguoids } = useLanguoids();
  const languoids = uiReadyOnly ? uiReadyLanguoids : allLanguoids;

  useEffect(() => {
    if (languoids.length > 0) {
      setLanguagesLoaded?.(true);
    }
  }, [languoids, setLanguagesLoaded]);

  // Use controlled value if provided, otherwise fall back to saved language
  // Don't set a default language on mount - let it be empty until user selects
  const selectedLanguage = value
    ? languoids.find((l) => l.id === value)
    : uiLanguage
      ? languoids.find((l) => {
          // Handle backward compatibility: uiLanguage might be old Language type
          if ('name' in (uiLanguage as any)) {
            return l.id === (uiLanguage as any).id;
          }
          return false;
        })
      : languoids.find((lang) => lang.name === 'English');

  const selectedOption = getAllLanguageOption(selectedLanguage);

  return (
    <Select
      value={selectedOption}
      onValueChange={(option) => {
        if (!option) return;
        const lang = languoids.find((l) => l.id === option.value);
        if (lang) {
          // Always save the language and set UI language
          // TODO: Update store to support Languoid type
          // For now, use type assertion to handle transition
          setSavedLanguage(lang as any);
          setUILanguage(lang as any);
          // If onChange is provided, call it as well (for controlled mode)
          if (onChange) onChange(lang);
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
        {languoids
          .filter((l) => l.name)
          .map((lang) => (
            <SelectItem key={lang.id} {...getAllLanguageOption(lang)!}>
              {lang.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
};

LanguageSelect.displayName = 'LanguageSelect';
