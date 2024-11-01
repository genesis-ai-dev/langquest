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
import { DevDetailsProps } from './DevTypes';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { useVersionManagement } from './useVersionManagement';
import { DevVersionControls } from './DevVersionControls';
import { DevEditView } from './DevEditView';
import { RelationDisplay } from './DevUiElements/RelationDisplay';

export function DevDetailsView<T extends VersionedEntity>({ 
  entity, 
  config, 
  onClose, 
  onUpdate 
}: DevDetailsProps<T>) {

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const {
    editing,
    setEditing,
    formData,
    versions,
    currentVersionIndex,
    setCurrentVersionIndex,
    isAddingVersion,
    setIsAddingVersion,
    reloadVersions
  } = useVersionManagement(config.repository, entity, false);

  useEffect(() => {
    const loadFieldValues = async () => {
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(formData)) {
        values[key] = await renderFieldValue(key, value);
      }
      setFieldValues(values);
    };
    loadFieldValues();
  }, [formData]);
  
  const handleDelete = async () => {
    Alert.alert(
      'Delete Version',
      'Are you sure you want to delete this version?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await config.repository.delete(entity.id);
              onUpdate();
              onClose();
            } catch (error) {
              console.error('Error deleting version:', error);
              Alert.alert('Error', 'Failed to delete version');
            }
          }
        }
      ]
    );
  };

  // Helper function to render a field value based on its type
  const renderFieldValue = async (key: string, value: any) => {
    const fieldConfig = config.edit.fields[key];
    if (!fieldConfig) return String(value || 'N/A');
  
    switch (fieldConfig.type) {
      case 'switch':
        return value ? 'Yes' : 'No';
      case 'password':
        return '••••••••';
        case 'dropdown':
          if (fieldConfig.linkedEntity && value) {
            try {
              const linkedEntity = await fieldConfig.linkedEntity.repository.getById(value);
              return linkedEntity ? String(linkedEntity[fieldConfig.linkedEntity.displayField]) : 'N/A';
            } catch (error) {
              console.error(`Error loading linked entity for ${key}:`, error);
              return 'Error loading';
            }
          }
          return value || 'None';
      case 'relationList':
        return (
          <RelationDisplay
            entityId={entity.id}
            fieldKey={key}
            fieldConfig={fieldConfig}
            repository={config.repository}
          />
        );
      default:
        return String(value || 'N/A');
    }
  };

  if (editing || isAddingVersion) {
    return (
      <DevEditView
        entity={formData as T}
        config={config}
        isNew={false}
        isAddingVersion={isAddingVersion}
        onSave={async () => {
          setEditing(false);
          setIsAddingVersion(false);
          await reloadVersions(entity.id);
          onUpdate();
        }}
        onClose={() => {
          setEditing(false);
          setIsAddingVersion(false);
        }}
      />
    );
  }

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={sharedStyles.modalOverlay}>
        <View style={[
          sharedStyles.modal,
          { maxHeight: '80%' }
        ]}>
          {/* Version Controls */}
          <DevVersionControls
            versions={versions}
            currentIndex={currentVersionIndex}
            setCurrentIndex={setCurrentVersionIndex}
          />

          {/* Content */}
          <ScrollView style={sharedStyles.modalContent}>
            {config.details.sections.map((section, sectionIndex) => (
              <View key={sectionIndex} style={{ marginBottom: spacing.large }}>
                <Text style={[
                  sharedStyles.modalTitle,
                  { marginBottom: spacing.small }
                ]}>
                  {section.title}
                </Text>
                {section.fields.map((fieldKey, fieldIndex) => (
                  <View key={fieldIndex} style={{ marginBottom: spacing.small }}>
                    <Text style={{ 
                      color: colors.textSecondary,
                      marginBottom: spacing.xsmall 
                    }}>
                      {config.edit.fields[fieldKey]?.label || fieldKey}
                    </Text>
                    <Text style={{ color: colors.text }}>
                      {fieldValues[fieldKey] || 'Loading...'}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={[sharedStyles.modalButton, { flex: 1, marginRight: spacing.small }]}
              onPress={() => setEditing(true)}
            >
              <Text style={sharedStyles.modalButtonText}>Edit Version</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[sharedStyles.modalButton, { flex: 1, marginLeft: spacing.small }]}
              onPress={() => setIsAddingVersion(true)}
            >
              <Text style={sharedStyles.modalButtonText}>Add Version</Text>
            </TouchableOpacity>
          </View>

          {/* Delete Button */}
          <TouchableOpacity
            style={[
              sharedStyles.modalButton,
              { backgroundColor: 'red', marginTop: spacing.small }
            ]}
            onPress={handleDelete}
          >
            <Text style={sharedStyles.modalButtonText}>Delete Version</Text>
          </TouchableOpacity>

          {/* Close Button */}
          <TouchableOpacity
            style={[sharedStyles.modalButton, { marginTop: spacing.small }]}
            onPress={onClose}
          >
            <Text style={sharedStyles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}