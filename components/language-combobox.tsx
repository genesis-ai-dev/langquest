import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { languoid } from '@/db/drizzleSchema';
import type { LanguoidSearchResult } from '@/hooks/db/useLanguoids';
import {
  useLanguoidById,
  useLanguoidEndonyms,
  useLanguoidSearch,
  useUIReadyLanguoids
} from '@/hooks/db/useLanguoids';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLocalStore } from '@/store/localStore';
import { createLanguoidOffline } from '@/utils/languoidUtils';
import { cn, getThemeColor, useThemeColor } from '@/utils/styleUtils';
import { LanguagesIcon, PlusCircleIcon, SearchIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { ButtonPressable } from './ui/button';

type Languoid = typeof languoid.$inferSelect;

// Extended type for dropdown items that includes the "create new" option
interface DropdownItem {
  value: string;
  label: string;
  displayLabel: string;
  languoid?: Languoid | LanguoidSearchResult;
  isCreateOption?: boolean;
  isoCode?: string | null;
  matchedAlias?: string | null;
}

interface LanguageComboboxProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string | null;
  onChange?: (languoid: Languoid | LanguoidSearchResult) => void;
  className?: string;
  /** Only show UI-ready languages (for UI language selection) */
  uiReadyOnly?: boolean;
  /** Update the UI localization when selection changes */
  toggleUILocalization?: boolean;
  /** Allow creating new languages when search has no results */
  allowCreate?: boolean;
  /** Callback when a new language is created (receives the new languoid ID) */
  onCreateNew?: (languoidId: string, name: string) => void;
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
  uiReadyOnly = false,
  toggleUILocalization,
  allowCreate = false,
  onCreateNew
}) => {
  const primaryColor = useThemeColor('primary');
  const setSavedLanguage = useLocalStore((state) => state.setSavedLanguage);
  const setUILanguage = useLocalStore((state) => state.setUILanguage);
  const uiLanguage = useLocalStore((state) => state.uiLanguage);
  const { t } = useLocalization();
  const { isAuthenticated, currentUser } = useAuth();
  const isOnline = useNetworkStatus();

  // State for creation flow
  const [isCreating, setIsCreating] = useState(false);

  // Store the currently selected languoid to preserve it in dropdown data
  const [selectedLanguoid, setSelectedLanguoid] = useState<
    Languoid | LanguoidSearchResult | null
  >(null);

  // Search state with debouncing (300ms delay)
  const [debouncedSearchQuery, immediateSearchQuery, setSearchQuery] =
    useDebouncedState('', 300);

  // Use server-side search when online and searching
  const shouldUseServerSearch = isOnline && debouncedSearchQuery.length >= 2;

  // Server-side search results
  const {
    results: searchResults,
    isLoading: isSearchLoading,
    isQueryValid
  } = useLanguoidSearch(debouncedSearchQuery, {
    limit: 50,
    uiReadyOnly,
    enabled: shouldUseServerSearch
  });

  // Only fetch local languoids for uiReadyOnly mode (small dataset for UI language selection)
  // For general language selection, rely on server search to avoid loading 300k+ records
  const { languoids: uiReadyLanguoids, isLanguoidsLoading: isLoadingUIReady } =
    useUIReadyLanguoids();

  // For non-uiReadyOnly mode, don't fetch all languoids - use search instead
  const localLanguoids = uiReadyOnly ? uiReadyLanguoids : [];
  const isLocalLoading = uiReadyOnly ? isLoadingUIReady : false;

  // Fetch the languoid by ID if a value is passed but we don't have it yet
  const shouldFetchById = !!value && selectedLanguoid?.id !== value;
  const { languoid: fetchedLanguoid } = useLanguoidById(
    shouldFetchById ? value : undefined
  );

  // Populate selectedLanguoid when fetched or when value changes
  useEffect(() => {
    if (fetchedLanguoid && fetchedLanguoid.id === value) {
      setSelectedLanguoid(fetchedLanguoid);
    }
  }, [fetchedLanguoid, value]);

  // Determine which data source to use
  const useServerResults = shouldUseServerSearch && isQueryValid;

  // Get languoid IDs for endonym lookup
  const languoidIds = useMemo(() => {
    if (useServerResults) {
      return searchResults.map((r) => r.id);
    }
    return localLanguoids.map((l) => l.id);
  }, [useServerResults, searchResults, localLanguoids]);

  // Fetch endonyms
  const { endonymMap } = useLanguoidEndonyms(languoidIds);

  // Filter local languoids by search query (client-side filtering)
  const filteredLocalLanguoids = useMemo(() => {
    if (useServerResults) return []; // Don't need this when using server search

    if (!debouncedSearchQuery.trim()) {
      return localLanguoids;
    }
    const searchLower = debouncedSearchQuery.trim().toLowerCase();
    return localLanguoids.filter((l) => {
      const name = l.name?.toLowerCase() ?? '';
      const endonym = endonymMap.get(l.id)?.toLowerCase() ?? '';
      return name.includes(searchLower) || endonym.includes(searchLower);
    });
  }, [localLanguoids, debouncedSearchQuery, endonymMap, useServerResults]);

  // Notify parent when languages are loaded
  // For uiReadyOnly mode, wait for local data. For general mode, ready immediately.
  useEffect(() => {
    if (uiReadyOnly) {
      if (localLanguoids.length > 0) {
        setLanguagesLoaded?.(true);
      }
    } else {
      // For general mode, we use server search, so it's ready immediately
      setLanguagesLoaded?.(true);
    }
  }, [localLanguoids, setLanguagesLoaded, uiReadyOnly]);

  // Build dropdown data from the appropriate source
  const dropdownData = useMemo(() => {
    const items: DropdownItem[] = [];
    const addedIds = new Set<string>();

    // Always include the currently selected languoid first
    // This ensures it remains visible after search is cleared
    if (selectedLanguoid && selectedLanguoid.id) {
      const displayName = selectedLanguoid.name ?? '';
      items.push({
        value: selectedLanguoid.id,
        label: displayName,
        displayLabel: displayName,
        languoid: selectedLanguoid,
        isoCode:
          'iso_code' in selectedLanguoid ? selectedLanguoid.iso_code : null
      });
      addedIds.add(selectedLanguoid.id);
    }

    if (useServerResults) {
      // Use server search results
      searchResults.forEach((result) => {
        if (addedIds.has(result.id)) return;
        // Always use the canonical languoid name as primary display
        const canonicalName = result.name ?? '';
        // Only show matched alias if it's different from the canonical name
        // (i.e., the search matched an alias, not the name itself)
        const matchedAlias =
          result.matched_alias_name &&
          result.matched_alias_name.toLowerCase() !==
            canonicalName.toLowerCase()
            ? result.matched_alias_name
            : null;
        items.push({
          value: result.id,
          label: canonicalName,
          displayLabel: canonicalName,
          languoid: result,
          isoCode: result.iso_code,
          matchedAlias: matchedAlias
        });
        addedIds.add(result.id);
      });
    } else {
      // Use local languoids with client-side filtering
      filteredLocalLanguoids
        .filter((l) => l.name)
        .forEach((lang) => {
          if (addedIds.has(lang.id)) return;
          const endonym = endonymMap.get(lang.id);
          const displayName = endonym ?? lang.name ?? '';
          items.push({
            value: lang.id,
            label: displayName,
            displayLabel: displayName,
            languoid: lang
          });
          addedIds.add(lang.id);
        });
    }

    return items;
  }, [
    useServerResults,
    searchResults,
    filteredLocalLanguoids,
    endonymMap,
    selectedLanguoid
  ]);

  // Sort and optionally add "Create new" option
  const sortedData = useMemo(() => {
    const sorted = [...dropdownData].sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    // Add "Create new" option if:
    // - allowCreate is true
    // - User is authenticated
    // - There's a search query with >= 2 chars
    // - No matching results found (excluding the currently selected item)
    const trimmedQuery = debouncedSearchQuery.trim();
    const hasSearchQuery = trimmedQuery.length >= 2;
    // Count results excluding the currently selected languoid
    // (selectedLanguoid is always added to dropdownData to preserve it after search clears)
    const resultsExcludingSelected = sorted.filter(
      (item) => item.value !== selectedLanguoid?.id
    );
    const hasNoMatchingResults = resultsExcludingSelected.length === 0;
    const shouldShowCreate =
      allowCreate && isAuthenticated && hasSearchQuery && hasNoMatchingResults;

    if (shouldShowCreate) {
      sorted.unshift({
        value: '__create_new__',
        label:
          t('createLanguage', { name: trimmedQuery }) ||
          `Create "${trimmedQuery}"`,
        displayLabel: trimmedQuery,
        isCreateOption: true
      });
    }

    return sorted;
  }, [
    dropdownData,
    debouncedSearchQuery,
    allowCreate,
    isAuthenticated,
    t,
    selectedLanguoid
  ]);

  // Use controlled value if provided, otherwise fall back to UI language from store
  const effectiveValue = useMemo(() => {
    if (value) return value;
    return uiLanguage?.id ?? null;
  }, [value, uiLanguage]);

  // Handle creating a new languoid
  const handleCreateNew = useCallback(
    async (name: string) => {
      if (!currentUser?.id || !name.trim()) return;

      setIsCreating(true);
      try {
        const result = await createLanguoidOffline({
          name: name.trim(),
          level: 'language',
          creator_id: currentUser.id
        });

        // Notify parent about creation
        onCreateNew?.(result.languoid_id, name.trim());

        // Create a minimal languoid object for the onChange callback
        const newLanguoid: LanguoidSearchResult = {
          id: result.languoid_id,
          name: name.trim(),
          level: 'language',
          ui_ready: false,
          parent_id: null,
          matched_alias_name: null,
          matched_alias_type: null,
          iso_code: null,
          search_rank: 1
        };

        // Store the selected languoid to keep it in dropdown data
        setSelectedLanguoid(newLanguoid);
        setSavedLanguage(newLanguoid as any);
        onChange?.(newLanguoid);

        // Clear search
        setSearchQuery('');
      } catch (error) {
        console.error('Failed to create languoid:', error);
      } finally {
        setIsCreating(false);
      }
    },
    [currentUser?.id, onCreateNew, onChange, setSavedLanguage, setSearchQuery]
  );

  const handleValueChange = useCallback(
    (item: DropdownItem) => {
      // Handle "Create new" option
      if (item.isCreateOption) {
        void handleCreateNew(item.displayLabel);
        return;
      }

      // Normal selection
      if (item.languoid) {
        // Store the selected languoid to keep it in dropdown data
        setSelectedLanguoid(item.languoid);
        setSavedLanguage(item.languoid as any);
        if (toggleUILocalization) {
          setUILanguage(item.languoid as any);
        }
        onChange?.(item.languoid);
      }

      // Clear search after selection
      setSearchQuery('');
    },
    [
      handleCreateNew,
      onChange,
      setSavedLanguage,
      toggleUILocalization,
      setUILanguage,
      setSearchQuery
    ]
  );

  // Determine loading state
  const isLoading =
    isLocalLoading || (shouldUseServerSearch && isSearchLoading) || isCreating;

  // Show loading state while fetching initial data (only for uiReadyOnly mode)
  if (uiReadyOnly && isLocalLoading && localLanguoids.length === 0) {
    return (
      <View className={cn('h-12 border border-border bg-card px-3', className)}>
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
          borderColor: getThemeColor('border')
        }}
        placeholderStyle={{
          fontSize: 14,
          color: getThemeColor('muted-foreground')
        }}
        selectedTextStyle={{
          fontSize: 14,
          lineHeight: 48,
          color: getThemeColor('foreground')
        }}
        iconStyle={{
          width: 20,
          height: 20
        }}
        containerStyle={{
          borderRadius: 8,
          overflow: 'hidden',
          borderWidth: 1,
          marginTop: 8,
          backgroundColor: getThemeColor('card'),
          borderColor: getThemeColor('border')
        }}
        dropdownPosition="auto"
        itemTextStyle={{
          fontSize: 14,
          color: getThemeColor('foreground')
        }}
        itemContainerStyle={{
          borderRadius: 8,
          overflow: 'hidden'
        }}
        // activeColor={getThemeColor('primary')}
        activeColor={primaryColor}
        data={sortedData}
        search
        maxHeight={400}
        labelField="label"
        valueField="value"
        placeholder={t('selectLanguage')}
        value={effectiveValue}
        onChange={handleValueChange}
        renderInputSearch={() => (
          <View className="overflow-hidden border-b border-border">
            <Input
              value={immediateSearchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('searchLanguages') || 'Search languages...'}
              prefix={SearchIcon}
              size="sm"
              className="border-0"
              autoCapitalize="none"
              autoCorrect={false}
              suffix={
                (isSearchLoading || isCreating) && immediateSearchQuery ? (
                  <ActivityIndicator
                    size="small"
                    color={getThemeColor('primary')}
                  />
                ) : undefined
              }
            />
          </View>
        )}
        flatListProps={{
          style: {
            backgroundColor: getThemeColor('card')
          },
          contentContainerStyle: {},
          ListEmptyComponent: () => (
            <View className="px-3 py-4">
              <Text className="text-center text-sm text-muted-foreground">
                {isSearchLoading
                  ? t('searching') || 'Searching...'
                  : debouncedSearchQuery.length >= 2
                    ? t('noLanguagesFound') || 'No languages found'
                    : t('typeToSearch', { min: 2 }) ||
                      'Type at least 2 characters to search'}
              </Text>
            </View>
          )
        }}
        renderLeftIcon={() => (
          <Icon
            as={LanguagesIcon}
            className="mr-2 text-muted-foreground"
            size={20}
          />
        )}
        renderItem={(item, selected) => {
          // Special rendering for "Create new" option
          if (item.isCreateOption) {
            return (
              <ButtonPressable
                className="flex flex-row items-center bg-primary/10 p-3"
                onPress={() => handleValueChange(item)}
              >
                <Icon
                  as={PlusCircleIcon}
                  className="mr-2 text-primary"
                  size={20}
                />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-primary">
                    {t('createLanguage', { name: item.displayLabel }) ||
                      `Create "${item.displayLabel}"`}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Add this as a new language
                  </Text>
                </View>
              </ButtonPressable>
            );
          }

          // Normal item rendering
          return (
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
                {/* Show matched alias and/or ISO code if available */}
                {(item.isoCode || item.matchedAlias) && (
                  <Text className="text-xs text-muted-foreground">
                    {item.matchedAlias && `[${item.matchedAlias}] `}
                    {item.isoCode && `iso:${item.isoCode}`}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

LanguageCombobox.displayName = 'LanguageCombobox';
