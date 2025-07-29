import type { language } from '@/db/drizzleSchema';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { colors, spacing } from '@/styles/theme';
import { useHybridData } from '@/views/new/useHybridData';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import {
  memo,
  default as React,
  useCallback,
  useEffect,
  useState
} from 'react';
import { CustomDropdown } from './CustomDropdown';

type Language = typeof language.$inferSelect;

interface LanguageSelectProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string;
  onChange?: (language: Language) => void;
  label?: boolean;
  containerStyle?: object;
}

const LanguageSelect: React.FC<LanguageSelectProps> = memo(
  ({ value, onChange, setLanguagesLoaded }) => {
    const [showLanguages, setShowLanguages] = useState(false);
    const setLanguage = useLocalStore((state) => state.setLanguage);
    const savedLanguage = useLocalStore((state) => state.language);
    const { t } = useLocalization();

    // Use useHybridData directly
    const { data: languages } = useHybridData<Language>({
      dataType: 'languages',
      queryKeyParams: ['ui-ready'],

      // PowerSync query using Drizzle
      offlineQuery: toCompilableQuery(
        system.db.query.language.findMany({
          where: and(
            eq(languageTable.active, true),
            eq(languageTable.ui_ready, true)
          )
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

    const handleSelect = useCallback(
      (langName: string) => {
        const lang = languages.find((l) => l.native_name === langName);
        if (lang) {
          setLanguage(lang);
          onChange?.(lang);
        }
      },
      [languages, setLanguage, onChange]
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
        value={
          selectedLanguage?.native_name ?? defaultLanguage?.native_name ?? ''
        }
        options={languages
          .filter((l) => l.native_name)
          .map((l) => l.native_name!)}
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
