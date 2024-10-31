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
import { DevEditProps } from './devTypes';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { UiElements } from './DevUiElements';

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

  const handleFieldChange = (key: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    
    // Clear error when field is modified
    if (errors[key as string]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isNew) {
        await config.repository.createNew(formData as T);
      } else if (isAddingVersion) {
        if (!entity.id || !entity.versionNum || !entity.versionChainId) {
          throw new Error('Invalid entity for versioning');
        }
        await config.repository.addVersion(entity as T, formData);
      } else {
        if (!entity.id) {
          throw new Error('Cannot update entity without id');
        }
        await config.repository.update(entity.id, formData);
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
                    onChange={(value: any) => handleFieldChange(key as keyof T, value)}
                    error={error}
                    {...field}
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