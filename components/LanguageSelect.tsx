import { languoid } from '@/db/drizzleSchema';
import { useUIReadyLanguoids } from '@/hooks/db/useLanguoids';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  memo,
  default as React,
  useCallback,
  useEffect,
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

    useEffect(() => {
      if (languoids.length > 0) {
        setLanguagesLoaded?.(true);
      }
    }, [languoids, setLanguagesLoaded]);

    const defaultLanguage = languoids.find((l) => l.name === 'English');
    const selectedLanguage =
      languoids.find((l) => l.id === value) ?? savedLanguage;

    const handleSelect = useCallback(
      (langName: string) => {
        const lang = languoids.find((l) => l.name === langName);
        if (lang) {
          setLanguage(lang);
          onChange?.(lang);
        }
      },
      [languoids, setLanguage, onChange]
    );

    const handleToggle = useCallback(() => {
      setShowLanguages(!showLanguages);
    }, [showLanguages]);

    const renderLeftIcon = useCallback(
      () => (
        <Ionicons
          name="language"
          size={20}
          color={colors.text}
          style={{ marginRight: spacing.medium }}
        />
      ),
      []
    );

    return (
      <CustomDropdown
        renderLeftIcon={renderLeftIcon}
        value={selectedLanguage?.name ?? defaultLanguage?.name ?? ''}
        options={languoids.filter((l) => l.name).map((l) => l.name!)}
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
