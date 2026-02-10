import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { blockService } from '@/database_services/blockService';
import { reportService } from '@/database_services/reportService';
import { reasonOptions } from '@/db/constants';
import { useLocalization } from '@/hooks/useLocalization';
import RNAlert from '@blazejkustra/react-native-alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Modal, Pressable, TouchableWithoutFeedback, View } from 'react-native';
import {
    KeyboardAwareScrollView,
    KeyboardToolbar
} from 'react-native-keyboard-controller';
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
      RNAlert.alert('Error', t('logInToReport'));
      return;
    }

    if (!reason) {
      RNAlert.alert('Error', t('selectReason'));
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
      RNAlert.alert(t('success'), t('reportSubmitted'));
      onReportSubmitted?.();
    } catch (error) {
      console.error('Error submitting report:', error);
      RNAlert.alert(t('error'), t('failedToSubmitReport'));
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
        <Pressable className="flex-1 items-center justify-center bg-black/50">
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View className="w-[90%] max-w-md rounded-lg bg-background p-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Text variant="h3">{t('reportTranslation')}</Text>
                <Pressable className="p-1" onPress={onClose}>
                  <Icon name="x" size={24} className="text-foreground" />
                </Pressable>
              </View>

              <KeyboardAwareScrollView
                className="max-h-[80%]"
                bottomOffset={96}
                extraKeyboardSpace={20}
                showsVerticalScrollIndicator
              >
                <View className="gap-4">
                  <View>
                    <Text variant="large" className="mb-2">
                      {t('selectReasonLabel')}
                    </Text>
                    <RadioGroup
                      value={reason ?? undefined}
                      onValueChange={(value) =>
                        handleReasonSelect(
                          value as (typeof reasonOptions)[number]
                        )
                      }
                    >
                      {reasonOptions.map((option) => (
                        <RadioGroupItem
                          key={option}
                          value={option}
                          label={t(`reportReason.${option}`)}
                        />
                      ))}
                    </RadioGroup>
                  </View>

                  <View>
                    <Text variant="large" className="mb-2">
                      {t('additionalDetails')}
                    </Text>
                    <Textarea
                      placeholder={t('additionalDetailsPlaceholder')}
                      value={details}
                      onChangeText={setDetails}
                      drawerInput={false}
                    />
                  </View>

                  {/* Blocking options */}
                  <View className="gap-3 border-t border-input pt-4">
                    <Text variant="large" className="mb-2">
                      {t('options')}
                    </Text>
                    <View className="flex-row items-center justify-between">
                      <Label className="flex-1">{t('blockThisContent')}</Label>
                      <Switch
                        checked={blockContentOption}
                        onCheckedChange={setBlockContentOption}
                      />
                    </View>

                    {creatorId && creatorId !== currentUser?.id && (
                      <View className="flex-row items-center justify-between">
                        <Label className="flex-1">{t('blockThisUser')}</Label>
                        <Switch
                          checked={blockUserOption}
                          onCheckedChange={setBlockUserOption}
                        />
                      </View>
                    )}
                  </View>
                </View>
              </KeyboardAwareScrollView>

              <Button
                className="mt-4"
                onPress={handleSubmit}
                disabled={!reason || createReportMutation.isPending}
                loading={createReportMutation.isPending}
              >
                <Text>
                  {createReportMutation.isPending
                    ? t('submitting')
                    : t('submitReport')}
                </Text>
              </Button>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </TouchableWithoutFeedback>
      <KeyboardToolbar />
    </Modal>
  );
};
