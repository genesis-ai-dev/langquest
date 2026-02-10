import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
    updateAssetStatus,
    useAssetStatuses
} from '@/database_services/status/asset';
import { useQuestById } from '@/hooks/db/useQuests';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import RNAlert from '@blazejkustra/react-native-alert';
import React, { useState } from 'react';
import { View } from 'react-native';
import { SwitchBox } from './SwitchBox';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Text } from './ui/text';

interface AssetSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  assetId: string;
}

type TStatusType = 'active' | 'visible';

export const AssetSettingsModal: React.FC<AssetSettingsModalProps> = ({
  isVisible,
  onClose,
  assetId
}) => {
  const { t } = useLocalization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [isAssetLoaded, setIsAssetLoaded] = useState(true);

  const { currentProjectId, currentQuestId } = useAppNavigation();

  const { quest } = useQuestById(currentQuestId);
  const questId = quest?.id || '';

  const { membership } = useUserPermissions(currentProjectId || '', 'manage');
  const isOwner = membership === 'owner';

  const layerStatus = useStatusContext();

  const {
    data: statusData,
    isLoading,
    isError,
    refetch
  } = useAssetStatuses(assetId, questId);

  React.useEffect(() => {
    if (isError) {
      RNAlert.alert(t('error'), t('assetSettingsLoadError'));
      onClose();
    }
  }, [isError, onClose, t]);

  const assetData = statusData?.full;
  const assetQuestData = statusData?.currentQuest;

  const handleToggleStatusGeneral = async (statusType: TStatusType) => {
    if (!assetData || isSubmitting) return;
    setIsSubmitting(true);

    let visible = assetData.visible;
    let active = assetData.active;

    try {
      if (statusType === 'visible') {
        // Visibility switch is independent - only toggle visible state
        visible = !visible;
      } else {
        // Active switch is independent - only toggle active state
        active = !active;
      }

      await updateAssetStatus(
        'asset',
        assetId,
        { visible, active },
        assetData.source,
        questId
      );
      refetch('asset');

      layerStatus.setLayerStatus(
        LayerType.ASSET,
        {
          visible,
          active,
          quest_active: assetQuestData?.active ?? true,
          quest_visible: assetQuestData?.visible ?? true,
          source: assetData.source
        },
        assetId,
        questId
      );
    } catch (error) {
      console.error('Error updating asset status:', error);
      RNAlert.alert(t('error'), t('failedToUpdateAssetSettings'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatusQuest = async (statusType: TStatusType) => {
    if (!assetQuestData || isSubmitting) return;
    setIsSubmitting(true);

    let visible = assetQuestData.visible;
    let active = assetQuestData.active;

    try {
      if (statusType === 'visible') {
        // Visibility switch is independent - only toggle visible state
        visible = !visible;
      } else {
        // Active switch is independent - only toggle active state
        active = !active;
      }

      await updateAssetStatus(
        'asset_quest',
        assetId,
        { visible, active },
        assetQuestData.source,
        questId
      );

      refetch('asset_quest');

      layerStatus.setLayerStatus(
        LayerType.ASSET,
        {
          visible: assetData?.visible ?? true,
          active: assetData?.active ?? true,
          quest_active: active,
          quest_visible: visible,
          source: assetQuestData.source
        },
        assetId,
        questId
      );
    } catch (error) {
      console.error('Error updating asset status:', error);
      RNAlert.alert(t('error'), t('failedToUpdateAssetSettings'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      open={isVisible && !isError}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      snapPoints={['80%']}
      enableDynamicSizing={false}
    >
      <DrawerContent className="bg-background pb-4">
        <DrawerHeader>
          <DrawerTitle>{t('assetSettings')}</DrawerTitle>
        </DrawerHeader>

        {!isError && (
          <View className="flex-1 gap-2">
            {/* Changing settings to the Asset itself. This will affect all quests */}
            <Text className="mb-1 text-base font-semibold">{t('general')}</Text>
            <Text className="mb-2 text-xs text-muted-foreground">
              {t('assetGeneralSettingsDescription')}
            </Text>
            <SwitchBox
              title={t('visibility')}
              description={
                assetData?.visible
                  ? t('visibilityDescription')
                  : t('assetHiddenAllQuests')
              }
              value={assetData?.visible ?? false}
              onChange={() => handleToggleStatusGeneral('visible')}
              disabled={isLoading || !isOwner}
              icon={assetData?.visible ? 'eye' : 'eye-off'}
            />

            <SwitchBox
              title={t('active')}
              description={
                assetData?.active
                  ? t('activeDescription')
                  : t('assetDisabledAllQuests')
              }
              value={assetData?.active ?? false}
              onChange={() => handleToggleStatusGeneral('active')}
              disabled={isLoading || !isOwner}
              icon={assetData?.active ? 'circle-check' : 'pause'}
            />

            <View className="h-6" />

            {/* Changing settings to the Asset related to this quest only */}
            <Text className="mb-1 text-base font-semibold">
              {t('currentQuest')}
            </Text>
            <Text className="mb-2 text-xs text-muted-foreground">
              {assetData?.active
                ? t('questSpecificSettingsDescription')
                : t('assetDisabledWarning')}
            </Text>

            <SwitchBox
              title={t('visibility')}
              description={
                assetQuestData?.visible
                  ? t('assetVisibleThisQuest')
                  : t('assetHiddenThisQuest')
              }
              value={assetQuestData?.visible ?? false}
              onChange={() => handleToggleStatusQuest('visible')}
              disabled={isLoading || !isOwner || !assetData?.active}
              icon={assetQuestData?.visible ? EyeIcon : EyeOffIcon}
            />

            <SwitchBox
              title={t('active')}
              description={
                assetQuestData?.active
                  ? t('assetActiveThisQuest')
                  : t('assetInactiveThisQuest')
              }
              value={assetQuestData?.active ?? false}
              onChange={() => handleToggleStatusQuest('active')}
              disabled={isLoading || !isOwner || !assetData?.active}
              icon={assetQuestData?.active ? 'circle-check' : 'pause'}
            />
          </View>
        )}
      </DrawerContent>
    </Drawer>
  );
};
