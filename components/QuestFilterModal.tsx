import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';

interface QuestFilterModalProps {
  onClose: () => void;
  onApplyFilters: (filters: any) => void; // Replace 'any' with a proper filter type when defined
}

export const QuestFilterModal: React.FC<QuestFilterModalProps> = ({ onClose, onApplyFilters }) => {
  // Placeholder for filter options
  const applyFilters = () => {
    // Logic to apply filters
    onApplyFilters({});
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={styles.modal}>
        <Text style={styles.title}>Filter & Sort</Text>
        {/* Add filter and sort options here */}
        <Text style={styles.optionText}>Filter and sort options will go here</Text>
        <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
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
  closeArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '80%',
    maxHeight: '80%',
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium,
  },
  optionText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.medium,
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