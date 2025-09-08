import { useAuth } from '@/contexts/AuthContext';
import { reasonOptions } from '@/db/constants';
import { useLocalization } from '@/hooks/useLocalization';
import { useReports } from '@/hooks/useReports';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import RadioSelect from './RadioSelect';

interface ReportModalProps {
  isVisible: boolean;
  onClose: () => void;
  recordId: string;
  recordTable: string;
  creatorId?: string;
  hasAlreadyReported: boolean;
  onReportSubmitted?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isVisible,
  onClose,
  recordId,
  recordTable,
  creatorId,
  hasAlreadyReported,
  onReportSubmitted
}) => {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  // const queryClient = useQueryClient();
  // const { db } = system; // Uncomment when implementing duplicate report checking

  const [reason, setReason] = useState<(typeof reasonOptions)[number] | null>(
    null
  );
  const [details, setDetails] = useState('');
  const [blockUserOption, setBlockUserOption] = useState(false);
  const [blockContentOption, setBlockContentOption] = useState(false);

  const report = useReports(recordId, recordTable, currentUser?.id);

  const reportTitle = {
    projects: t('reportProject'),
    quests: t('reportQuest'),
    assets: t('reportAsset'),
    translations: t('reportTranslation')
  };

  const reportReasons = useMemo(
    () =>
      reasonOptions.map((option) => {
        return {
          label: t(`reportReason.${option}`),
          value: option
        };
      }),
    []
  );

  const modalTitle =
    recordTable in reportTitle
      ? reportTitle[recordTable as keyof typeof reportTitle]
      : t('reportGeneric');

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
      await report.createReport({
        record_id: recordId,
        record_table: recordTable,
        reporter_id: currentUser.id || '',
        reason,
        details
      });

      // Handle blocking if options are selected
      if (blockContentOption) {
        try {
          await report.blockContent({
            profile_id: currentUser.id,
            content_id: recordId,
            content_table: recordTable
          });
          console.log('Content blocked successfully');
        } catch (error) {
          console.error('Failed to block content:', error);
        }
      }

      if (blockUserOption && creatorId) {
        try {
          await report.blockUser({
            blocker_id: currentUser.id,
            blocked_id: creatorId
          });
          console.log('User blocked successfully');
        } catch (error) {
          console.error('Failed to block user:', error);
        }
      }

      setReason(null);
      setDetails('');
      setBlockUserOption(false);
      setBlockContentOption(false);
      onClose();
      Alert.alert(t('success'), t('reportSubmitted'));
      onReportSubmitted?.();
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert(t('error'), t('failedToSubmitReport'));
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
        <Pressable style={styles.container} onPress={onClose}>
          <KeyboardAvoidingView>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modal}>
                <View style={styles.header}>
                  <Text style={styles.title}>{modalTitle}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.sectionDecoration}>
                  <Text style={styles.sectionTitle}>
                    {t('selectReasonLabel')}
                  </Text>
                </View>
                <View style={styles.reasonsContainer}>
                  <RadioSelect
                    options={reportReasons}
                    value={reason}
                    onChange={(option) =>
                      handleReasonSelect(
                        option as (typeof reasonOptions)[number]
                      )
                    }
                    textColor={colors.text}
                    borderColor={colors.primary}
                    fillColor={colors.primary}
                  />
                </View>
                <View style={styles.sectionDecoration}>
                  <Text style={styles.sectionTitle}>
                    {t('additionalDetails')}
                  </Text>
                </View>
                <TextInput
                  style={styles.detailsInput}
                  multiline
                  placeholder={t('additionalDetailsPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={details}
                  onChangeText={setDetails}
                />

                {/* Blocking options */}
                <View style={styles.blockingOptions}>
                  <View style={styles.sectionDecoration}>
                    <Text style={styles.sectionTitle}>{t('options')}</Text>
                  </View>
                  <View style={styles.blockOption}>
                    <Text style={styles.blockText}>
                      {t('blockThisContent')}
                    </Text>
                    <Switch
                      value={blockContentOption}
                      onValueChange={setBlockContentOption}
                      trackColor={{
                        false: colors.textSecondary,
                        true: colors.primary // Use primary color for better contrast
                      }}
                      thumbColor={
                        blockContentOption
                          ? colors.primary
                          : colors.inputBackground
                      }
                    />
                  </View>

                  {creatorId && creatorId !== currentUser?.id && (
                    <View style={styles.blockOption}>
                      <Text style={styles.blockText}>{t('blockThisUser')}</Text>
                      <Switch
                        value={blockUserOption}
                        onValueChange={setBlockUserOption}
                        trackColor={{
                          false: colors.textSecondary,
                          true: colors.primary // Use primary color for better contrast
                        }}
                        thumbColor={
                          blockUserOption
                            ? colors.primary
                            : colors.inputBackground
                        }
                      />
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!reason || report.isCreatingReport) &&
                      styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={
                    !reason || report.isCreatingReport || hasAlreadyReported
                  }
                >
                  <Text style={styles.submitButtonText}>
                    {report.isCreatingReport
                      ? t('submitting')
                      : t('submitReport')}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Pressable>
      </TouchableWithoutFeedback>
    </Modal>
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
    minWidth: '90%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large
    // height: '80%'
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
    marginTop: spacing.small,
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
    // borderWidth: 1,
    // borderColor: colors.inputBorder,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.small,
    padding: spacing.small,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.text,
    marginTop: spacing.small,
    marginBottom: spacing.medium
  },
  blockingOptions: {
    marginBottom: spacing.medium
  },
  blockOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xsmall
    // borderBottomWidth: 1,
    // borderBottomColor: colors.inputBorder
  },
  blockText: {
    fontSize: fontSizes.medium,
    color: colors.text
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
  },
  sectionDecoration: {
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  }
});
