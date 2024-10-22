import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { colors, fontSizes, spacing, borderRadius, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from '@/types/asset';
import { CustomDropdown } from '@/components/CustomDropdown';

interface AssetFilterModalProps {
  visible: boolean;
  onClose: () => void;
  assets: Asset[];
  onApplyFilters: (filters: Record<string, string[]>) => void;
  onApplySorting: (sorting: SortingOption[]) => void;
  initialFilters: Record<string, string[]>;
  initialSorting: SortingOption[];
}

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

export const AssetFilterModal: React.FC<AssetFilterModalProps> = ({
  visible,
  onClose,
  assets,
  onApplyFilters,
  onApplySorting,
  initialFilters,
  initialSorting,
}) => {
  const [activeTab, setActiveTab] = useState<'filter' | 'sort'>('filter');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(initialFilters);
  const [sortingOptions, setSortingOptions] = useState<SortingOption[]>(initialSorting);

  const filterData = useMemo(() => {
    const sections: Record<string, Set<string>> = {};
    
    assets.forEach(asset => {
      asset.tags.forEach(tag => {
        const [heading, option] = tag.split(':');
        if (!sections[heading]) {
          sections[heading] = new Set();
        }
        sections[heading].add(option);
      });
    });

    return Object.entries(sections).map(([heading, options]) => ({
      id: heading.toLowerCase(),
      heading,
      options: Array.from(options).map(option => ({
        id: `${heading.toLowerCase()}:${option.toLowerCase()}`,
        label: option
      }))
    }));
  }, [assets]);

  const sortingFields = useMemo(() => {
    return ['title', 'fileType', ...new Set(assets.flatMap(asset => asset.tags.map(tag => tag.split(':')[0])))];
  }, [assets]);

  useEffect(() => {
    setSelectedOptions(initialFilters);
    setSortingOptions(initialSorting);
  }, [initialFilters, initialSorting]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
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
    setSelectedOptions(prev => {
      const updatedSection = prev[sectionId] || [];
      const updatedOptions = updatedSection.includes(optionId)
        ? updatedSection.filter(id => id !== optionId)
        : [...updatedSection, optionId];
      
      return {
        ...prev,
        [sectionId]: updatedOptions
      };
    });
  };

  const handleSortingChange = (index: number, field: string | null, order: 'asc' | 'desc') => {
    setSortingOptions(prev => {
      const newOptions = [...prev];
      if (field) {
        newOptions[index] = { field, order: order || 'asc' };
      } else {
        newOptions.splice(index, 1);
      }
      return newOptions.filter(option => option.field);
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
                  <Ionicons name="filter" size={24} color={activeTab === 'filter' ? colors.primary : colors.text} />
                  {getActiveFiltersCount() > 0 && (
                    <View style={sharedStyles.badge}>
                      <Text style={sharedStyles.badgeText}>{getActiveFiltersCount()}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'sort' && styles.activeTab]}
                onPress={() => setActiveTab('sort')}
              >
                <View style={styles.tabIconContainer}>
                  <Ionicons name="swap-vertical" size={24} color={activeTab === 'sort' ? colors.primary : colors.text} />
                  {getActiveSortingCount() > 0 && (
                    <View style={sharedStyles.badge}>
                      <Text style={sharedStyles.badgeText}>{getActiveSortingCount()}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
            <ScrollView style={sharedStyles.modalContent}>
              {activeTab === 'filter' ? (
                filterData.map((section) => (
                  <View key={section.id}>
                    <TouchableOpacity 
                      style={styles.heading}
                      onPress={() => toggleSection(section.id)}
                    >
                      <Text style={styles.headingText}>{section.heading}</Text>
                      <Ionicons 
                        name={expandedSections.includes(section.id) ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color={colors.text} 
                      />
                    </TouchableOpacity>
                    
                    {expandedSections.includes(section.id) && section.options.map((option) => (
                      <TouchableOpacity 
                        key={option.id}
                        style={styles.option} 
                        onPress={() => toggleOption(section.id, option.id)}
                      >
                        <Text style={styles.optionText}>{option.label}</Text>
                        <View style={sharedStyles.checkboxContainer}>
                          {selectedOptions[section.id]?.includes(option.id) ? (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                          ) : (
                            <View style={styles.emptyCheckbox} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              ) : (
                // Sorting content
                [0, 1, 2].map((index) => (
                  <View key={index} style={styles.sortingRow}>
                    <CustomDropdown
                      label={`Sort ${index + 1}`}
                      value={sortingOptions[index]?.field || ''}
                      options={sortingFields}
                      onSelect={(field) => handleSortingChange(index, field, sortingOptions[index]?.order || 'asc')}
                      fullWidth={false}
                      search={false}
                    />
                    <TouchableOpacity
                      style={styles.orderToggle}
                      onPress={() => handleSortingChange(index, sortingOptions[index]?.field, sortingOptions[index]?.order === 'asc' ? 'desc' : 'asc')}
                    >
                      <Ionicons
                        name={sortingOptions[index]?.order === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={24}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={sharedStyles.modalButton} onPress={handleApply}>
              <Text style={sharedStyles.modalButtonText}>Apply</Text>
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
    borderBottomColor: colors.inputBorder,
  },
  headingText: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  optionText: {
    fontSize: fontSizes.small,
    color: colors.text,
  },
  emptyCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: fontSizes.medium,
    color: colors.text,
  },
  sortingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  orderToggle: {
    marginLeft: spacing.small,
    padding: spacing.small,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.small,
  },
  tabIconContainer: {
    position: 'relative',
  },
});