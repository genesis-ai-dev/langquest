import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn, getThemeColor } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, asc, desc, eq, like, or } from 'drizzle-orm';
import { LanguagesIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { useEffect, useMemo } from 'react';
import { TextInput, View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
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
  }, [shimmer]);

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

  // Search state with debouncing (300ms delay)
  // useDebouncedState returns: [debouncedValue, immediateValue, setValue]
  const [debouncedSearchQuery, immediateSearchQuery, setSearchQuery] =
    useDebouncedState('', 300);

  const conditions = [
    eq(languageTable.active, true),
    uiReadyOnly && eq(languageTable.ui_ready, true)
  ];

  // Build search conditions if search query exists
  const searchConditions = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return undefined;
    }
    const searchTerm = `%${debouncedSearchQuery.trim()}%`;
    return or(
      like(languageTable.native_name, searchTerm),
      like(languageTable.english_name, searchTerm),
      like(languageTable.locale, searchTerm)
    );
  }, [debouncedSearchQuery]);

  // Load languages immediately but limited for fast initial render when no search
  // When searching, remove limit to get all matching results
  const INITIAL_LANGUAGE_LIMIT = debouncedSearchQuery.trim() ? undefined : 100;

  // Use useHybridData to fetch languages - debounced search triggers new queries
  const { data: languages, isLoading } = useHybridData({
    dataType: 'all-languages',
    queryKeyParams: [uiReadyOnly, debouncedSearchQuery.trim()], // Include search in query key
    enabled: true, // Always enabled - limited query is fast

    // Disable cloud query - only use offline for immediate performance
    enableCloudQuery: false,
    enableOfflineQuery: true,

    // PowerSync query using Drizzle - search-aware query
    // When searching: no limit, filter by search terms
    // When not searching: limit to 100, order by ui_ready first
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: and(
          ...conditions.filter(Boolean),
          ...(searchConditions ? [searchConditions] : []) // Add search filter if search exists
        ),
        orderBy: [
          desc(languageTable.ui_ready), // UI-ready languages first
          asc(languageTable.native_name) // Then alphabetically
        ],
        ...(INITIAL_LANGUAGE_LIMIT && { limit: INITIAL_LANGUAGE_LIMIT }) // Only limit when not searching
      })
    ),

    // Cloud query - get all active languages (disabled for performance)
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

  const dropdownData = useMemo(() => {
    return languages
      .filter((l) => l.native_name)
      .map((lang) => {
        // Include English name in label for better searchability
        // Format: "Native Name (English Name)" if different
        const nativeName = lang.native_name ?? '';
        const englishName = lang.english_name ?? '';
        let label = nativeName;

        // Add English name in parentheses if it's different and would help search
        if (
          englishName &&
          englishName.toLowerCase() !== nativeName.toLowerCase()
        ) {
          label = `${nativeName} (${englishName})`;
        }

        return {
          value: lang.id,
          label,
          // Also store clean label for display if needed
          displayLabel: nativeName,
          // Store search terms for potential future custom filtering
          searchTerms: `${nativeName} ${englishName} ${lang.locale ?? ''}`,
          // Store full language object for onChange
          language: lang
        };
      });
  }, [languages]);

  const sortedData = useMemo(() => {
    return [...dropdownData].sort((a, b) => a.label.localeCompare(b.label));
  }, [dropdownData]);

  const handleValueChange = React.useCallback(
    (item: (typeof dropdownData)[0]) => {
      setSavedLanguage(item.language);
      onChange?.(item.language);
    },
    [onChange, setSavedLanguage]
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
    <View className={cn('w-full', className)}>
      <Dropdown
        style={{
          height: 48,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 12,
          backgroundColor: getThemeColor('card'),
          borderColor: getThemeColor('input')
        }}
        placeholderStyle={{
          fontSize: 16,
          color: getThemeColor('muted-foreground')
        }}
        selectedTextStyle={{
          fontSize: 16,
          color: getThemeColor('foreground')
        }}
        iconStyle={{
          width: 20,
          height: 20
        }}
        containerStyle={{
          borderRadius: 8,
          borderWidth: 1,
          marginTop: 4,
          backgroundColor: getThemeColor('card'),
          borderColor: getThemeColor('border')
        }}
        dropdownPosition="auto"
        itemTextStyle={{
          fontSize: 16,
          color: getThemeColor('foreground')
        }}
        activeColor={getThemeColor('primary')}
        data={sortedData}
        search
        maxHeight={400}
        labelField="label"
        valueField="value"
        placeholder={t('selectLanguage')}
        value={value ?? null}
        onChange={handleValueChange}
        renderInputSearch={() => (
          <View className="border-b border-input p-2">
            <TextInput
              value={immediateSearchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('searchLanguages') || 'Search languages...'}
              placeholderTextColor={getThemeColor('muted-foreground')}
              className="h-10 rounded-md bg-card px-3 text-base text-foreground"
              selectionColor={getThemeColor('primary')}
            />
          </View>
        )}
        flatListProps={{
          style: {
            backgroundColor: getThemeColor('card')
          },
          contentContainerStyle: {}
        }}
        renderLeftIcon={() => (
          <Icon
            as={LanguagesIcon}
            className="mr-2 text-muted-foreground"
            size={20}
          />
        )}
        renderItem={(item, selected) => (
          <View
            className={cn(
              'flex flex-row items-center px-3 py-3',
              selected && 'bg-accent'
            )}
          >
            <View className="flex-1">
              <Text
                className={cn(
                  'flex-1 text-sm',
                  selected
                    ? 'font-medium text-accent-foreground'
                    : 'text-foreground'
                )}
                numberOfLines={1}
              >
                {item.displayLabel || item.label}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

LanguageCombobox.displayName = 'LanguageCombobox';
