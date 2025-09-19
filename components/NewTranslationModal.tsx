import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { translationService } from '@/database_services/translationService';
import type { asset_content_link, language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { deleteIfExists } from '@/utils/fileUtils';
import { Ionicons } from '@expo/vector-icons';
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
import { SourceContent } from './SourceContent';

interface NewTranslationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (translation?: object) => void;
  asset_id: string;
  translationType: 'text' | 'audio';
  assetContent?: typeof asset_content_link.$inferSelect;
  sourceLanguage: typeof language.$inferSelect | null;
  // targetLanguage: typeof language.$inferSelect | null;
  attachmentUris: Record<string, string>;
  loadingAttachments: boolean;
}

export const NewTranslationModal: React.FC<NewTranslationModalProps> = ({
  isVisible,
  onClose,
  onSubmit,
  asset_id,
  translationType,
  assetContent,
  sourceLanguage,
  // targetLanguage,
  attachmentUris,
  loadingAttachments
}) => {
  console.log('assetContent', assetContent);

  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { currentProjectId } = useCurrentNavigation();
  const { project: activeProject } = useProjectById(currentProjectId || '');
  const { stopCurrentSound } = useAudio();
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

    if (translationType === 'text' && !translationText.trim()) {
      Alert.alert('Error', t('fillFields'));
      return;
    }

    if (translationType === 'audio' && !audioUri) {
      Alert.alert('Error', t('fillFields'));
      return;
    }

    try {
      let audioAttachment: string | undefined = undefined;
      if (audioUri && system.permAttachmentQueue) {
        const attachment = await system.permAttachmentQueue.saveAudio(audioUri);
        audioAttachment = attachment.filename;
      }

      // Create the translation with or without audio
      const newTranslation = await translationService.createTranslation({
        text: translationType === 'text' ? translationText.trim() : '',
        target_language_id: activeProject.target_language_id,
        asset_id,
        creator_id: currentUser.id,
        audio: audioAttachment ?? ''
      });

      setTranslationText('');
      setAudioUri(null);
      onSubmit(newTranslation);
      void handleClose();
    } catch (error) {
      console.error('Error creating translation:', error);
      Alert.alert('Error', t('failedCreateTranslation'));
    }
  };

  function handleRecordingComplete(uri: string) {
    setAudioUri(uri);
  }

  function handleClose() {
    // Stop any playing audio when modal closes
    void stopCurrentSound();

    if (audioUri) deleteIfExists(audioUri);
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

                <View style={styles.modalContent}>
                  {assetContent && (
                    <View style={styles.sourceContent}>
                      <SourceContent
                        content={assetContent}
                        sourceLanguage={sourceLanguage}
                        audioUri={
                          assetContent.audio_id
                            ? attachmentUris[assetContent.audio_id]
                            : null
                        }
                        isLoading={loadingAttachments}
                      />
                    </View>
                  )}

                  <View style={styles.translationInput}>
                    {/* <Text style={styles.languageLabel}>
                      {targetLanguage?.native_name ??
                        targetLanguage?.english_name}
                      :
                    </Text> */}
                    {translationType === 'text' && (
                      <TextInput
                        style={styles.textInput}
                        multiline
                        placeholder={t('enterTranslation')}
                        placeholderTextColor={colors.textSecondary}
                        value={translationText}
                        onChangeText={setTranslationText}
                      />
                    )}

                    {translationType === 'audio' && (
                      <AudioRecorder
                        onRecordingComplete={handleRecordingComplete}
                        resetRecording={() => setAudioUri(null)}
                      />
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    ((translationType === 'text' && !translationText.trim()) ||
                      (translationType === 'audio' && !audioUri)) &&
                      styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={
                    (translationType === 'text' && !translationText.trim()) ||
                    (translationType === 'audio' && !audioUri)
                  }
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
  },
  modalContent: {
    flexDirection: 'column',
    gap: spacing.medium
  },
  sourceContent: {
    flexDirection: 'column',
    gap: spacing.medium
  },
  translationInput: {
    flexDirection: 'column',
    gap: spacing.medium
  },
  languageLabel: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text
  }
});
