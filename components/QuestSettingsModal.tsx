import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
  updateQuestStatus,
  useQuestStatuses
} from '@/database_services/status/quest';
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
import React, { useEffect, useState } from 'react';
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

  const { membership } = useUserPermissions(projectId || '', 'manage');
  const isOwner = membership === 'owner';

  const layerStatus = useStatusContext();

  const {
    data: questData,
    isLoading,
    isError,
    refetch
  } = useQuestStatuses(questId);

  // Handle error in useEffect to avoid setState during render
  useEffect(() => {
    if (isError && isVisible) {
      Alert.alert(t('error'), t('questSettingsLoadError'));
      onClose();
    }
  }, [isError, isVisible, onClose, t]);

  if (isError) {
    return null;
  }

  const handleToggleVisible = async () => {
    if (!questData) return;

    setIsSubmitting(true);

    let [visible, active] = [questData.visible, questData.active];

    try {
      //      if (statusType === 'visible') {
      if (visible) {
        visible = false;
        active = false;
      } else {
        visible = true;
      }

      await updateQuestStatus(questId, { visible, active });
      refetch();
      layerStatus.setLayerStatus(LayerType.QUEST, { visible, active }, questId);

      Alert.alert(
        t('success'),
        questData.visible ? t('questMadeInvisible') : t('questMadeVisible')
      );
      //    }
    } catch (error) {
      console.log(error);
      Alert.alert(t('error'), t('failedToUpdateQuestSettings'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!questData) return;

    setIsSubmitting(true);

    let [visible, active] = [questData.visible, questData.active];

    try {
      if (!active) {
        visible = true;
        active = true;
      } else {
        active = false;
      }

      await updateQuestStatus(questId, { visible, active });
      refetch();
      layerStatus.setLayerStatus(LayerType.QUEST, { visible, active }, questId);

      // Localization keys:
      // success -> 'Success'
      // questMadeInactive -> 'The quest has been made inactive'
      // questMadeActive -> 'The quest has been made active'
      // error -> 'Error'
      // failedToUpdateQuestSettings -> 'Failed to update quest settings'
      Alert.alert(
        t('success'),
        questData.active ? t('questMadeInactive') : t('questMadeActive')
      );
    } catch (error) {
      console.log(error);
      Alert.alert(t('error'), t('failedToUpdateQuestSettings'));
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
                  {t('questSettings')}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <SwitchBox
                title={t('visibility')}
                description={
                  questData?.visible
                    ? t('visibleQuestDescription')
                    : t('invisibleQuestDescription')
                }
                value={questData?.visible ?? false}
                onChange={() => handleToggleVisible()}
                disabled={isSubmitting || isLoading || !isOwner}
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
                disabled={isSubmitting || isLoading || !isOwner}
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
    flex: 1,
    fontSize: fontSizes.small,
    color: colors.text,
    lineHeight: 20
  }
});
