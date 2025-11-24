import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { languoid } from '@/db/drizzleSchema';
import { useLanguoids, useUIReadyLanguoids } from '@/hooks/db/useLanguoids';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn, getThemeColor } from '@/utils/styleUtils';
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

type Languoid = typeof languoid.$inferSelect;

interface LanguageComboboxProps {
  setLanguagesLoaded?: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string | null;
  onChange?: (languoid: Languoid) => void;
  className?: string;
  uiReadyOnly?: boolean;
  toggleUILocalization?: boolean;
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
  uiReadyOnly,
  toggleUILocalization
}) => {
  const setSavedLanguage = useLocalStore((state) => state.setSavedLanguage);
  const setUILanguage = useLocalStore((state) => state.setUILanguage);
  const uiLanguage = useLocalStore((state) => state.uiLanguage);
  const { t } = useLocalization();
  const { isAuthenticated } = useAuth();

  // Search state with debouncing (300ms delay)
  // useDebouncedState returns: [debouncedValue, immediateValue, setValue]
  const [debouncedSearchQuery, immediateSearchQuery, setSearchQuery] =
    useDebouncedState('', 300);

  // Use useUIReadyLanguoids if uiReadyOnly, otherwise use useLanguoids
  const { languoids: uiReadyLanguoids, isLanguoidsLoading: isLoadingUIReady } =
    useUIReadyLanguoids();
  const { languoids: allLanguoids, isLanguoidsLoading: isLoadingAll } =
    useLanguoids();
  const languoids = uiReadyOnly ? uiReadyLanguoids : allLanguoids;
  const isLoading = uiReadyOnly ? isLoadingUIReady : isLoadingAll;

  // Filter languoids by search query
  const filteredLanguoids = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return languoids;
    }
    const searchLower = debouncedSearchQuery.trim().toLowerCase();
    return languoids.filter((l) => l.name?.toLowerCase().includes(searchLower));
  }, [languoids, debouncedSearchQuery]);

  useEffect(() => {
    if (languoids.length > 0) {
      setLanguagesLoaded?.(true);
    }
  }, [languoids, setLanguagesLoaded]);

  const dropdownData = useMemo(() => {
    return filteredLanguoids
      .filter((l) => l.name)
      .map((lang) => {
        const name = lang.name ?? '';
        return {
          value: lang.id,
          label: name,
          displayLabel: name,
          // Store full languoid object for onChange
          languoid: lang
        };
      });
  }, [filteredLanguoids]);

  const sortedData = useMemo(() => {
    return [...dropdownData].sort((a, b) => a.label.localeCompare(b.label));
  }, [dropdownData]);

  // Use controlled value if provided, otherwise fall back to UI language from store
  const effectiveValue = useMemo(() => {
    if (value) return value;
    return uiLanguage?.id ?? null;
  }, [value, uiLanguage]);

  const handleValueChange = React.useCallback(
    (item: (typeof dropdownData)[0]) => {
      // TODO: Update store to support Languoid type
      // For now, use type assertion to handle transition
      setSavedLanguage(item.languoid as any);
      if (toggleUILocalization) {
        setUILanguage(item.languoid as any);
      }
      onChange?.(item.languoid);
    },
    [onChange, setSavedLanguage, toggleUILocalization, setUILanguage]
  );

  // Show loading state while fetching
  if (isLoading || languoids.length === 0) {
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
        value={effectiveValue}
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
