import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
// import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
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
  // const { t } = useLocalization();
  const { db, supabaseConnector } = system;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrjLoaded, setIsPrjLoaded] = useState(false);

  const { membership } = useUserPermissions(projectId || '', 'manage');
  const isOwner = membership === 'owner';

  const queryClient = useQueryClient();

  const { data: projectDataArray = [], refetch } = useHybridQuery({
    queryKey: ['project-settings', projectId],
    onlineFn: async (): Promise<(typeof project.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', projectId)
        .limit(1);
      if (error) throw error;
      return data as (typeof project.$inferSelect)[];
    },
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: eq(project.id, projectId)
      })
    )
  });

  const projectData = projectDataArray[0];
  if (projectData != undefined && !isPrjLoaded) {
    setIsPrjLoaded(true);
  }

  /* To be awared -> The information here is coming from the cache */
  const [prjPrivate, setPrjPrivate] = useState(projectData?.private ?? false);
  const [prjVisible, setPrjVisible] = useState(projectData?.visible ?? false);
  const [prjActive, setPrjActive] = useState(projectData?.active ?? false);

  const handleToggleStatus = async (statusType: TProjectStatusType) => {
    if (!projectData) return;
    setIsSubmitting(true);

    let [privateProject, visible, active] = [prjPrivate, prjVisible, prjActive];
    let message = '';

    if (statusType === 'private') {
      privateProject = !privateProject;
      message = privateProject
        ? 'The project has been made private'
        : 'The project has been made public';
    } else if (statusType === 'visible') {
      if (visible) {
        visible = false;
        active = false;
      } else {
        visible = true;
      }
      message = visible
        ? 'The project has been made visible'
        : 'The project has been made invisible';
    } else {
      if (!active) {
        visible = true;
        active = true;
      } else {
        active = false;
      }
      message = active
        ? 'The project has been made active'
        : 'The project has been made inactive';
    }

    try {
      await supabaseConnector.client
        .from('project')
        .update({
          private: privateProject,
          visible,
          active,
          last_updated: new Date().toISOString()
        })
        .match({ id: projectId });
      refetch();

      Alert.alert('Success', message);
    } catch (error) {
      console.error('Error updating project status:', error);
      Alert.alert('Error', 'Failed to update project settings');
    } finally {
      setIsSubmitting(false);
      setPrjPrivate(privateProject);
      setPrjVisible(visible);
      setPrjActive(active);

      // /* To reload projects in the main page */
      // await queryClient.invalidateQueries({
      //   queryKey: ['projects', 'infinite', 10, 'name', 'asc', 'online']
      // });

      queryClient.removeQueries({
        queryKey: ['projects'],
        exact: false
      });

      queryClient.removeQueries({
        queryKey: ['project', projectId],
        exact: false
      });
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
                  {'Project Settings'}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <SwitchBox
                title={'Private Project'}
                description={
                  projectData?.private
                    ? 'This project is private. Anyone can see it, but only members can contribute to it.'
                    : 'This project is public. Anyone can contribute to it.'
                }
                // value={projectData?.private ?? false}
                value={prjPrivate}
                onChange={() => handleToggleStatus('private')}
                disabled={isSubmitting || !isPrjLoaded || !isOwner}
              />

              <SwitchBox
                title={'Visibility'}
                description={
                  projectData?.visible
                    ? 'This project is visible to other users.'
                    : 'This project is hidden and will not be shown to other users. An invisible project is also inactive.'
                }
                // value={projectData?.visible ?? false}
                value={prjVisible}
                onChange={() => handleToggleStatus('visible')}
                disabled={isSubmitting || !isPrjLoaded || !isOwner}
              />

              <SwitchBox
                title={'Active'}
                description={
                  projectData?.active
                    ? 'This project is currently active. An active project is also visible.'
                    : 'This project is inactive. No actions can be performed unless it is reactivated.'
                }
                // value={projectData?.active ?? false}
                value={prjActive}
                onChange={() => handleToggleStatus('active')}
                disabled={isSubmitting || !isPrjLoaded || !isOwner}
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
