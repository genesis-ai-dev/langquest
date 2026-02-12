import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
    updateProjectStatus,
    useProjectStatuses
} from '@/database_services/status/project';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import RNAlert from '@blazejkustra/react-native-alert';
import React, { useState } from 'react';
import { View } from 'react-native';
import { SwitchBox } from './SwitchBox';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';

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
      RNAlert.alert(t('error'), t('projectSettingsLoadError'));
      onClose();
    }
  }, [isError, onClose, t]);

  if (isError) {
    return null;
  }

  const handleToggleStatus = async (statusType: TProjectStatusType) => {
    if (!projectData || isSubmitting) return;
    setIsSubmitting(true);

    let privateProject = projectData.private;
    let visible = projectData.visible;
    let active = projectData.active;

    try {
      if (statusType === 'private') {
        privateProject = !privateProject;
      } else if (statusType === 'visible') {
        visible = !visible;
      } else {
        // Active switch is independent - only toggle active state
        active = !active;
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
    } catch (error) {
      console.error('Error updating project status:', error);
      RNAlert.alert(t('error'), t('failedToUpdateProjectSettings'));
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
          <DrawerTitle>{t('projectSettings')}</DrawerTitle>
        </DrawerHeader>

        <View className="flex-1 gap-2">
          <SwitchBox
            title={t('privateProject')}
            description={
              projectData?.private
                ? t('privateProjectDescription')
                : t('publicProjectDescription')
            }
            value={projectData?.private ?? false}
            onChange={() => handleToggleStatus('private')}
            disabled={isLoading || !isOwner}
            icon={projectData?.private ? 'lock' : 'lock-open'}
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
            disabled={isLoading || !isOwner}
            icon={projectData?.visible ? 'eye' : 'eye-off'}
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
            disabled={isLoading || !isOwner}
            icon={projectData?.active ? 'circle-check' : 'circle-x'}
          />
        </View>
      </DrawerContent>
    </Drawer>
  );
};
