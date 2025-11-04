import { CustomDropdown } from '@/components/CustomDropdown';
import {
  useInfiniteTagsByQuestIdAndCategory,
  useTagCategoriesByQuestId
} from '@/hooks/db/useTags';
import { useLocalization } from '@/hooks/useLocalization';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

interface AssetFilterModalProps {
  onClose: () => void;
  questId: string;
  onApplyFilters: (filters: Record<string, string[]>) => void;
  onApplySorting: (sorting: SortingOption[]) => void;
  initialFilters: Record<string, string[]>;
  initialSorting: SortingOption[];
}

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

// Component for each category section with its own infinite loading
const CategorySection: React.FC<{
  category: string;
  questId: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedOptions: string[];
  onToggleOption: (optionId: string) => void;
}> = ({
  category,
  questId,
  isExpanded,
  onToggle,
  selectedOptions,
  onToggleOption
}) => {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteTagsByQuestIdAndCategory(questId, category);

  const tags = data.pages.flatMap((page) => page.data);
  const { t } = useLocalization();

  // Process tags to extract options
  const options = useMemo(() => {
    return tags
      .map((tag) => {
        const option = tag.value;
        return {
          id: `${category.toLowerCase()}:${option.toLowerCase()}`,
          label: option || ''
        };
      })
      .filter((option) => option.label)
      .sort((a, b) => {
        // Check if both values can be parsed as numbers
        const numA = parseInt(a.label, 10);
        const numB = parseInt(b.label, 10);

        if (!isNaN(numA) && !isNaN(numB)) {
          // Numeric sort
          return numA - numB;
        } else {
          // Alphabetical sort
          return a.label.localeCompare(b.label);
        }
      });
  }, [tags, category]);

  return (
    <View>
      <TouchableOpacity style={styles.heading} onPress={onToggle}>
        <Text style={styles.headingText}>{category}</Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.text}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.option}
              onPress={() => onToggleOption(option.id)}
            >
              <Text style={styles.optionText}>{option.label}</Text>
              <View style={sharedStyles.checkboxContainer}>
                {selectedOptions.includes(option.id) ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.primary}
                  />
                ) : (
                  <View style={styles.emptyCheckbox} />
                )}
              </View>
            </TouchableOpacity>
          ))}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading options...</Text>
            </View>
          )}
          {hasNextPage && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              <Text style={styles.loadMoreText}>
                {isFetchingNextPage ? t('loading') : t('loadMore')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export const AssetFilterModal: React.FC<AssetFilterModalProps> = ({
  onClose,
  questId,
  onApplyFilters,
  onApplySorting,
  initialFilters,
  initialSorting
}) => {
  const { t } = useLocalization();
  const [activeTab, setActiveTab] = useState<'filter' | 'sort'>('filter');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] =
    useState<Record<string, string[]>>(initialFilters);
  const [sortingOptions, setSortingOptions] =
    useState<SortingOption[]>(initialSorting);

  // Fetch tag categories for headers
  const { tagCategories, isTagCategoriesLoading } =
    useTagCategoriesByQuestId(questId);

  // Create filter sections from tag categories
  const categories = useMemo(() => {
    return tagCategories?.tag_categories || [];
  }, [tagCategories?.tag_categories]);

  // Create sorting fields from categories
  const sortingFields = useMemo(() => {
    const fields = new Set(['name']);
    categories.forEach((category) => {
      fields.add(category);
    });
    return Array.from(fields);
  }, [categories]);

  useEffect(() => {
    setSelectedOptions(initialFilters);
    setSortingOptions(initialSorting);
  }, [initialFilters, initialSorting]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getActiveFiltersCount = () => {
    return Object.values(selectedOptions).flat().length;
  };

  const getActiveSortingCount = () => {
    return sortingOptions.length;
  };

  const toggleOption = (sectionId: string, optionId: string) => {
    setSelectedOptions((prev) => {
      const updatedSection = prev[sectionId] ?? [];
      const updatedOptions = updatedSection.includes(optionId)
        ? updatedSection.filter((id) => id !== optionId)
        : [...updatedSection, optionId];

      return {
        ...prev,
        [sectionId]: updatedOptions
      };
    });
  };

  const handleSortingChange = (
    index: number,
    field: string | null,
    order?: 'asc' | 'desc'
  ) => {
    setSortingOptions((prev) => {
      const newOptions = [...prev];
      if (field) {
        newOptions[index] = { field, order: order ?? 'asc' };
      } else {
        newOptions.splice(index, 1);
      }
      return newOptions.filter((option) => option.field);
    });
  };

  const handleApply = () => {
    onApplyFilters(selectedOptions);
    onApplySorting(sortingOptions);
    onClose();
  };

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={sharedStyles.modalOverlay}>
        <TouchableWithoutFeedback>
          <View style={sharedStyles.modal}>
            <Text style={sharedStyles.modalTitle}>Asset Options</Text>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'filter' && styles.activeTab]}
                onPress={() => setActiveTab('filter')}
              >
                <View style={styles.tabIconContainer}>
                  <Ionicons
                    name="filter"
                    size={24}
                    color={
                      activeTab === 'filter' ? colors.primary : colors.text
                    }
                  />
                  {getActiveFiltersCount() > 0 && (
                    <View style={sharedStyles.badge}>
                      <Text style={sharedStyles.badgeText}>
                        {getActiveFiltersCount()}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'sort' && styles.activeTab]}
                onPress={() => setActiveTab('sort')}
              >
                <View style={styles.tabIconContainer}>
                  <Ionicons
                    name="swap-vertical"
                    size={24}
                    color={activeTab === 'sort' ? colors.primary : colors.text}
                  />
                  {getActiveSortingCount() > 0 && (
                    <View style={sharedStyles.badge}>
                      <Text style={sharedStyles.badgeText}>
                        {getActiveSortingCount()}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
            <ScrollView style={sharedStyles.modalContent}>
              {isTagCategoriesLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>
                    Loading tag categories...
                  </Text>
                </View>
              ) : activeTab === 'filter' ? (
                categories.map((category) => (
                  <CategorySection
                    key={category}
                    category={category}
                    questId={questId}
                    isExpanded={expandedSections.includes(
                      category.toLowerCase()
                    )}
                    onToggle={() => toggleSection(category.toLowerCase())}
                    selectedOptions={
                      selectedOptions[category.toLowerCase()] || []
                    }
                    onToggleOption={(optionId) =>
                      toggleOption(category.toLowerCase(), optionId)
                    }
                  />
                ))
              ) : (
                // Sorting content
                [0, 1, 2].map((index) => (
                  <View key={index} style={styles.sortingRow}>
                    <CustomDropdown
                      label={`Sort ${index + 1}`}
                      value={sortingOptions[index]?.field ?? ''}
                      options={sortingFields}
                      onSelect={(field) =>
                        handleSortingChange(
                          index,
                          field,
                          sortingOptions[index]?.order
                        )
                      }
                      fullWidth={false}
                      search={false}
                    />
                    <TouchableOpacity
                      style={styles.orderToggle}
                      onPress={() =>
                        handleSortingChange(
                          index,
                          sortingOptions[index]?.field ?? null,
                          sortingOptions[index]?.order === 'asc'
                            ? 'desc'
                            : 'asc'
                        )
                      }
                    >
                      <Ionicons
                        name={
                          sortingOptions[index]?.order === 'asc'
                            ? 'arrow-up'
                            : 'arrow-down'
                        }
                        size={24}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                    {sortingOptions[index]?.field && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleSortingChange(index, null)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={24}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={sharedStyles.modalButton}
              onPress={handleApply}
            >
              <Text style={sharedStyles.modalButtonText}>{t('apply')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  headingText: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium
  },
  optionText: {
    fontSize: fontSizes.small,
    color: colors.text
  },
  emptyCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: 10
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary
  },
  tabText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  sortingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.medium
  },
  orderToggle: {
    marginLeft: spacing.small,
    padding: spacing.small,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.small
  },
  removeButton: {
    marginLeft: spacing.small,
    padding: spacing.small
  },
  tabIconContainer: {
    position: 'relative'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large
  },
  loadingText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  loadMoreButton: {
    padding: spacing.medium,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.inputBorder
  },
  loadMoreText: {
    fontSize: fontSizes.small,
    color: colors.primary
  }
});
