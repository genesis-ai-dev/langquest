import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { translationService } from '@/database_services/translationService';
import { system } from '@/db/powersync/system';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
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
import * as FileSystem from 'expo-file-system';

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
      // let permanentAudioUri: string | undefined;
      if (audioUri && system.permAttachmentQueue) {
        const attachment = await system.permAttachmentQueue.saveAudio(audioUri);
        console.log('attachment', attachment);

        await translationService.createTranslation({
          text: translationText.trim(),
          target_language_id: activeProject.target_language_id,
          asset_id,
          creator_id: currentUser.id,
          audio: attachment.id
        });

        setTranslationText('');
        setAudioUri(null);
        onSubmit();
        handleClose();
      }
      // // Ensure recordings directory exists
      // await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, {
      //   intermediates: true
      // });

      // // Move audio to permanent storage with unique filename
      // const fileName = `${Date.now()}_${randomUUID()}.m4a`;
      // permanentAudioUri = `${RECORDINGS_DIR}${fileName}`;
      // await FileSystem.moveAsync({
      //   from: audioUri,
      //   to: permanentAudioUri
      // });
    } catch (error) {
      console.error('Error creating translation:', error);
      Alert.alert('Error', t('failedCreateTranslation'));
    }
  };

  function handleRecordingComplete(uri: string) {
    setAudioUri(uri);
  }

  async function handleClose() {
    console.log('handleClose', audioUri);
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
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onDismiss={handleClose}
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Pressable style={styles.container} onPress={handleClose}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modal}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>

              <Text style={styles.title}>{t('newTranslation')}</Text>

              <TextInput
                style={styles.textInput}
                multiline
                placeholder={t('enterTranslation')}
                placeholderTextColor={colors.textSecondary}
                value={translationText}
                onChangeText={setTranslationText}
              />

              <AudioRecorder onRecordingComplete={handleRecordingComplete} />

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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end', // Change from 'center' to 'flex-end'
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingBottom: spacing.large // Add some padding from bottom
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '90%',
    maxHeight: '80%'
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.small
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    color: colors.text,
    fontSize: fontSizes.medium,
    minHeight: 100,
    marginBottom: spacing.medium
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.medium
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
