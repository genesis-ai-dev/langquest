import { useAuth } from '@/contexts/AuthContext';
import { blockService } from '@/database_services/blockService';
import { reportService } from '@/database_services/reportService';
import { reasonOptions } from '@/db/constants';
import { useLocalization } from '@/hooks/useLocalization';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
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
// Uncomment these imports when implementing duplicate report checking
// import { useHybridData } from '@/views/new/useHybridData';
// import { toCompilableQuery } from '@powersync/drizzle-driver';
// import { reports } from '@/db/drizzleSchema';
// import { system } from '@/db/powersync/system';
// import { and, eq } from 'drizzle-orm';
// import type { InferSelectModel } from 'drizzle-orm';
// type Report = InferSelectModel<typeof reports>;

interface ReportModalProps {
  isVisible: boolean;
  onClose: () => void;
  recordId: string;
  recordTable: string;
  creatorId?: string;
  onReportSubmitted?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isVisible,
  onClose,
  recordId,
  recordTable,
  creatorId,
  onReportSubmitted
}) => {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  // const { db } = system; // Uncomment when implementing duplicate report checking

  const [reason, setReason] = useState<(typeof reasonOptions)[number] | null>(
    null
  );
  const [details, setDetails] = useState('');
  const [blockUserOption, setBlockUserOption] = useState(false);
  const [blockContentOption, setBlockContentOption] = useState(false);

  // Check if user has already reported this content using useHybridData
  // Note: This could be used in the future to prevent duplicate reports
  // const { data: existingReports } = useHybridData<Report>({
  //   dataType: 'user-reports',
  //   queryKeyParams: [recordId, recordTable, currentUser?.id || ''],
  //
  //   // PowerSync query using Drizzle
  //   offlineQuery: toCompilableQuery(
  //     db.query.reports.findMany({
  //       where: and(
  //         eq(reports.record_id, recordId),
  //         eq(reports.record_table, recordTable),
  //         eq(reports.reporter_id, currentUser?.id || '')
  //       )
  //     })
  //   ),
  //
  //   // Cloud query
  //   cloudQueryFn: async () => {
  //     const { data, error } = await system.supabaseConnector.client
  //       .from('reports')
  //       .select('*')
  //       .eq('record_id', recordId)
  //       .eq('record_table', recordTable)
  //       .eq('reporter_id', currentUser?.id || '');
  //     if (error) throw error;
  //     return data as Report[];
  //   }
  // });

  // Set up mutations for creating reports and blocking
  const createReportMutation = useMutation({
    mutationFn: async (data: {
      record_id: string;
      record_table: string;
      reporter_id: string;
      reason: (typeof reasonOptions)[number];
      details?: string;
    }) => {
      return await reportService.createReport(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['user-reports']
      });
    }
  });

  const blockUserMutation = useMutation({
    mutationFn: async (data: { blocker_id: string; blocked_id: string }) => {
      return await blockService.blockUser(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['blockedUsers']
      });
    }
  });

  const blockContentMutation = useMutation({
    mutationFn: async (data: {
      profile_id: string;
      content_id: string;
      content_table: string;
    }) => {
      return await blockService.blockContent(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['blockedContent']
      });
    }
  });

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
      await createReportMutation.mutateAsync({
        record_id: recordId,
        record_table: recordTable,
        reporter_id: currentUser.id,
        reason,
        details
      });

      // Handle blocking if options are selected
      if (blockContentOption) {
        try {
          await blockContentMutation.mutateAsync({
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
          await blockUserMutation.mutateAsync({
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

                {/* Blocking options */}
                <View style={styles.blockingOptions}>
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
                    (!reason || createReportMutation.isPending) &&
                      styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={!reason || createReportMutation.isPending}
                >
                  <Text style={styles.submitButtonText}>
                    {createReportMutation.isPending
                      ? t('submitting')
                      : t('submitReport')}
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
  blockingOptions: {
    marginBottom: spacing.medium
  },
  blockOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
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
  }
});
