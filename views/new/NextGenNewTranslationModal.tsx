import { useAuth } from '@/contexts/AuthContext';
import { translationService } from '@/database_services/translationService';
import type { language } from '@/db/drizzleSchema';
import type { AssetContent } from '@/hooks/db/useAssets';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
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

  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToTranslate'));
      return;
    }

    if (!translationText.trim()) {
      Alert.alert('Error', t('fillFields'));
      return;
    }

    try {
      setIsSubmitting(true);

      // Use translationService to create the translation
      await translationService.createTranslation({
        text: translationText.trim(),
        target_language_id: targetLanguageId,
        asset_id: assetId,
        creator_id: currentUser.id,
        audio: null
      });

      setTranslationText('');
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

  // Get first content text as preview
  const contentPreview = assetContent?.[0]?.text || '';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('newTranslation')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
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
            <Text style={styles.inputLabel}>Your Translation:</Text>
            <TextInput
              style={styles.textInput}
              multiline
              placeholder={t('enterTranslation')}
              placeholderTextColor={colors.textSecondary}
              value={translationText}
              onChangeText={setTranslationText}
              autoFocus
            />
          </View>

          {/* Network Status */}
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {isOnline ? '🟢 Online' : '🔴 Offline'} - Ready to submit
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!translationText.trim() || isSubmitting) &&
                styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!translationText.trim() || isSubmitting}
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
    maxHeight: '80%'
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
