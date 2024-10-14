import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';

interface QuestFilterModalProps {
  onClose: () => void;
}

interface FilterOption {
  id: string;
  label: string;
}

interface FilterSection {
  id: string;
  heading: string;
  options: FilterOption[];
}

const filterData: FilterSection[] = [
  {
    id: 'book',
    heading: 'Book',
    options: [
      { id: 'genesis', label: 'Genesis' },
      { id: 'exodus', label: 'Exodus' },
    ],
  },
  {
    id: 'chapter',
    heading: 'Chapter',
    options: [
      { id: 'chapter1', label: 'Chapter 1' },
      { id: 'chapter2', label: 'Chapter 2' },
    ],
  },
];

export const QuestFilterModal: React.FC<QuestFilterModalProps> = ({ onClose }) => {
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const toggleOption = (optionId: string) => {
    setSelectedOptions(prev =>
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
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
                  onPress={() => toggleOption(option.id)}
                >
                  <Text style={styles.optionText}>{option.label}</Text>
                  <View style={styles.checkboxContainer}>
                    {selectedOptions.includes(option.id) ? (
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
        <TouchableOpacity style={styles.applyButton} onPress={onClose}>
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