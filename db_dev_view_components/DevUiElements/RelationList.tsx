import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  FlatList,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { VersionedEntity } from '@/database_components/VersionedRepository';

interface RelationListProps<T extends VersionedEntity> {
  value: string[];
  onChange: (value: string[]) => void;
  relationConfig: {
    repository: any;
    foreignKey: string;
    displayField: keyof T;
  };
  error?: string | null;
}

export function RelationList<T extends VersionedEntity>({
  value = [],
  onChange,
  relationConfig,
  error
}: RelationListProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [allOptions, setAllOptions] = useState<T[]>([]);
  const [selectedItems, setSelectedItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to safely convert field value to string
  const getDisplayValue = (item: T): string => {
    const value = item[relationConfig.displayField];
    return String(value ?? '');
  };

  // Load options only once when component mounts
  useEffect(() => {
    const loadOptions = async () => {
      setIsLoading(true);
      try {
        const items = await relationConfig.repository.getLatestOfAll();
        setAllOptions(items);
      } catch (error) {
        console.error('Error loading relation options:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadOptions();
  }, [relationConfig.repository]);

  // Update selected items when value or options change
  // useEffect(() => {
  //   const items = allOptions.filter(item => value.includes(item.id));
  //   setSelectedItems(items);
  // }, [value, allOptions]);

  const toggleItem = (item: VersionedEntity) => {
    const newValue = value.includes(item.id)
      ? value.filter(id => id !== item.id)
      : [...value, item.id];
    onChange(newValue);
  };

  const renderItem = ({ item }: { item: T }) => {
    const isSelected = value.includes(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.item,
          isSelected && styles.selectedItem
        ]}
        onPress={() => toggleItem(item)}
      >
        <Text style={[
          styles.itemText,
          isSelected && styles.selectedItemText
        ]}>
          {getDisplayValue(item)}
        </Text>
        {isSelected && (
          <Ionicons 
            name="checkmark" 
            size={20} 
            color={colors.buttonText} 
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View>
      {/* Selected Items Display */}
      <View style={[
        styles.container,
        error ? styles.containerError : undefined
      ]}>
        {selectedItems.length === 0 ? (
          <Text style={styles.placeholder}>None selected</Text>
        ) : (
          <View style={styles.chipContainer}>
            {selectedItems.map(item => (
              <View key={item.id} style={styles.chip}>
                <Text style={styles.chipText}>
                {getDisplayValue(item)}
                </Text>
                <TouchableOpacity
                  onPress={() => toggleItem(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons 
                    name="close-circle" 
                    size={18} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity onPress={() => setIsOpen(true)}>
          <Ionicons 
            name="pencil" 
            size={20} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      {/* Selection Modal */}
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Items</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={colors.text} 
                />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <FlatList
                data={allOptions}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                style={styles.list}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...sharedStyles.input,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.small
  },
  containerError: {
    borderColor: 'red'
  },
  placeholder: {
    color: colors.textSecondary,
    fontSize: 16
  },
  chipContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: spacing.xsmall
  },
  chipText: {
    color: colors.text,
    fontSize: 14
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600'
  },
  list: {
    flex: 1
  },
  listContent: {
    padding: spacing.small
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    borderRadius: 8,
    marginVertical: spacing.xsmall
  },
  selectedItem: {
    backgroundColor: colors.primary
  },
  itemText: {
    color: colors.text,
    fontSize: 16
  },
  selectedItemText: {
    color: colors.buttonText,
    fontWeight: '500'
  }
});