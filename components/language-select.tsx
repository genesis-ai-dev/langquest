import type { Option } from '@/components/ui/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { Languoid } from '@/hooks/db/useLanguoids';
import {
  useLanguoidEndonyms,
  useLanguoids,
  useUIReadyLanguoids
} from '@/hooks/db/useLanguoids';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import { LanguagesIcon } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './ui/icon';

interface LanguoidSelectProps {
  setLanguoidsLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string | null;
  onChange?: (languoid: Languoid) => void;
  label?: boolean;
  containerStyle?: object;
  className?: string;
  uiReadyOnly?: boolean;
}

export function getAllLanguoidOption(
  languoid?: Languoid | null,
  endonymMap?: Map<string, string>
): Option {
  if (languoid) {
    const endonym = endonymMap?.get(languoid.id);
    const displayName = endonym ?? languoid.name ?? '';
    return {
      value: languoid.id,
      label: displayName
    };
  }
}

export const LanguoidSelect: React.FC<LanguoidSelectProps> = ({
  value,
  onChange,
  setLanguoidsLoaded,
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

  const setUILanguoid = useLocalStore((state) => state.setUILanguoid);
  const uiLanguoid = useLocalStore((state) => state.uiLanguoid);

  const setSavedLanguoid = useLocalStore((state) => state.setSavedLanguoid);

  const { t } = useLocalization();

  // Use useUIReadyLanguoids if uiReadyOnly, otherwise use useLanguoids
  const { languoids: uiReadyLanguoids } = useUIReadyLanguoids();
  const { languoids: allLanguoids } = useLanguoids();
  const languoids = uiReadyOnly ? uiReadyLanguoids : allLanguoids;

  // Fetch endonyms for all languoids
  const languoidIds = useMemo(() => languoids.map((l) => l.id), [languoids]);
  const { endonymMap } = useLanguoidEndonyms(languoidIds);

  useEffect(() => {
    if (languoids.length > 0) {
      setLanguoidsLoaded?.(true);
    }
  }, [languoids, setLanguoidsLoaded]);

  // Use controlled value if provided, otherwise fall back to saved languoid
  // Don't set a default languoid on mount - let it be empty until user selects
  const selectedLanguoid = value
    ? languoids.find((l) => l.id === value)
    : uiLanguoid
      ? languoids.find((l) => l.id === uiLanguoid.id)
      : languoids.find((lang) => lang.name === 'English');

  const selectedOption = getAllLanguoidOption(selectedLanguoid, endonymMap);

  return (
    <Select
      value={selectedOption}
      onValueChange={(option) => {
        if (!option) return;
        const lang = languoids.find((l) => l.id === option.value);
        if (lang) {
          // Always save the language and set UI language
          setSavedLanguoid(lang);
          setUILanguoid(lang);
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
          .map((lang) => {
            const option = getAllLanguoidOption(lang, endonymMap);
            return (
              <SelectItem key={lang.id} {...option!}>
                {option?.label}
              </SelectItem>
            );
          })}
      </SelectContent>
    </Select>
  );
};

LanguoidSelect.displayName = 'LanguoidSelect';
