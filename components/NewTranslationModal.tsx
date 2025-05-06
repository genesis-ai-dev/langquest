import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useSystem } from '@/contexts/SystemContext';
import { translationService } from '@/database_services/translationService';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import AudioRecorder from './AudioRecorder';

interface NewTranslationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  asset_id: string;
}

export const NewTranslationModal: React.FC<NewTranslationModalProps> = ({
  isVisible,
  onClose,
  onSubmit,
  asset_id
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { activeProject } = useProjectContext();
  const { stopCurrentSound } = useAudio();
  const system = useSystem();
  const [translationText, setTranslationText] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToTranslate'));
      return;
    }

    if (!activeProject) {
      Alert.alert('Error', t('noProject'));
      return;
    }

    if (!translationText.trim() && !audioUri) {
      Alert.alert('Error', t('fillFields'));
      return;
    }

    try {
      if (!audioUri) return;
      if (!system.permAttachmentQueue) {
        console.log(`Error: PermAttachmentQueue doesn't exist.`);
        return;
      }

      // let permanentAudioUri: string | undefined;
      const attachment = await system.permAttachmentQueue.saveAudio(audioUri);
      console.log('new translation', attachment);
      // Create the translation with or without audio
      await translationService.createTranslation({
        text: translationText.trim(),
        target_language_id: activeProject.target_language_id,
        asset_id,
        creator_id: currentUser.id,
        audio: attachment.filename
      });

      setTranslationText('');
      setAudioUri(null);
      onSubmit();
      handleClose();
    } catch (error) {
      console.error('Error creating translation:', error);
      Alert.alert('Error', t('failedCreateTranslation'));
    }
  };

  function handleRecordingComplete(uri: string) {
    setAudioUri(uri);
  }

  async function handleClose() {
    // Stop any playing audio when modal closes
    void stopCurrentSound();

    if (audioUri) {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (fileInfo.exists) {
        console.log('Deleting recording', audioUri);
        await FileSystem.deleteAsync(audioUri);
      }
    }
    onClose();
  }

  return (
    <KeyboardAvoidingView>
      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onDismiss={handleClose}
        onRequestClose={handleClose}
        hardwareAccelerated
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <Pressable style={styles.container} onPress={handleClose}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modal}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    // flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  <Text style={styles.title}>{t('newTranslation')}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleClose}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.textInput}
                  multiline
                  placeholder={t('enterTranslation')}
                  placeholderTextColor={colors.textSecondary}
                  value={translationText}
                  onChangeText={setTranslationText}
                />

                <AudioRecorder
                  onRecordingComplete={handleRecordingComplete}
                  resetRecording={() => setAudioUri(null)}
                />

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    !translationText.trim() &&
                      !audioUri &&
                      styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={!translationText.trim() && !audioUri}
                >
                  <Text style={styles.submitButtonText}>{t('submit')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end', // Change from 'center' to 'flex-end'
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)'
    // paddingBottom: spacing.large // Add some padding from bottom
  },
  modal: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.medium,
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    // width: '90%'
    width: '100%'
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.small
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    color: colors.text,
    fontSize: fontSizes.medium,
    minHeight: 100
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center'
  },
  submitButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  submitButtonDisabled: {
    backgroundColor: colors.backgroundSecondary
  }
});
