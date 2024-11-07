import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Modal,
  Alert 
} from 'react-native';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { DevEditProps } from './DevTypes';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { UiElements } from './DevUiElements';
import { FieldPath, isVirtualField } from '@/db_dev_view_components/DevTypes';

interface FormErrors {
  [key: string]: string | null;
}

export function DevEditView<T extends VersionedEntity>({ 
  entity, 
  config, 
  isNew = false,
  isAddingVersion = false,
  onSave, 
  onClose 
}: DevEditProps<T> & { isAddingVersion?: boolean }) {
  const [formData, setFormData] = useState<Partial<T>>(entity);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load any necessary data for dropdowns
  useEffect(() => {
    loadDropdownOptions();
  }, []);

  const loadDropdownOptions = async () => {
    // Implementation will be added when we create the Dropdown component
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    // Validate each field
    Object.entries(config.edit.fields).forEach(([key, field]) => {
      if (field.validation) {
        const error = field.validation(formData[key as keyof T], { isNew });
        if (error) {
          newErrors[key] = error;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleFieldChange = (key: string, value: any) => {
    const fieldConfig = config.edit.fields[key];
    if (!fieldConfig) {
      console.error('Invalid field:', key);
      return;
    }

    // Create proper FieldPath from config
    const fieldPath: FieldPath = {
      field: key,
      isVirtual: fieldConfig.fieldPath.isVirtual,
      through: fieldConfig.fieldPath.through
    };

    // Now use the proper fieldPath
    if (isVirtualField(fieldPath)) {
      setFormData(prev => ({
        ...prev,
        [`_virtual_${fieldPath.field}`]: value
      }));
    } else {
      setFormData(prev => ({ ...prev, [fieldPath.field]: value }));
    }
    
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }
    
    if (!isNew && !entity.id) {
      Alert.alert('Error', 'Cannot update entity without id');
      return;
    }

    setIsSubmitting(true);
    try {
      // Extract virtual field values
      const virtualFields = Object.entries(formData)
        .filter(([key]) => key.startsWith('_virtual_'))
        .reduce((acc, [key, value]) => ({
          ...acc,
          [key.replace('_virtual_', '')]: value
        }), {});

      // Regular entity data
      const entityData = Object.entries(formData)
        .filter(([key]) => !key.startsWith('_virtual_'))
        .reduce((acc, [key, value]) => ({
          ...acc,
          [key]: value
        }), {});

      if (isNew) {
        await config.repository.createNew(entityData as T);
      } else if (isAddingVersion) {
        if (!entity.id || !entity.versionNum || !entity.versionChainId) {
          throw new Error('Invalid entity for versioning');
        }
        await config.repository.addVersion(entity as T, entityData);
      } else {
        if (!entity.id) {
          throw new Error('Cannot update entity without id');
        }
        await config.repository.update(entity.id, entityData);
      }

      // Handle virtual field updates separately
      if (!isNew && entity.id) {
        for (const [field, value] of Object.entries(virtualFields)) {
          const fieldConfig = config.edit.fields[field];
          if (fieldConfig?.fieldPath.through?.relationship) {
            await config.repository.updateRelation(
              entity.id,
              fieldConfig.fieldPath.through.relationship.relationName,
              value as string[]  // Type assertion since we know virtual fields store string arrays
            );
          }
        }
      }

      onSave();
    } catch (error) {
      console.error('Error saving entity:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modal, { maxHeight: '80%' }]}>
          {/* Title */}
          <Text style={sharedStyles.modalTitle}>
            {isNew ? 'New ' : isAddingVersion ? 'New Version' : 'Edit '} 
            {config.repository.constructor.name.replace('Repository', '')}
          </Text>

          {/* Form */}
          <ScrollView style={sharedStyles.modalContent}>
            {Object.entries(config.edit.fields).map(([key, field]) => {
              const Component = UiElements[field.type];
              const error = errors[key];
              const { fieldPath, ...otherFieldProps } = field;

              return (
                <View key={key} style={{ marginBottom: spacing.medium }}>
                  <Text style={{ 
                    color: colors.text,
                    marginBottom: spacing.xsmall 
                  }}>
                    {field.label || key}
                    {field.required && <Text style={{ color: 'red' }}> *</Text>}
                  </Text>
      
                  <Component
                    value={formData[key as keyof T]}
                    onChange={(value: any) => handleFieldChange(key, value)}
                    error={error}
                    entityId={entity.id || ''}
                    fieldPath={fieldPath}
                    {...otherFieldProps}
                  />

                  {error && (
                    <Text style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
                      {error}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={[
                sharedStyles.modalButton, 
                { flex: 1, marginRight: spacing.small },
                isSubmitting && { opacity: 0.7 }
              ]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              <Text style={sharedStyles.modalButtonText}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[sharedStyles.modalButton, { flex: 1, marginLeft: spacing.small }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={sharedStyles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}