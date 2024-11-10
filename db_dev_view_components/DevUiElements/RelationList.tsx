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
import { FieldPath } from '@/db_dev_view_components/DevTypes';

interface RelationListProps {
  entityId: string;
  value: string[];
  onChange: (value: string[]) => void;
  fieldPath: FieldPath;
  error?: string | null;
}


export function RelationList({
  entityId,
  value = [],
  onChange,
  fieldPath,
  error
}: RelationListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [allOptions, setAllOptions] = useState<T[]>([]);
  const [relatedItems, setRelatedItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);


  // Load both all possible options and current relations
  useEffect(() => {
    const loadData = async () => {
      if (!fieldPath.through?.repository || !fieldPath.through.relationship) {
        console.error('Invalid field configuration for RelationList');
        return;
      }

      setIsLoading(true);
      try {
        // Load all possible options
        const options = await fieldPath.through.repository.getLatestOfAll();
        setAllOptions(options as T[]);

        // Load current relations if we have an entityId
        if (entityId) {
          const related = await fieldPath.through.repository.getRelated<T>(
            entityId, 
            fieldPath.through.relationship.relationName
          );
          setRelatedItems(related);
        }
      } catch (error) {
        console.error('Error loading relation data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [entityId, fieldPath]);

  const getDisplayValue = (item: T): string => {
    if (!fieldPath.through?.displayField) return String(item.id);
    const value = item[fieldPath.through.displayField as keyof T];
    return String(value ?? '');
  };


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
        {relatedItems.length === 0 ? (
          <Text style={styles.placeholder}>None selected</Text>
        ) : (
          <View style={styles.chipContainer}>
            {relatedItems.map(item => (
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