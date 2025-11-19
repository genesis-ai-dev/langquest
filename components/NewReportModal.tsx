import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { reasonOptions } from '@/db/constants';
import { useLocalization } from '@/hooks/useLocalization';
import { useReports } from '@/hooks/useReports';
import { useLocalStore } from '@/store/localStore';
import { XIcon } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar
} from 'react-native-keyboard-controller';

interface ReportModalProps {
  isVisible: boolean;
  onClose: () => void;
  recordId: string;
  recordTable: string;
  creatorId?: string;
  hasAlreadyReported: boolean;
  onReportSubmitted?: (contentBlocked?: boolean) => void;
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
  const { currentUser, isAuthenticated } = useAuth();
  const setAuthView = useLocalStore((state) => state.setAuthView);
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
    [t]
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
    if (!currentUser || !isAuthenticated) {
      Alert.alert(
        t('signInRequired'),
        t('blockContentLoginMessage') ||
          'We store information about what to block on your account. Please register to ensure blocked content can be properly hidden.',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('signIn') || 'Sign In',
            onPress: () => {
              onClose();
              setAuthView('sign-in');
            }
          }
        ]
      );
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

      let contentBlocked = false;

      // Handle blocking if options are selected
      if (blockContentOption) {
        try {
          await report.blockContent({
            profile_id: currentUser.id,
            content_id: recordId,
            content_table: recordTable
          });
          contentBlocked = true;
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

      // Pass whether content was blocked so parent can close modal
      onReportSubmitted?.(contentBlocked);
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
        <Pressable className="flex-1 items-center justify-center bg-black/50">
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View className="w-[90%] max-w-md rounded-lg bg-background p-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Text variant="h3">{modalTitle}</Text>
                <Pressable className="p-1" onPress={onClose}>
                  <Icon as={XIcon} size={24} className="text-foreground" />
                </Pressable>
              </View>

              <KeyboardAwareScrollView
                style={{ maxHeight: '80%' }}
                contentContainerStyle={{ paddingRight: 8 }}
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
                        {reportReasons.map((option) => (
                          <RadioGroupItem
                            key={option.value}
                            value={option.value}
                            label={option.label}
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
                      {/* Block content option - only for authenticated users */}
                      {isAuthenticated ? (
                        <>
                          <View className="flex-row items-center justify-between">
                            <Label className="flex-1">
                              {t('blockThisContent')}
                            </Label>
                            <Switch
                              checked={blockContentOption}
                              onCheckedChange={setBlockContentOption}
                            />
                          </View>

                          {creatorId && creatorId !== currentUser?.id && (
                            <View className="flex-row items-center justify-between">
                              <Label className="flex-1">
                                {t('blockThisUser')}
                              </Label>
                              <Switch
                                checked={blockUserOption}
                                onCheckedChange={setBlockUserOption}
                              />
                            </View>
                          )}
                        </>
                      ) : (
                        <View className="rounded-md bg-primary/10 p-4">
                          <Text variant="small" className="leading-5">
                            {t('blockContentLoginMessage') ||
                              'We store information about what to block on your account. Please register to ensure blocked content can be properly hidden.'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
              </KeyboardAwareScrollView>

              <Button
                className="mt-4"
                onPress={handleSubmit}
                disabled={
                  !reason || report.isCreatingReport || hasAlreadyReported
                }
                loading={report.isCreatingReport}
              >
                <Text>
                  {report.isCreatingReport
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
