import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { languageRepository, userRepository } from '@/database_components/repositories';

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  entityId?: string;
  source?: string;
  linkedEntity?: {
    repository: any;
    displayField: string;
  };
}

export function Dropdown({ 
  value, 
  onChange, 
  source, 
  linkedEntity,
  entityId,  // Add this
  error 
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<any[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>('');

  const buttonStyle: StyleProp<ViewStyle> = [
    styles.dropdownButton,
    error ? styles.dropdownError : undefined
  ];

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      let items: any[] = [];
      switch (source) {
        case 'languages':
          items = await languageRepository.getLatestOfAll();
          break;
        case 'users':
          items = await userRepository.getLatestOfAll();
          break;
      }
      setOptions(items);
      
      // Set initial selected label
      if (value) {
        const selected = items.find(item => item.id === value);
        if (selected) {
          setSelectedLabel(getOptionLabel(selected));
        }
      }
    } catch (error) {
      console.error('Error loading dropdown options:', error);
    }
  };

  const getOptionLabel = (option: any): string => {
    if (!linkedEntity) return String(option);
    return String(option[linkedEntity.displayField] || '');
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        style={buttonStyle}
      >
        <Text style={styles.dropdownButtonText}>
          {selectedLabel || 'Select...'}
        </Text>
        <Ionicons 
          name="chevron-down" 
          size={24} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <FlatList
              data={options}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onChange(item.id);
                    setSelectedLabel(getOptionLabel(item));
                    setIsOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>
                    {getOptionLabel(item)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownButton: {
    ...sharedStyles.input,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48
  },
  dropdownError: {
    borderColor: 'red'
  },
  dropdownButtonText: {
    color: colors.text,
    fontSize: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 8,
    width: '80%',
    maxHeight: '80%'
  },
  option: {
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary
  },
  optionText: {
    color: colors.text,
    fontSize: 16
  }
});