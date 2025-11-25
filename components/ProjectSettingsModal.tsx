import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
  updateProjectStatus,
  useProjectStatuses
} from '@/database_services/status/project';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { XIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';
import RNAlert from 'react-native-alert';
import { SwitchBox } from './SwitchBox';
import { Button } from './ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from './ui/drawer';
import { Icon } from './ui/icon';

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

      RNAlert.alert(t('success'), message);
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
    >
      <DrawerContent className="bg-background px-4 pb-4">
        <DrawerHeader className="flex-row items-center justify-between">
          <DrawerTitle>{t('projectSettings')}</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon">
              <Icon as={XIcon} size={24} />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <View className="flex-1 gap-4">
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
      </DrawerContent>
    </Drawer>
  );
};
