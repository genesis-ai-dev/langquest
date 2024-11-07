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
import { FieldResolver } from '@/database_components/fieldResolver';

export function DevDetailsView<T extends VersionedEntity>({ 
  entity, 
  config, 
  onClose, 
  onUpdate 
}: DevDetailsProps<T>) {
  const [fieldValues, setFieldValues] = useState<Record<string, string | React.ReactNode>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

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
      const newValues: Record<string, string | React.ReactNode> = {};
      const loadingStates: Record<string, boolean> = {};

      for (const section of config.details.sections) {
        for (const fieldPath of section.fields) {
          const fieldKey = fieldPath.field;
          loadingStates[fieldKey] = true;
          setIsLoading(loadingStates);

          try {
            const fieldConfig = config.edit.fields[fieldKey];
            if (fieldConfig?.type === 'relationList') {
              newValues[fieldKey] = (
                <RelationDisplay
                  entity={formData}
                  fieldPath={fieldPath}
                  repository={config.repository}
                />
              );
            } else {
              // Ensure formData has required BaseEntity properties
              if (!formData.id || !formData.rev) {
                throw new Error('Invalid entity data');
              }
              
              const value = await FieldResolver.resolveFieldValue(
                formData as T,
                fieldPath,
                config.repository
              );
              newValues[fieldKey] = value;
            }
          } catch (error) {
            console.error(`Error loading field ${fieldKey}:`, error);
            newValues[fieldKey] = 'Error loading';
          } finally {
            loadingStates[fieldKey] = false;
            setIsLoading(loadingStates);
          }
        }
      }
      setFieldValues(newValues);
    };

    loadFieldValues();
  }, [formData, config]);

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
                {section.fields.map((fieldPath, fieldIndex) => {
                  const fieldKey = fieldPath.field;
                  return (
                    <View key={fieldIndex} style={{ marginBottom: spacing.small }}>
                      <Text style={{ 
                        color: colors.textSecondary,
                        marginBottom: spacing.xsmall 
                      }}>
                        {config.edit.fields[fieldKey]?.label || fieldKey}
                      </Text>
                      <Text style={{ 
                        color: colors.text,
                        opacity: isLoading[fieldKey] ? 0.5 : 1 
                      }}>
                        {isLoading[fieldKey] ? 'Loading...' : fieldValues[fieldKey]}
                      </Text>
                    </View>
                  );
                })}
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
              { backgroundColor: colors.error, marginTop: spacing.small }
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