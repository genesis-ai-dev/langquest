import { CustomDropdown } from '@/components/CustomDropdown';
import type { Asset } from '@/database_services/assetService';
import type { Tag } from '@/database_services/tagService';
import { useLocalization } from '@/hooks/useLocalization';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

interface AssetFilterModalProps {
  visible: boolean;
  onClose: () => void;
  assets: (Asset & { tags: { tag: Tag }[] })[];
  onApplyFilters: (filters: Record<string, string[]>) => void;
  onApplySorting: (sorting: SortingOption[]) => void;
  initialFilters: Record<string, string[]>;
  initialSorting: SortingOption[];
}

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

interface FilterListItem {
  type: 'filter_section';
  section: {
    id: string;
    heading: string;
    options: { id: string; label: string }[];
  };
}

interface SortingListItem {
  type: 'sorting_row';
  index: number;
}

type ListItem = FilterListItem | SortingListItem;

export const AssetFilterModal: React.FC<AssetFilterModalProps> = ({
  onClose,
  assets,
  onApplyFilters,
  onApplySorting,
  initialFilters,
  initialSorting
}) => {
  const [activeTab, setActiveTab] = useState<'filter' | 'sort'>('filter');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] =
    useState<Record<string, string[]>>(initialFilters);
  const [sortingOptions, setSortingOptions] =
    useState<SortingOption[]>(initialSorting);

  const { t } = useLocalization();

  const tags = assets.flatMap((asset) => asset.tags.map((tag) => tag.tag));

  const filterData = useMemo(() => {
    const sections: Record<string, Set<string>> = {};

    tags.forEach((tag) => {
      const [heading, option] = tag.name.split(':');
      if (!heading) return;
      sections[heading] ??= new Set();
      if (option) sections[heading]!.add(option);
    });

    return Object.entries(sections).map(([heading, options]) => {
      // Convert options to array and sort them properly
      const sortedOptions = Array.from(options).sort((a, b) => {
        // Check if both values can be parsed as numbers
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);

        if (!isNaN(numA) && !isNaN(numB)) {
          // Numeric sort
          return numA - numB;
        } else {
          // Alphabetical sort
          return a.localeCompare(b);
        }
      });

      return {
        id: heading.toLowerCase(),
        heading,
        options: sortedOptions.map((option) => ({
          id: `${heading.toLowerCase()}:${option.toLowerCase()}`,
          label: option
        }))
      };
    });
  }, [assets]);

  const sortingFields = useMemo(() => {
    const fields = new Set(['name']);
    tags.forEach((tag) => {
      const category = tag.name.split(':')[0];
      if (category) fields.add(category);
    });
    return Array.from(fields);
  }, [tags]);

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

  const listData = useMemo((): ListItem[] => {
    if (activeTab === 'filter') {
      return filterData.map((section) => ({
        type: 'filter_section',
        section
      }));
    } else {
      return [0, 1, 2].map((index) => ({
        type: 'sorting_row',
        index
      }));
    }
  }, [activeTab, filterData]);

  const renderListItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'filter_section') {
      const { section } = item;
      return (
        <View>
          <TouchableOpacity
            style={styles.heading}
            onPress={() => toggleSection(section.id)}
          >
            <Text style={styles.headingText}>{section.heading}</Text>
            <Ionicons
              name={
                expandedSections.includes(section.id)
                  ? 'chevron-up'
                  : 'chevron-down'
              }
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          {expandedSections.includes(section.id) &&
            section.options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.option}
                onPress={() => toggleOption(section.id, option.id)}
              >
                <Text style={styles.optionText}>{option.label}</Text>
                <View style={sharedStyles.checkboxContainer}>
                  {selectedOptions[section.id]?.includes(option.id) ? (
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
        </View>
      );
    } else {
      const { index } = item;
      return (
        <View style={styles.sortingRow}>
          <CustomDropdown
            label={`Sort ${index + 1}`}
            value={sortingOptions[index]?.field ?? ''}
            options={sortingFields}
            onSelect={(field) =>
              handleSortingChange(index, field, sortingOptions[index]?.order)
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
                sortingOptions[index]?.order === 'asc' ? 'desc' : 'asc'
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
              <Ionicons name="trash-outline" size={24} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      );
    }
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
            <FlashList
              data={listData}
              renderItem={renderListItem}
              keyExtractor={(item, _index) =>
                item.type === 'filter_section'
                  ? item.section.id
                  : `sorting_${item.index}`
              }
              // style={sharedStyles.modalContent}
              showsVerticalScrollIndicator={false}
              estimatedItemSize={200}
            />
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
  }
});
