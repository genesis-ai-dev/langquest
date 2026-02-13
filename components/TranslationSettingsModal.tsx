import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
  updateTranslationStatus,
  useTranslationStatuses
} from '@/database_services/status/translation';
import { useLocalization } from '@/hooks/useLocalization';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Icon } from '@/components/ui/icon';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import RNAlert from '@blazejkustra/react-native-alert';
import { SwitchBox } from './SwitchBox';

interface TranslationSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  translationId: string;
}

type TStatusType = 'active' | 'visible';

export const TranslationSettingsModal: React.FC<
  TranslationSettingsModalProps
> = ({ isVisible, onClose, translationId }) => {
  const { t } = useLocalization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser } = useAuth();

  const {
    data: translationData,
    isLoading,
    isError,
    refetch
  } = useTranslationStatuses(translationId);

  if (isError) {
    RNAlert.alert(t('error'), t('translationSettingsLoadError'));
    onClose();
    return null;
  }

  const isOwnTranslation = currentUser?.id === translationData?.creator_id;
  const layerStatus = useStatusContext();

  const handleToggleStatus = async (statusType: TStatusType) => {
    if (!translationData) return;

    setIsSubmitting(true);

    let [visible, active] = [translationData.visible, translationData.active];

    let message = '';

    if (statusType === 'visible') {
      if (visible) {
        visible = false;
        active = false;
      } else {
        visible = true;
      }
      message = visible
        ? t('statusTranslationMadeVisible')
        : t('statusTranslationMadeInvisible');
    } else {
      if (!active) {
        visible = true;
        active = true;
      } else {
        active = false;
      }
      message = active
        ? t('statusTranslationMadeActive')
        : t('statusTranslationMadeInactive');
    }

    try {
      await updateTranslationStatus(translationId, { visible, active });
      layerStatus.setLayerStatus(
        LayerType.TRANSLATION,
        { visible, active, source: translationData?.source ?? 'synced' },
        translationId
      );
      refetch();

      RNAlert.alert(t('success'), message);
    } catch (error) {
      console.error('Error updating translation status:', error);
      RNAlert.alert(t('error'), t('statusTranslationUpdateFailed'));
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
                  {'Translation Settings'}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Icon as={X} size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <SwitchBox
                title={'Visibility'}
                description={
                  translationData?.visible
                    ? t('statusTranslationVisible')
                    : t('statusTranslationInvisible')
                }
                value={translationData?.visible ?? false}
                onChange={() => handleToggleStatus('visible')}
                disabled={isSubmitting || isLoading || !isOwnTranslation}
              />
              <SwitchBox
                title={'Active'}
                description={
                  translationData?.active
                    ? t('statusTranslationActive')
                    : t('statusTranslationInactive')
                }
                value={translationData?.active ?? false}
                onChange={() => handleToggleStatus('active')}
                disabled={isSubmitting || isLoading || !isOwnTranslation}
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
