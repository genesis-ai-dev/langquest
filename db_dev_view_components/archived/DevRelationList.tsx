import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { colors, sharedStyles } from '@/styles/theme';
import { CustomDropdown } from '@/components/CustomDropdown';
import { DevFormField } from './DevTypes';

interface DevRelationListProps {
  field: DevFormField;
  entityId: string;
  editing: boolean;
  onUpdate: (selectedIds: string[]) => void;
}

interface RelatedItem {
    id: string;
    [key: string]: any; // For dynamic fields like foreignKey and displayField
  }

export function DevRelationList({ field, entityId, editing, onUpdate }: DevRelationListProps) {
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [availableItems, setAvailableItems] = useState<RelatedItem[]>([]);

  useEffect(() => {
    loadData();
  }, [entityId]);

  const loadData = async () => {
    if (!field.relationConfig) return;
    
    const { repository, foreignKey } = field.relationConfig;
    
    // Load all available items for the dropdown
    const allItems = await repository.getLatestOfAll();
    setAvailableItems(allItems);
    
    // For languages -> users relationship
    if (entityId && repository.getRelatedUsers) {
      console.log('Loading related users for language:', entityId);
      const related = await repository.getRelatedUsers(entityId);
      console.log('Found related users:', related);
      setRelatedItems(related);
    }
  };

  if (!editing) {
    return (
      <View style={{ marginVertical: 8 }}>
        <Text style={{ color: colors.text }}>{field.label}:</Text>
        <ScrollView style={{ maxHeight: 100, marginTop: 4 }}>
          {relatedItems.map(item => (
            <Text key={item.id} style={{ color: colors.text }}>
              {item[field.relationConfig?.displayField || 'id']}
            </Text>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={{ color: colors.text }}>{field.label}:</Text>
      <CustomDropdown
        label="Add Item"
        value=""  // Empty string is valid
        options={availableItems
            .filter(item => !relatedItems.find(ri => ri.id === item.id))
            .map(item => item[field.relationConfig?.displayField || 'id'] || '')}  // Ensure string values
        onSelect={(selected) => {
            const item = availableItems.find(
            i => i[field.relationConfig?.displayField || 'id'] === selected
            );
            if (item) {
            const newItems = [...relatedItems, item];
            setRelatedItems(newItems);
            onUpdate(newItems.map(i => i.id));
            }
        }}
      />
      <ScrollView style={{ maxHeight: 100, marginTop: 4 }}>
        {relatedItems.map(item => (
          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: colors.text, flex: 1 }}>
              {item[field.relationConfig?.displayField || 'id']}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const newItems = relatedItems.filter(i => i.id !== item.id);
                setRelatedItems(newItems);
                onUpdate(newItems.map(i => i.id));
              }}
            >
              <Text style={{ color: 'red' }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}