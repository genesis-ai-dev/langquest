import AudioRecorder from '@/components/AudioRecorder';
import { useAuth } from '@/contexts/AuthContext';
import { translationService } from '@/database_services/translationService';
import type { asset_content_link, language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

type AssetContent = typeof asset_content_link.$inferSelect;

interface NextGenNewTranslationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  assetId: string;
  assetName: string;
  assetContent?: AssetContent[];
  sourceLanguage?: typeof language.$inferSelect | null;
  targetLanguageId: string;
}

type TranslationType = 'text' | 'audio';

export default function NextGenNewTranslationModal({
  visible,
  onClose,
  onSuccess,
  assetId,
  assetName,
  assetContent,
  sourceLanguage,
  targetLanguageId
}: NextGenNewTranslationModalProps) {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const isOnline = useNetworkStatus();
  const [translationText, setTranslationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [translationType, setTranslationType] =
    useState<TranslationType>('text');
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToTranslate'));
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
      setIsSubmitting(true);

      let audioAttachment: string | null = null;
      if (audioUri && system.permAttachmentQueue) {
        const attachment = await system.permAttachmentQueue.saveAudio(audioUri);
        audioAttachment = attachment.filename;
      }

      // Use translationService to create the translation
      await translationService.createTranslation({
        text: translationType === 'text' ? translationText.trim() : '',
        target_language_id: targetLanguageId,
        asset_id: assetId,
        creator_id: currentUser.id,
        audio: audioAttachment
      });

      setTranslationText('');
      setAudioUri(null);
      Alert.alert('Success', 'Translation submitted successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating translation:', error);
      Alert.alert('Error', t('failedCreateTranslation'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordingComplete = (uri: string) => {
    setAudioUri(uri);
  };

  const handleClose = async () => {
    // Clean up audio file if exists
    if (audioUri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(audioUri);
        }
      } catch (error) {
        console.error('Error cleaning up audio file:', error);
      }
    }
    setAudioUri(null);
    setTranslationText('');
    onClose();
  };

  // Get first content text as preview
  const contentPreview = assetContent?.[0]?.text || '';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('newTranslation')}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Translation Type Toggle */}
          <View style={styles.typeToggleContainer}>
            <TouchableOpacity
              style={[
                styles.typeToggleButton,
                translationType === 'text' && styles.typeToggleButtonActive
              ]}
              onPress={() => setTranslationType('text')}
            >
              <Ionicons
                name="text"
                size={20}
                color={
                  translationType === 'text' ? colors.buttonText : colors.text
                }
              />
              <Text
                style={[
                  styles.typeToggleText,
                  translationType === 'text' && styles.typeToggleTextActive
                ]}
              >
                Text
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeToggleButton,
                translationType === 'audio' && styles.typeToggleButtonActive
              ]}
              onPress={() => setTranslationType('audio')}
            >
              <Ionicons
                name="mic"
                size={20}
                color={
                  translationType === 'audio' ? colors.buttonText : colors.text
                }
              />
              <Text
                style={[
                  styles.typeToggleText,
                  translationType === 'audio' && styles.typeToggleTextActive
                ]}
              >
                Audio
              </Text>
            </TouchableOpacity>
          </View>

          {/* Asset Info */}
          <View style={styles.assetInfo}>
            <Text style={styles.assetName}>{assetName}</Text>
            <Text style={styles.languageText}>
              {sourceLanguage?.native_name ||
                sourceLanguage?.english_name ||
                'Unknown'}{' '}
              → Target Language
            </Text>
          </View>

          {/* Source Content Preview */}
          {contentPreview && (
            <View style={styles.sourceContentBox}>
              <Text style={styles.sourceLabel}>Source:</Text>
              <Text style={styles.sourceText} numberOfLines={3}>
                {contentPreview}
              </Text>
            </View>
          )}

          {/* Translation Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Your {translationType === 'text' ? 'Translation' : 'Audio'}:
            </Text>

            {translationType === 'text' ? (
              <TextInput
                style={styles.textInput}
                multiline
                placeholder={t('enterTranslation')}
                placeholderTextColor={colors.textSecondary}
                value={translationText}
                onChangeText={setTranslationText}
                autoFocus
              />
            ) : (
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                resetRecording={() => setAudioUri(null)}
              />
            )}
          </View>

          {/* Network Status */}
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {SHOW_DEV_ELEMENTS && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {isOnline ? '🟢 Online' : '🔴 Offline'} - Ready to submit
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              ((translationType === 'text' && !translationText.trim()) ||
                (translationType === 'audio' && !audioUri) ||
                isSubmitting) &&
                styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={
              (translationType === 'text' && !translationText.trim()) ||
              (translationType === 'audio' && !audioUri) ||
              isSubmitting
            }
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <Text style={styles.submitButtonText}>{t('submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.large,
    paddingBottom: spacing.xlarge,
    maxHeight: '85%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    color: colors.text
  },
  closeButton: {
    padding: spacing.small
  },
  typeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.xsmall,
    marginBottom: spacing.medium
  },
  typeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: borderRadius.small,
    gap: spacing.small
  },
  typeToggleButtonActive: {
    backgroundColor: colors.primary
  },
  typeToggleText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  typeToggleTextActive: {
    color: colors.buttonText,
    fontWeight: 'bold'
  },
  assetInfo: {
    marginBottom: spacing.medium
  },
  assetName: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  languageText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  sourceContentBox: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium
  },
  sourceLabel: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xsmall
  },
  sourceText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    lineHeight: fontSizes.medium * 1.4
  },
  inputContainer: {
    marginBottom: spacing.medium
  },
  inputLabel: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.small
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    color: colors.text,
    fontSize: fontSizes.medium,
    minHeight: 120,
    textAlignVertical: 'top'
  },
  statusContainer: {
    marginBottom: spacing.medium
  },
  statusText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center'
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
    opacity: 0.6
  },
  submitButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
