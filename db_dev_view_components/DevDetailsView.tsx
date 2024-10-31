import React from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Modal,
  Alert 
} from 'react-native';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { DevDetailsProps } from './devTypes';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { useVersionManagement } from './useVersionManagement';
import { DevVersionControls } from './DevVersionControls';
import { DevEditView } from './DevEditView';

export function DevDetailsView<T extends VersionedEntity>({ 
  entity, 
  config, 
  onClose, 
  onUpdate 
}: DevDetailsProps<T>) {
  const {
    editing,
    setEditing,
    formData,
    versions,
    currentVersionIndex,
    setCurrentVersionIndex,
    isAddingVersion,
    setIsAddingVersion
  } = useVersionManagement(config.repository, entity, false);

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
  const renderFieldValue = (key: string, value: any) => {
    const fieldConfig = config.edit.fields[key];
    if (!fieldConfig) return String(value || 'N/A');

    switch (fieldConfig.type) {
      case 'switch':
        return value ? 'Yes' : 'No';
      case 'password':
        return '••••••••';
      case 'dropdown':
        return value || 'None';
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
        onSave={() => {
          setEditing(false);
          setIsAddingVersion(false);
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
                      {renderFieldValue(fieldKey, formData[fieldKey as keyof T])}
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