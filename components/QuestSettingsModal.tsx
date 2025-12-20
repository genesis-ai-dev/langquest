import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
  updateQuestStatus,
  useQuestStatuses
} from '@/database_services/status/quest';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestOffloadVerification } from '@/hooks/useQuestOffloadVerification';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { offloadQuest } from '@/utils/questOffloadUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import {
  CheckCircleIcon,
  CloudUpload,
  EyeIcon,
  EyeOffIcon,
  XCircleIcon
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { QuestOffloadVerificationDrawer } from './QuestOffloadVerificationDrawer';
import { SwitchBox } from './SwitchBox';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface QuestSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  questId: string;
  projectId: string;
}

// type TStatusType = 'active' | 'visible';

export const QuestSettingsModal: React.FC<QuestSettingsModalProps> = ({
  isVisible,
  onClose,
  questId,
  projectId
}) => {
  const { t } = useLocalization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOffloadDrawer, setShowOffloadDrawer] = useState(false);
  const [isOffloading, setIsOffloading] = useState(false);

  const { membership } = useUserPermissions(projectId || '', 'manage');
  const isOwner = membership === 'owner';

  const layerStatus = useStatusContext();

  const {
    data: questData,
    isLoading,
    isError,
    refetch
  } = useQuestStatuses(questId);

  // Initialize offload verification hook
  const verificationState = useQuestOffloadVerification(questId);

  // Handle error in useEffect to avoid setState during render
  useEffect(() => {
    if (isError && isVisible) {
      RNAlert.alert(t('error'), t('questSettingsLoadError'));
      onClose();
    }
  }, [isError, isVisible, onClose, t]);

  if (isError) {
    return null;
  }

  // Check if quest has local data (source is 'local' or has been downloaded)
  const hasLocalData =
    questData?.source === 'local' || questData?.source === 'synced';

  const handleToggleVisible = async () => {
    if (!questData || isSubmitting) return;
    setIsSubmitting(true);

    let visible = questData.visible;
    const active = questData.active;

    try {
      // Visibility switch is independent - only toggle visible state
      visible = !visible;

      await updateQuestStatus(questId, { visible, active }, questData.source);
      layerStatus.setLayerStatus(
        LayerType.QUEST,
        { visible, active, source: questData.source },
        questId
      );

      refetch();
    } catch (error) {
      console.error('Error updating quest status:', error);
      RNAlert.alert(t('error'), t('failedToUpdateQuestSettings'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!questData || isSubmitting) return;
    setIsSubmitting(true);

    const visible = questData.visible;
    let active = questData.active;

    try {
      // Active switch is independent - only toggle active state
      active = !active;

      await updateQuestStatus(questId, { visible, active }, questData.source);
      layerStatus.setLayerStatus(
        LayerType.QUEST,
        { visible, active, source: questData.source },
        questId
      );

      refetch();
    } catch (error) {
      console.error('Error updating quest status:', error);
      RNAlert.alert(t('error'), t('failedToUpdateQuestSettings'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartOffload = () => {
    setShowOffloadDrawer(true);
    verificationState.startVerification();
  };

  const handleContinueOffload = async () => {
    setIsOffloading(true);
    try {
      await offloadQuest({
        questId,
        verifiedIds: verificationState.verifiedIds,
        onProgress: (progress, message) => {
          console.log(`Offload progress: ${progress.toFixed(0)}% - ${message}`);
        }
      });

      RNAlert.alert(t('success'), t('offloadComplete'));
      setShowOffloadDrawer(false);
      onClose();
      refetch();
    } catch (error) {
      console.error('Failed to offload quest:', error);
      RNAlert.alert(t('error'), t('offloadError'));
    } finally {
      setIsOffloading(false);
    }
  };

  return (
    <>
      <Drawer
        open={isVisible}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        snapPoints={[400]}
        enableDynamicSizing={false}
      >
        <DrawerContent className="bg-background pb-4">
          <DrawerHeader>
            <DrawerTitle>{t('questSettings')}</DrawerTitle>
          </DrawerHeader>

          <View className="flex-1 gap-2">
            <SwitchBox
              title={t('visibility')}
              description={
                questData?.visible
                  ? t('visibleQuestDescription')
                  : t('invisibleQuestDescription')
              }
              value={questData?.visible ?? false}
              onChange={() => handleToggleVisible()}
              disabled={isLoading || !isOwner}
              icon={questData?.visible ? EyeIcon : EyeOffIcon}
            />
            <SwitchBox
              title={t('active')}
              description={
                questData?.active
                  ? t('activeQuestDescription')
                  : t('inactiveQuestDescription')
              }
              value={questData?.active ?? false}
              onChange={() => handleToggleActive()}
              disabled={isLoading || !isOwner}
              icon={questData?.active ? CheckCircleIcon : XCircleIcon}
            />

            {/* Offload Quest Button */}
            {hasLocalData && isOwner && (
              <View className="border-t border-border pt-4">
                <Button
                  variant="outline"
                  onPress={handleStartOffload}
                  disabled={isSubmitting || isLoading}
                  className="border-destructive"
                >
                  <View className="flex-row items-center gap-3">
                    <Icon
                      as={CloudUpload}
                      size={20}
                      className="text-destructive"
                    />
                    <View className="flex-1">
                      <Text className="font-semibold text-destructive">
                        {t('offloadQuest')}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {t('offloadQuestDescription')}
                      </Text>
                    </View>
                  </View>
                </Button>
              </View>
            )}
          </View>
        </DrawerContent>
      </Drawer>

      {/* Offload Verification Drawer */}
      <QuestOffloadVerificationDrawer
        isOpen={showOffloadDrawer}
        onOpenChange={setShowOffloadDrawer}
        onContinue={handleContinueOffload}
        verificationState={verificationState}
        isOffloading={isOffloading}
      />
    </>
  );
};
