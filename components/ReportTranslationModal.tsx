import { useAuth } from '@/contexts/AuthContext';
import { translationReportService } from '@/database_services/translationReportService';
import { Translation } from '@/database_services/translationService';
import { reasonOptions } from '@/db/constants';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
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

interface ReportTranslationModalProps {
  isVisible: boolean;
  onClose: () => void;
  translation: Translation;
}

export const ReportTranslationModal: React.FC<ReportTranslationModalProps> = ({
  isVisible,
  onClose,
  translation
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [reason, setReason] = useState<(typeof reasonOptions)[number] | null>(
    null
  );
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReasonSelect = (
    selectedReason: (typeof reasonOptions)[number]
  ) => {
    setReason(selectedReason);
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToReport'));
      return;
    }

    if (!reason) {
      Alert.alert('Error', t('selectReason'));
      return;
    }

    try {
      setIsSubmitting(true);
      await translationReportService.createReport({
        translation_id: translation.id,
        reporter_id: currentUser.id,
        reason,
        details
      });

      setReason(null);
      setDetails('');
      onClose();
      Alert.alert('Success', t('reportSubmitted'));
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', t('failedToSubmitReport'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView>
      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <Pressable style={styles.container} onPress={onClose}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modal}>
                <View style={styles.header}>
                  <Text style={styles.title}>{t('reportTranslation')}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>
                  {t('selectReasonLabel')}
                </Text>
                <View style={styles.reasonsContainer}>
                  {reasonOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.reasonOption,
                        reason === option && styles.selectedReason
                      ]}
                      onPress={() => handleReasonSelect(option)}
                    >
                      <Text
                        style={[
                          styles.reasonText,
                          reason === option && styles.selectedReasonText
                        ]}
                      >
                        {t(`reportReason.${option}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>
                  {t('additionalDetails')}
                </Text>
                <TextInput
                  style={styles.detailsInput}
                  multiline
                  placeholder={t('additionalDetailsPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={details}
                  onChangeText={setDetails}
                />

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!reason || isSubmitting) && styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={!reason || isSubmitting}
                >
                  <Text style={styles.submitButtonText}>
                    {isSubmitting ? t('submitting') : t('submitReport')}
                  </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modal: {
    width: '90%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    maxHeight: '80%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  closeButton: {
    padding: spacing.xsmall
  },
  sectionTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.small
  },
  reasonsContainer: {
    marginBottom: spacing.medium
  },
  reasonOption: {
    padding: spacing.small,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginBottom: spacing.xsmall
  },
  selectedReason: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  reasonText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  selectedReasonText: {
    color: colors.text,
    fontWeight: '600'
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.text,
    marginBottom: spacing.medium
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: spacing.small,
    borderRadius: borderRadius.medium,
    alignItems: 'center'
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled
  },
  submitButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: fontSizes.medium
  }
});
