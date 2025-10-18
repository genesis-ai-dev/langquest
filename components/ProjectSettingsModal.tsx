import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
  updateProjectStatus,
  useProjectStatuses
} from '@/database_services/status/project';
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

interface ProjectSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  projectId: string;
}

type TProjectStatusType = 'private' | 'visible' | 'active';

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isVisible,
  onClose,
  projectId
}) => {
  const { t } = useLocalization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { membership } = useUserPermissions(projectId || '', 'manage');
  const isOwner = membership === 'owner';

  const layerStatus = useStatusContext();

  const {
    data: projectData,
    isLoading,
    isError,
    refetch
  } = useProjectStatuses(projectId);

  React.useEffect(() => {
    if (isError) {
      Alert.alert(t('error'), t('projectSettingsLoadError'));
      onClose();
    }
  }, [isError]);

  if (isError) {
    return null;
  }

  const handleToggleStatus = async (statusType: TProjectStatusType) => {
    if (!projectData) return;
    setIsSubmitting(true);

    let privateProject = projectData.private;
    let visible = projectData.visible;
    let active = projectData.active;
    let message = '';

    try {
      if (statusType === 'private') {
        privateProject = !privateProject;
        message = privateProject
          ? t('projectMadePrivate')
          : t('projectMadePublic');
      } else if (statusType === 'visible') {
        if (visible) {
          visible = false;
          active = false;
        } else {
          visible = true;
        }
        message = visible ? t('projectMadeVisible') : t('projectMadeInvisible');
      } else {
        if (!active) {
          visible = true;
          active = true;
        } else {
          active = false;
        }
        message = active ? t('projectMadeActive') : t('projectMadeInactive');
      }

      await updateProjectStatus(
        projectId,
        {
          private: privateProject,
          visible,
          active
        },
        projectData.source
      );
      layerStatus.setLayerStatus(
        LayerType.PROJECT,
        { visible, active, source: projectData.source },
        projectId
      );

      refetch();

      Alert.alert(t('success'), message);
    } catch (error) {
      console.error('Error updating project status:', error);
      Alert.alert(t('error'), t('failedToUpdateProjectSettings'));
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
                  {t('projectSettings')}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <SwitchBox
                title={t('privateProject')}
                description={
                  projectData?.private
                    ? t('privateProjectDescription')
                    : t('publicProjectDescription')
                }
                value={projectData?.private ?? false}
                onChange={() => handleToggleStatus('private')}
                disabled={isSubmitting || isLoading || !isOwner}
              />

              <SwitchBox
                title={t('visibility')}
                description={
                  projectData?.visible
                    ? t('visibleProjectDescription')
                    : t('invisibleProjectDescription')
                }
                value={projectData?.visible ?? false}
                onChange={() => handleToggleStatus('visible')}
                disabled={isSubmitting || isLoading || !isOwner}
              />

              <SwitchBox
                title={t('active')}
                description={
                  projectData?.active
                    ? t('activeProjectDescription')
                    : t('inactiveProjectDescription')
                }
                value={projectData?.active ?? false}
                onChange={() => handleToggleStatus('active')}
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
