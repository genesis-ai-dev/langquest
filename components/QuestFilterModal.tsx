import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Quest } from '@/types/quest';

interface QuestFilterModalProps {
  onClose: () => void;
  quests: Quest[];
  onApplyFilters: (filters: Record<string, string[]>) => void;
  initialFilters: Record<string, string[]>;
}

export const QuestFilterModal: React.FC<QuestFilterModalProps> = ({ onClose, quests, onApplyFilters, initialFilters }) => {
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(initialFilters);

  const filterData = useMemo(() => {
    const sections: Record<string, Set<string>> = {};
    
    quests.forEach(quest => {
      quest.tags.forEach(tag => {
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
  }, [quests]);

  useEffect(() => {
    setSelectedOptions(initialFilters);
  }, [initialFilters]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
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

  const handleApply = () => {
    onApplyFilters(selectedOptions);
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Filter Quests</Text>
        <ScrollView style={styles.content}>
          {filterData.map((section) => (
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
                  <View style={styles.checkboxContainer}>
                    {selectedOptions[section.id]?.includes(option.id) ? (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    ) : (
                      <View style={styles.emptyCheckbox} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
    marginBottom: spacing.medium,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '80%',
    maxHeight: '80%',
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium,
  },
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
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.large,
  },
  applyButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
  },
});