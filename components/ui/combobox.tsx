import { cn, getThemeColor } from '@/utils/styleUtils';
import { CheckIcon, ChevronDownIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
  View
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Icon } from './icon';
import { Text } from './text';

export interface ComboboxOption {
  value: string;
  label: string;
  searchTerms?: string; // Additional terms to search by
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  prefix?: React.ReactNode;
  maxHeight?: number;
  pageSize?: number; // Number of items to show per page
  minSearchLength?: number; // Minimum search length before showing all results
}

export const Combobox = React.forwardRef<View, ComboboxProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = 'Select...',
      searchPlaceholder = 'Search...',
      emptyText = 'No results found',
      className,
      disabled = false,
      isLoading = false,
      prefix,
      maxHeight = 320,
      pageSize = 50,
      minSearchLength = 2
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [displayLimit, setDisplayLimit] = React.useState(pageSize);
    const searchInputRef = React.useRef<TextInput>(null);

    const selectedOption = React.useMemo(
      () => options.find((opt) => opt.value === value),
      [options, value]
    );

    const filteredOptions = React.useMemo(() => {
      const searchTrimmed = search.trim();

      // If search is empty or too short, return empty to prompt user to search
      if (!searchTrimmed || searchTrimmed.length < minSearchLength) {
        return [];
      }

      const searchLower = searchTrimmed.toLowerCase();
      return options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchLower) ||
          opt.searchTerms?.toLowerCase().includes(searchLower)
      );
    }, [options, search, minSearchLength]);

    // Paginated display of filtered options
    const displayedOptions = React.useMemo(() => {
      return filteredOptions.slice(0, displayLimit);
    }, [filteredOptions, displayLimit]);

    const hasMore = displayLimit < filteredOptions.length;

    // Reset display limit when search changes
    React.useEffect(() => {
      setDisplayLimit(pageSize);
    }, [search, pageSize]);

    const handleSelect = React.useCallback(
      (optionValue: string) => {
        onValueChange?.(optionValue);
        setIsOpen(false);
        setSearch('');
        setDisplayLimit(pageSize);
      },
      [onValueChange, pageSize]
    );

    const handleOpen = React.useCallback(() => {
      if (disabled) return;
      setIsOpen(true);
      // Focus search input when opening
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }, [disabled]);

    const handleLoadMore = React.useCallback(() => {
      if (hasMore) {
        setDisplayLimit((prev) => prev + pageSize);
      }
    }, [hasMore, pageSize]);

    const handleClose = React.useCallback(() => {
      setIsOpen(false);
      setSearch('');
      setDisplayLimit(pageSize);
    }, [pageSize]);

    return (
      <View ref={ref} className={cn('relative', className)}>
        {/* Trigger */}
        <Pressable
          onPress={handleOpen}
          disabled={disabled}
          className={cn(
            'native:h-12 flex h-12 flex-row items-center justify-between rounded-md border border-input bg-card px-3 py-2',
            disabled && 'opacity-50'
          )}
        >
          <View className="flex flex-1 flex-row items-center gap-2">
            {prefix}
            {isLoading ? (
              <View className="flex flex-row items-center gap-2">
                <ActivityIndicator
                  size="small"
                  color={getThemeColor('primary')}
                />
                <Text className="text-sm text-muted-foreground">
                  Loading...
                </Text>
              </View>
            ) : (
              <Text
                className={cn(
                  'flex-1 text-base',
                  selectedOption ? 'text-foreground' : 'text-muted-foreground'
                )}
                numberOfLines={1}
              >
                {selectedOption?.label || placeholder}
              </Text>
            )}
          </View>
          <Icon
            as={ChevronDownIcon}
            className="text-muted-foreground"
            size={20}
          />
        </Pressable>

        {/* Dropdown */}
        {isOpen && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            className="absolute left-0 right-0 top-[52px] z-50"
          >
            <MotiView
              from={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <View
                className="rounded-md border border-input bg-popover shadow-lg shadow-foreground/10"
                style={{ maxHeight }}
              >
                {/* Search Input */}
                <View className="border-b border-border p-2">
                  <TextInput
                    ref={searchInputRef}
                    value={search}
                    onChangeText={setSearch}
                    placeholder={searchPlaceholder}
                    placeholderTextColor={getThemeColor('muted-foreground')}
                    className="h-10 rounded-md bg-card px-3 text-base text-foreground"
                    selectionColor={getThemeColor('primary')}
                  />
                </View>

                {/* Options List */}
                <View style={{ height: maxHeight - 60 }}>
                  <FlatList
                    data={displayedOptions}
                    keyExtractor={(item) => item.value}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => handleSelect(item.value)}
                        className={cn(
                          'flex flex-row items-center justify-between px-3 py-3',
                          'active:bg-accent',
                          item.value === value && 'bg-accent'
                        )}
                      >
                        <Text
                          className={cn(
                            'flex-1 text-sm',
                            item.value === value
                              ? 'font-medium text-accent-foreground'
                              : 'text-foreground'
                          )}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        {item.value === value && (
                          <Icon
                            as={CheckIcon}
                            size={16}
                            className="ml-2 text-accent-foreground"
                          />
                        )}
                      </Pressable>
                    )}
                    ListEmptyComponent={() => (
                      <View className="flex items-center justify-center py-8">
                        <Text className="text-sm text-muted-foreground">
                          {search.trim().length < minSearchLength
                            ? `Type at least ${minSearchLength} characters to search`
                            : emptyText}
                        </Text>
                      </View>
                    )}
                    ListFooterComponent={() =>
                      hasMore ? (
                        <View className="flex items-center py-2">
                          <Text className="text-xs text-muted-foreground">
                            Showing {displayedOptions.length} of{' '}
                            {filteredOptions.length}
                          </Text>
                        </View>
                      ) : null
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    keyboardShouldPersistTaps="handled"
                    removeClippedSubviews
                    maxToRenderPerBatch={pageSize}
                    initialNumToRender={pageSize}
                    windowSize={5}
                    nestedScrollEnabled
                  />
                </View>
              </View>
            </MotiView>
          </Animated.View>
        )}

        {/* Backdrop */}
        {isOpen && (
          <Pressable
            onPress={handleClose}
            className="absolute inset-0 -z-10"
            style={{
              top: -1000,
              bottom: -1000,
              left: -1000,
              right: -1000
            }}
          />
        )}
      </View>
    );
  }
);

Combobox.displayName = 'Combobox';
