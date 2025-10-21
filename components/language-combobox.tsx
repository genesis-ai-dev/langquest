import type { ComboboxOption } from '@/components/ui/combobox';
import { Combobox } from '@/components/ui/combobox';
import { Icon } from '@/components/ui/icon';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import { LanguagesIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

type Language = typeof languageTable.$inferSelect;

interface LanguageComboboxProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string | null;
  onChange?: (language: Language) => void;
  className?: string;
  uiReadyOnly?: boolean;
}

function LoadingState() {
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.4
  }));

  return (
    <View className="flex flex-row items-center gap-2">
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{
          type: 'timing',
          duration: 2000,
          loop: true
        }}
      >
        <Icon as={LanguagesIcon} className="text-muted-foreground" size={20} />
      </MotiView>
      <View className="flex flex-1 flex-col gap-2">
        <Animated.View
          style={shimmerStyle}
          className="h-4 w-32 rounded bg-muted"
        />
        <Animated.View
          style={shimmerStyle}
          className="h-3 w-24 rounded bg-muted"
        />
      </View>
    </View>
  );
}

export const LanguageCombobox: React.FC<LanguageComboboxProps> = ({
  value,
  onChange,
  setLanguagesLoaded,
  className,
  uiReadyOnly
}) => {
  const setSavedLanguage = useLocalStore((state) => state.setSavedLanguage);
  const { t } = useLocalization();

  const conditions = [
    eq(languageTable.active, true),
    uiReadyOnly && eq(languageTable.ui_ready, true)
  ];

  // Use useHybridData to fetch ALL languages
  const { data: languages, isLoading } = useHybridData({
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

  const options = React.useMemo<ComboboxOption[]>(() => {
    return languages
      .filter((l) => l.native_name)
      .map((lang) => ({
        value: lang.id,
        label: lang.native_name ?? lang.english_name ?? '',
        // Include both native and english names for searching
        searchTerms: `${lang.native_name} ${lang.english_name} ${lang.locale ?? ''}`
      }));
  }, [languages]);

  const handleValueChange = React.useCallback(
    (languageId: string) => {
      const lang = languages.find((l) => l.id === languageId);
      if (lang) {
        setSavedLanguage(lang);
        onChange?.(lang);
      }
    },
    [languages, onChange, setSavedLanguage]
  );

  // Show loading state while fetching
  if (isLoading || languages.length === 0) {
    return (
      <View
        className={cn(
          'h-12 rounded-md border border-input bg-card px-3',
          className
        )}
      >
        <LoadingState />
      </View>
    );
  }

  return (
    <Combobox
      className={className}
      options={options}
      value={value ?? undefined}
      onValueChange={handleValueChange}
      placeholder={t('selectLanguage')}
      searchPlaceholder={t('searchLanguages') || 'Search languages...'}
      emptyText={t('noLanguagesFound') || 'No languages found'}
      prefix={
        <Icon as={LanguagesIcon} className="text-muted-foreground" size={20} />
      }
      maxHeight={400}
      pageSize={50}
      minSearchLength={2}
    />
  );
};

LanguageCombobox.displayName = 'LanguageCombobox';
