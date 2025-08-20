import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
  updateAssetStatus,
  useAssetStatuses
} from '@/database_services/status/asset';
import { useQuestById } from '@/hooks/db/useQuests';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SwitchBox } from './SwitchBox';

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

  const { currentProjectId, currentQuestId } = useCurrentNavigation();

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

  if (isError) {
    Alert.alert(t('error'), t('assetSettingsLoadError'));
    onClose();
    return null;
  }

  const assetData = statusData?.full;
  const assetQuestData = statusData?.currentQuest;

  const handleToggleStatusGeneral = async (statusType: TStatusType) => {
    if (!assetData) return;

    setIsSubmitting(true);
    try {
      let [visible, active] = [assetData.visible, assetData.active];

      if (statusType === 'visible') {
        if (visible) {
          visible = false;
          active = false;
        } else {
          visible = true;
        }
      } else {
        if (!active) {
          visible = true;
          active = true;
        } else {
          active = false;
        }
      }

      await updateAssetStatus('asset', assetId, { visible, active }, questId);
      refetch('asset');

      layerStatus.setLayerStatus(
        LayerType.ASSET,
        {
          visible,
          active,
          quest_active: assetQuestData?.active ?? true,
          quest_visible: assetQuestData?.visible ?? true
        },
        assetId,
        questId
      );

      const message =
        statusType === 'visible'
          ? assetData.visible
            ? t('assetMadeInvisibleAllQuests')
            : t('assetMadeVisibleAllQuests')
          : assetData.active
            ? t('assetMadeInactiveAllQuests')
            : t('assetMadeActiveAllQuests');

      Alert.alert(t('success'), message);
    } catch (error) {
      console.error('Error updating asset visibility / active:', error);
      Alert.alert(t('error'), t('failedToUpdateAssetSettings'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatusQuest = async (statusType: TStatusType) => {
    if (!assetQuestData) return;

    setIsSubmitting(true);
    try {
      let [visible, active] = [assetQuestData.visible, assetQuestData.active];

      if (statusType === 'visible') {
        if (visible) {
          visible = false;
          active = false;
        } else {
          visible = true;
        }
      } else {
        if (!active) {
          visible = true;
          active = true;
        } else {
          active = false;
        }
      }

      await updateAssetStatus(
        'asset_quest',
        assetId,
        { visible, active },
        questId
      );

      refetch('asset_quest');

      layerStatus.setLayerStatus(
        LayerType.ASSET,
        {
          visible: assetData?.visible ?? true,
          active: assetData?.active ?? true,
          quest_active: active,
          quest_visible: visible
        },
        assetId,
        questId
      );

      const message =
        statusType === 'visible'
          ? assetQuestData.visible
            ? t('assetMadeInvisibleQuest')
            : t('assetMadeVisibleQuest')
          : assetQuestData.active
            ? t('assetMadeInactiveQuest')
            : t('assetMadeActiveQuest');

      Alert.alert(t('success'), message);
    } catch (error) {
      console.error('Error updating asset visibility / active:', error);
      Alert.alert(t('error'), t('failedToUpdateAssetSettings'));
    } finally {
      setIsSubmitting(false);
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
        <Pressable style={sharedStyles.modalOverlay} onPress={onClose}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[sharedStyles.modal, styles.modalContainer]}>
              <View style={styles.header}>
                <Text style={sharedStyles.modalTitle}>
                  {t('assetSettings')}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {/* Changing settings to the Asset itself. This will affect all quests */}
              <Text style={styles.settingTitle}>{t('general')}</Text>
              <Text style={styles.infoText}>
                These settings affect how the asset behaves across all quests
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
                disabled={isSubmitting || isLoading || !isOwner}
              />

              <SwitchBox
                title={t('active')}
                description={
                  assetData?.visible
                    ? t('activeDescription')
                    : t('assetDisabledAllQuests')
                }
                value={assetData?.active ?? false}
                onChange={() => handleToggleStatusGeneral('active')}
                disabled={isSubmitting || isLoading || !isOwner}
              />

              <View style={{ height: 22 }} />

              {/* Changing settings to the Asset related to this quest only */}
              <Text style={styles.settingTitle}>{t('currentQuest')}</Text>
              <Text style={styles.infoText}>
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
                disabled={
                  isSubmitting || isLoading || !isOwner || !assetData?.active
                }
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
                disabled={
                  isSubmitting || isLoading || !isOwner || !assetData?.active
                }
              />
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    width: '90%',
    maxWidth: 400
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  closeButton: {
    padding: spacing.xsmall
  },
  content: {
    paddingVertical: spacing.small
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.medium
  },
  settingTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  settingDescription: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    padding: spacing.medium,
    borderRadius: borderRadius.medium,
    marginTop: spacing.medium,
    gap: spacing.small
  },
  infoText: {
    // flex: 1,
    fontSize: fontSizes.xsmall,
    color: colors.text,
    lineHeight: 20
  }
});
