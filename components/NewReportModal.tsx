import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
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
import RNAlert from '@blazejkustra/react-native-alert';
import { useRouter } from 'expo-router';
import { XIcon } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

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
  const router = useRouter();
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
    Keyboard.dismiss();
    setReason(selectedReason);
  };

  const handleSubmit = async () => {
    if (!currentUser || !isAuthenticated) {
      RNAlert.alert(t('signInRequired'), t('blockContentLoginMessage'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('signIn'),
          isPreferred: true,
          onPress: () => {
            onClose();
            router.push('/(auth)/sign-in');
          }
        }
      ]);
      return;
    }

    if (!reason) {
      RNAlert.alert('Error', t('selectReason'));
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
      RNAlert.alert(t('success'), t('reportSubmitted'));

      // Pass whether content was blocked so parent can close modal
      onReportSubmitted?.(contentBlocked);
    } catch (error) {
      console.error('Error submitting report:', error);
      RNAlert.alert(t('error'), t('failedToSubmitReport'));
    }
  };

  return (
    <Drawer
      open={isVisible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      dismissible={false}
      android_keyboardInputMode="adjustResize"
    >
      <DrawerContent className="pb-safe">
        <DrawerHeader className="flex-row items-center justify-between">
          <DrawerTitle>{modalTitle}</DrawerTitle>
          <Button variant="ghost" size="icon" onPress={onClose} className="p-1">
            <Icon as={XIcon} size={24} className="text-foreground" />
          </Button>
        </DrawerHeader>

        <KeyboardAwareScrollView
          bottomOffset={96}
          extraKeyboardSpace={20}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-4 px-1 pb-2">
            <View>
              <Text variant="large" className="mb-2">
                {t('selectReasonLabel')}
              </Text>
              <RadioGroup
                value={reason ?? undefined}
                onValueChange={(value) =>
                  handleReasonSelect(value as (typeof reasonOptions)[number])
                }
              >
                {reportReasons.map((option) => (
                  <RadioGroupItem
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    testID={`report-reason-${option.value}`}
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
                drawerInput
                testID="report-details"
              />
            </View>

            <View className="gap-3 border-t border-input pt-4">
              <Text variant="large" className="mb-2">
                {t('options')}
              </Text>
              {isAuthenticated ? (
                <>
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
                </>
              ) : (
                <View className="rounded-md bg-primary/10 p-4">
                  <Text variant="small" className="leading-5">
                    {t('blockContentLoginMessage')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </KeyboardAwareScrollView>

        <DrawerFooter>
          <Button
            onPress={() => void handleSubmit()}
            testID="report-submit"
            accessibilityLabel="report-submit"
            disabled={!reason || report.isCreatingReport || hasAlreadyReported}
            loading={report.isCreatingReport}
          >
            <Text>
              {report.isCreatingReport ? t('submitting') : t('submitReport')}
            </Text>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
