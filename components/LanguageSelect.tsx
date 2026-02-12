import { Icon } from '@/components/ui/icon';
import { languoid } from '@/db/drizzleSchema';
import {
  useLanguoidEndonyms,
  useUIReadyLanguoids
} from '@/hooks/db/useLanguoids';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { colors, spacing } from '@/styles/theme';
import {
  memo,
  default as React,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import { CustomDropdown } from './CustomDropdown';

type Languoid = typeof languoid.$inferSelect;

interface LanguageSelectProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string;
  onChange?: (languoid: Languoid) => void;
  label?: boolean;
  containerStyle?: object;
}

const LanguageSelect: React.FC<LanguageSelectProps> = memo(
  ({ value, onChange, setLanguagesLoaded }) => {
    const [showLanguages, setShowLanguages] = useState(false);
    const setLanguage = useLocalStore((state) => state.setUILanguage);
    const savedLanguage = useLocalStore((state) => state.uiLanguage);
    const { t } = useLocalization();

    // Use useUIReadyLanguoids hook
    const { languoids } = useUIReadyLanguoids();

    // Fetch endonyms for all languoids
    const languoidIds = useMemo(() => languoids.map((l) => l.id), [languoids]);
    const { endonymMap } = useLanguoidEndonyms(languoidIds);

    useEffect(() => {
      if (languoids.length > 0) {
        setLanguagesLoaded?.(true);
      }
    }, [languoids, setLanguagesLoaded]);

    const defaultLanguage = languoids.find((l) => l.name === 'English');

    // Find selected language - handle both Languoid and old Language types
    const selectedLanguage = useMemo(() => {
      if (value) {
        return languoids.find((l) => l.id === value);
      }
      if (savedLanguage) {
        // Check if it's a Languoid (has 'name' property) or old Language (has 'english_name')
        const langAny = savedLanguage as any;
        if (langAny.id && typeof langAny.id === 'string') {
          return languoids.find((l) => l.id === langAny.id);
        }
      }
      return defaultLanguage;
    }, [value, savedLanguage, languoids, defaultLanguage]);

    const handleSelect = useCallback(
      (displayName: string) => {
        // Find languoid by matching endonym or name
        const lang = languoids.find((l) => {
          const endonym = endonymMap.get(l.id);
          const display = endonym ?? l.name ?? '';
          return display === displayName;
        });
        if (lang) {
          // TODO: Update store to support Languoid type
          // For now, use type assertion to handle transition
          setLanguage(lang as any);
          onChange?.(lang);
        }
      },
      [languoids, endonymMap, setLanguage, onChange]
    );

    const handleToggle = useCallback(() => {
      setShowLanguages(!showLanguages);
    }, [showLanguages]);

    const renderLeftIcon = useCallback(
      () => (
        <Icon
          name="languages"
          size={20}
          color={colors.text}
          style={{ marginRight: spacing.medium }}
        />
      ),
      []
    );

    // Get display names (endonyms preferred, fallback to name)
    const displayOptions = useMemo(() => {
      return languoids
        .filter((l) => l.name)
        .map((l) => {
          const endonym = endonymMap.get(l.id);
          return endonym ?? l.name ?? '';
        });
    }, [languoids, endonymMap]);

    // Get selected display name
    const selectedDisplayName = useMemo(() => {
      if (!selectedLanguage) return '';
      const endonym = endonymMap.get(selectedLanguage.id);
      return endonym ?? selectedLanguage.name ?? '';
    }, [selectedLanguage, endonymMap]);

    return (
      <CustomDropdown
        renderLeftIcon={renderLeftIcon}
        value={selectedDisplayName}
        options={displayOptions}
        onSelect={handleSelect}
        isOpen={showLanguages}
        onToggle={handleToggle}
        search={true}
        searchPlaceholder={t('search')}
        fullWidth={true}
      />
    );
  }
);

LanguageSelect.displayName = 'LanguageSelect';

export { LanguageSelect };
