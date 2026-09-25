import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
  updateQuestStatus,
  useQuestStatuses
} from '@/database_services/status/quest';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { HybridDataSource } from '@/hooks/useHybridQuery';
import RNAlert from '@blazejkustra/react-native-alert';
import {
  CheckCircleIcon,
  CloudUpload,
  EyeIcon,
  EyeOffIcon,
  XCircleIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';
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
  questSource?: HybridDataSource;
  /** Present only when this quest can be offloaded. */
  onOffloadClick?: () => void;
}

// type TStatusType = 'active' | 'visible';

export const QuestSettingsModal: React.FC<QuestSettingsModalProps> = ({
  isVisible,
  onClose,
  questId,
  projectId,
  questSource,
  onOffloadClick
}) => {
  const { t } = useLocalization();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { membership } = useUserPermissions(projectId || '', 'manage');
  const isOwner = membership === 'owner';

  const layerStatus = useStatusContext();

  const {
    data: questData,
    isLoading,
    refetch
  } = useQuestStatuses(questId, questSource);

  const areSwitchesDisabled =
    isLoading || isSubmitting || !isOwner || !questData;

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

  return (
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
            disabled={areSwitchesDisabled}
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
            disabled={areSwitchesDisabled}
            icon={questData?.active ? CheckCircleIcon : XCircleIcon}
          />

          {/* Offload Quest Button */}
          {onOffloadClick && isOwner && (
            <View className="border-t border-border pt-4">
              <Button
                variant="outline"
                onPress={() => {
                  onClose();
                  onOffloadClick();
                }}
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
  );
};
