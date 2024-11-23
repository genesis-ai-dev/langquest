import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, TouchableWithoutFeedback, Alert } from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AudioRecorder from './AudioRecorder';
import { translationService } from '@/database_components/translationService';
import { CustomDropdown } from './CustomDropdown';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';

interface NewTranslationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  assetId: string;
}

export const NewTranslationModal: React.FC<NewTranslationModalProps> = ({ 
  isVisible, 
  onClose, 
  onSubmit,
  assetId,
}) => {
  const { currentUser } = useAuth();
  const { activeProject } = useProjectContext();
  const [translationText, setTranslationText] = useState('');
  // const [selectedLanguageId, setSelectedLanguageId] = useState('');

  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to submit translations');
      return;
    }

    if (!activeProject) {
      Alert.alert('Error', 'No active project found');
      return;
    }
    
    if (!translationText.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await translationService.createTranslation({
        text: translationText.trim(),
        targetLanguageId: activeProject.targetLanguageId,
        assetId,
        creatorId: currentUser.id,
      });
      
      setTranslationText('');
      onSubmit();
      onClose();
    } catch (error) {
      console.error('Error creating translation:', error);
      Alert.alert('Error', 'Failed to create translation');
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.container}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modal}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              
              <Text style={styles.title}>New Translation</Text>
              

              <TextInput
                style={styles.textInput}
                multiline
                placeholder="Enter your translation here"
                placeholderTextColor={colors.textSecondary}
                value={translationText}
                onChangeText={setTranslationText}
              />

              <AudioRecorder onRecordingComplete={() => {}} />

              <TouchableOpacity 
                style={[
                  styles.submitButton,
                  (!translationText.trim()) && styles.submitButtonDisabled
                ]} 
                onPress={handleSubmit}
                disabled={!translationText.trim()}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '90%',
    maxHeight: '80%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.small,
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium,
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    color: colors.text,
    fontSize: fontSizes.medium,
    minHeight: 100,
    marginBottom: spacing.medium,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.medium,
  },
  submitButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
  },
  submitButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
  },
});