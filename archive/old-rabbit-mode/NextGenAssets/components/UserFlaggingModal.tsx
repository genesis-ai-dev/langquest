import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface UserFlaggingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (flagData: { type: string; description: string }) => void;
}

export const UserFlaggingModal: React.FC<UserFlaggingModalProps> = ({
  visible,
  onClose,
  onSubmit
}) => {
  const { t: _t } = useLocalization();
  const [flagType, setFlagType] = React.useState('content-issue');
  const [description, setDescription] = React.useState('');

  const flagTypes = [
    { id: 'content-issue', label: 'Content Issue', icon: 'warning' as const },
    {
      id: 'inappropriate',
      label: 'Inappropriate Content',
      icon: 'ban' as const
    },
    {
      id: 'technical-problem',
      label: 'Technical Problem',
      icon: 'construct' as const
    },
    {
      id: 'quality-concern',
      label: 'Quality Concern',
      icon: 'star-half' as const
    },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' as const }
  ];

  const handleSubmit = () => {
    if (!description.trim()) {
      Alert.alert(
        'Missing Information',
        'Please provide a description of the issue.'
      );
      return;
    }

    onSubmit({ type: flagType, description: description.trim() });
    setDescription('');
    setFlagType('content-issue');
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Flag Content</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.modalSectionTitle}>Issue Type</Text>
        <View style={styles.flagTypeContainer}>
          {flagTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.flagTypeOption,
                flagType === type.id && styles.selectedFlagType
              ]}
              onPress={() => setFlagType(type.id)}
            >
              <Ionicons
                name={type.icon}
                size={16}
                color={
                  flagType === type.id ? colors.primary : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.flagTypeText,
                  flagType === type.id && styles.selectedFlagTypeText
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.modalSectionTitle}>Description</Text>
        <TextInput
          style={styles.flagDescriptionInput}
          placeholder="Describe the issue in detail..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholderTextColor={colors.textSecondary}
        />

        <View style={styles.modalButtonContainer}>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalCancelButton]}
            onPress={onClose}
          >
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalSubmitButton]}
            onPress={handleSubmit}
          >
            <Text style={styles.modalSubmitButtonText}>Submit Flag</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.large,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.medium
  },
  modalTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  modalCloseButton: {
    padding: spacing.small
  },
  modalSectionTitle: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.small,
    color: colors.text
  },
  flagTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: spacing.medium
  },
  flagTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 8,
    marginVertical: spacing.xsmall,
    marginHorizontal: spacing.xsmall,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  selectedFlagType: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1
  },
  flagTypeText: {
    fontSize: fontSizes.small,
    marginLeft: spacing.xsmall,
    color: colors.textSecondary
  },
  selectedFlagTypeText: {
    color: colors.primary
  },
  flagDescriptionInput: {
    width: '100%',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    color: colors.text,
    fontSize: fontSizes.medium,
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: spacing.medium
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%'
  },
  modalButton: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary
  },
  modalCancelButton: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder
  },
  modalCancelButtonText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  modalSubmitButton: {
    backgroundColor: colors.primary
  },
  modalSubmitButtonText: {
    color: colors.background,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
