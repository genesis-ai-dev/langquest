import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { colors, sharedStyles } from '@/styles/theme';
import { CustomDropdown } from '@/components/CustomDropdown';
import { DevEntityProps, DevFormField } from './DevTypes';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { useVersionManagement } from './useVersionManagement';
import { DevVersionControls } from './DevVersionControls';

interface DevEntityDetailsProps<T extends VersionedEntity> extends DevEntityProps<T> {
  repository: any;
  fields: DevFormField[];
  title: string;
  dropdownOptions?: Record<string, any[]>;
  onSave: (formData: Partial<T>) => Promise<void>;
  onAddVersion?: (formData: Partial<T>) => Promise<void>;
  renderCustomFields?: () => React.ReactNode;
}

export function DevEntityDetails<T extends VersionedEntity>({
  entity,
  repository,
  fields,
  title,
  dropdownOptions = {},
  onClose,
  onUpdate,
  isNew = false,
  onSave,
  onAddVersion,
  renderCustomFields
}: DevEntityDetailsProps<T>) {
  const {
    editing,
    setEditing,
    formData,
    setFormData,
    versions,
    currentVersionIndex,
    setCurrentVersionIndex,
    isAddingVersion,
    setIsAddingVersion
  } = useVersionManagement(repository, entity, isNew);

  const handleDelete = async () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this version?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete version',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!entity.id) throw new Error('Entity ID required for deletion');
              await repository.delete(entity.id);
              Alert.alert('Success', 'Version deleted successfully');
              onUpdate();
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete version');
            }
          }
        }
      ]
    );
  };

  const renderField = (field: DevFormField) => {
    switch (field.type) {
      case 'text':
      case 'password':
        return (
          <TextInput
            key={field.key}
            style={sharedStyles.input}
            value={formData[field.key as keyof T] as string}
            onChangeText={(text) => setFormData({ ...formData, [field.key]: text })}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={field.type === 'password'}
          />
        );
      
      case 'dropdown':
        const options = dropdownOptions[field.key] || [];
        return (
          <CustomDropdown
            key={field.key}
            label={field.label}
            value={field.getOptionLabel?.(formData[field.key as keyof T]) || ''}
            options={options.map(opt => field.getOptionLabel?.(opt) || '')}
            onSelect={(selected) => {
              const option = options.find(opt => field.getOptionLabel?.(opt) === selected);
              if (option) {
                setFormData({ ...formData, [field.key]: field.getOptionValue?.(option) });
              }
            }}
            containerStyle={{ marginBottom: 16 }}
          />
        );
      
      case 'switch':
        return (
          <View key={field.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.text }}>{field.label}</Text>
            <Switch
              value={formData[field.key as keyof T] as boolean}
              onValueChange={(value) => setFormData({ ...formData, [field.key]: value })}
              style={{ marginLeft: 8 }}
            />
          </View>
        );
    }
  };

  return (
    <View style={sharedStyles.modalOverlay}>
      <View style={sharedStyles.modal}>
        <Text style={sharedStyles.modalTitle}>
          {isNew ? `New ${title}` : isAddingVersion ? 'Add Version' : editing ? 'Edit Version' : `${title} Details`}
        </Text>

        {!isNew && (
          <DevVersionControls
            versions={versions}
            currentIndex={currentVersionIndex}
            setCurrentIndex={setCurrentVersionIndex}
          />
        )}

        {(editing || isNew || isAddingVersion) ? (
          <View style={sharedStyles.modalContent}>
            {fields.map(renderField)}
            {renderCustomFields?.()}
          </View>
        ) : (
          <View style={sharedStyles.modalContent}>
            {fields.map(field => (
              <Text key={field.key} style={{ color: colors.text }}>
                {field.label}: {
                  field.type === 'dropdown' 
                    ? field.getOptionLabel?.(formData[field.key as keyof T]) 
                    : String(formData[field.key as keyof T] || 'N/A')
                }
              </Text>
            ))}
            <Text style={{ color: colors.text }}>Version: {formData.versionNum || 1}</Text>
            <Text style={{ color: colors.text }}>Chain ID: {formData.versionChainId || 'N/A'}</Text>
          </View>
        )}

        <View style={{ gap: 10 }}>
          {!isNew && !isAddingVersion && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[sharedStyles.modalButton, { backgroundColor: colors.primary, flex: 1, marginRight: 5 }]}
                onPress={() => setEditing(!editing)}
              >
                <Text style={sharedStyles.modalButtonText}>
                  {editing ? 'Cancel' : 'Edit Version'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[sharedStyles.modalButton, { backgroundColor: colors.primary, flex: 1, marginLeft: 5 }]}
                onPress={() => setIsAddingVersion(true)}
              >
                <Text style={sharedStyles.modalButtonText}>Add Version</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {(editing || isNew || isAddingVersion) ? (
              <TouchableOpacity
                style={[sharedStyles.modalButton, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => isAddingVersion ? onAddVersion?.(formData) : onSave(formData)}
              >
                <Text style={sharedStyles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[sharedStyles.modalButton, { backgroundColor: 'red', flex: 1 }]}
                onPress={handleDelete}
              >
                <Text style={sharedStyles.modalButtonText}>Delete Version</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[sharedStyles.modalButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setIsAddingVersion(false);
              setEditing(false);
              onClose();
            }}
          >
            <Text style={sharedStyles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}