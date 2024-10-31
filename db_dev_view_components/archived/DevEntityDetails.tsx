import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, Alert, ScrollView } from 'react-native';
import { colors, spacing, sharedStyles } from '@/styles/theme';
import { CustomDropdown } from '@/components/CustomDropdown';
import { DevEntityProps, DevFormField } from './DevTypes';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { useVersionManagement } from './useVersionManagement';
import { DevVersionControls } from '../DevVersionControls';
import { DevRelationList } from './DevRelationList';

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
            value={formData[field.key as keyof T] as string}  // Remove the password check
            onChangeText={(text) => setFormData({ ...formData, [field.key]: text })}
            placeholder={field.type === 'password' ? 'Leave blank to keep existing' : field.placeholder}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={field.type === 'password'}
          />
        );
      
        case 'dropdown':
          const options = dropdownOptions[field.key] || [];
          const currentValue = formData[field.key as keyof T];
          const selectedOption = options.find(opt => field.getOptionValue?.(opt) === currentValue);
          const displayValue = selectedOption ? field.getOptionLabel?.(selectedOption) || '' : '';
          
          return (
            <CustomDropdown
              key={field.key}
              label={field.label}
              value={displayValue}  // Now guaranteed to be a string
              options={options.map(opt => field.getOptionLabel?.(opt) || '')}
              onSelect={(selected) => {
                const option = options.find(opt => field.getOptionLabel?.(opt) === selected);
                if (option) {
                  const value = field.getOptionValue?.(option);
                  console.log(`Setting ${field.key} to:`, value);
                  setFormData({ ...formData, [field.key]: value });
                }
              }}
              containerStyle={{ marginBottom: 16 }}
            />
          );
      
        case 'switch':
          const boolValue = typeof formData[field.key as keyof T] === 'number' 
            ? (formData[field.key as keyof T] as number) === 1 
            : Boolean(formData[field.key as keyof T]);
          
          return (
            <View key={field.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: colors.text }}>{field.label}</Text>
              <Switch
                value={boolValue}
                onValueChange={(value) => setFormData({ ...formData, [field.key]: value })}
                style={{ marginLeft: 8 }}
              />
            </View>
          );

        case 'relationList':
          return (
            <DevRelationList
              key={field.key}
              field={field}
              entityId={entity.id || ''}
              editing={editing || isNew || isAddingVersion}
              onUpdate={(selectedIds) => {
                setFormData({ ...formData, [field.key]: selectedIds });
              }}
            />
          );
    }
  };

  const prepareFormDataForSave = (data: Partial<T>) => {
    const prepared = { ...data };
    fields.forEach(field => {
      if (field.type === 'switch') {
        const currentValue = prepared[field.key as keyof T];
        if (typeof currentValue === 'boolean') {
          prepared[field.key as keyof T] = (currentValue ? 1 : 0) as any;
        }
      }
      if (field.type === 'password') {
        const passwordValue = prepared[field.key as keyof T] as string;
        if (!passwordValue || passwordValue.trim() === '') {
          // Remove empty password field to keep existing password
          delete prepared[field.key as keyof T];
          console.log('Keeping existing password');
        } else {
          console.log('New password will be saved');
        }
      }
    });
    return prepared;
  };

  return (
    <View style={sharedStyles.modalOverlay}>
      <View style={[sharedStyles.modal]}>
        {/* Header */}
        <Text style={sharedStyles.modalTitle}>
          {isNew ? `New ${title}` : isAddingVersion ? 'Add Version' : editing ? 'Edit Version' : `${title} Details`}
        </Text>
  
        {/* Version Controls */}
        {!isNew && (
          <DevVersionControls
            versions={versions}
            currentIndex={currentVersionIndex}
            setCurrentIndex={setCurrentVersionIndex}
            disabled={editing || isAddingVersion}
          />
        )}
  
        {/* Scrollable Content */}
        <ScrollView 
          style={{ flexGrow: 0, maxHeight: '60%' }}
          contentContainerStyle={{ paddingBottom: spacing.medium }}
        >
          {(editing || isNew || isAddingVersion) ? (
            <>
              {fields.map(renderField)}
              {renderCustomFields?.()}
            </>
          ) : (
            <>
              {fields.map(field => (
                <Text key={field.key} style={{ color: colors.text, marginBottom: spacing.small }}>
                  {field.label}: {
                    field.type === 'dropdown' 
                      ? field.getOptionLabel?.(formData[field.key as keyof T]) 
                      : String(formData[field.key as keyof T] || 'N/A')
                  }
                </Text>
              ))}
              <Text style={{ color: colors.text, marginBottom: spacing.small }}>
                Version: {formData.versionNum || 1}
              </Text>
              <Text style={{ color: colors.text, marginBottom: spacing.small }}>
                Chain ID: {formData.versionChainId || 'N/A'}
              </Text>
            </>
          )}
        </ScrollView>
  
        {/* Footer Buttons */}
        <View style={{ marginTop: spacing.medium }}>
          {!isNew && !isAddingVersion && (
            <View style={{ flexDirection: 'row', gap: spacing.small }}>
              <TouchableOpacity 
                style={[sharedStyles.modalButton, { flex: 1, marginTop: 0 }]}
                onPress={() => setEditing(!editing)}
              >
                <Text style={sharedStyles.modalButtonText}>
                  {editing ? 'Cancel' : 'Edit Version'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[sharedStyles.modalButton, { flex: 1, marginTop: 0 }]}
                onPress={() => setIsAddingVersion(true)}
              >
                <Text style={sharedStyles.modalButtonText}>Add Version</Text>
              </TouchableOpacity>
            </View>
          )}
  
          {(editing || isNew || isAddingVersion) && (
            <TouchableOpacity
              style={[sharedStyles.modalButton, { marginTop: spacing.small }]}
              onPress={() => isAddingVersion 
                ? onAddVersion?.(prepareFormDataForSave(formData)) 
                : onSave(prepareFormDataForSave(formData))}
            >
              <Text style={sharedStyles.modalButtonText}>Save</Text>
            </TouchableOpacity>
          )}
  
          {!editing && !isNew && !isAddingVersion && (
            <TouchableOpacity
              style={[sharedStyles.modalButton, { backgroundColor: 'red', marginTop: spacing.small }]}
              onPress={handleDelete}
            >
              <Text style={sharedStyles.modalButtonText}>Delete Version</Text>
            </TouchableOpacity>
          )}
  
          <TouchableOpacity
            style={[sharedStyles.modalButton, { marginTop: spacing.small }]}
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