import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
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
  const { t } = useLocalization();
  const { db, supabaseConnector } = system;
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrjLoaded, setIsPrjLoaded] = useState(false);

  const { membership } = useUserPermissions(projectId || '', 'manage');
  const isOwner = membership === 'owner';

  const { data: projectDataArray = [], refetch } = useHybridQuery({
    queryKey: ['project-settings', projectId],
    offlineQuery: toCompilableQuery(
      db.select().from(project).where(eq(project.id, projectId))
    ),
    onlineFn: async (): Promise<(typeof project.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', projectId)
        .limit(1);
      if (error) throw error;
      return data as (typeof project.$inferSelect)[];
    }
  });

  const projectData = projectDataArray[0];
  if (projectData != undefined && !isPrjLoaded) {
    setIsPrjLoaded(true);
  }

  /* To be aware -> The information here is coming from the cache */
  const [prjPrivate, setPrjPrivate] = useState(projectData?.private ?? false);
  const [prjVisible, setPrjVisible] = useState(projectData?.visible ?? false);
  const [prjActive, setPrjActive] = useState(projectData?.active ?? false);

  const handleToggleStatus = async (statusType: TProjectStatusType) => {
    if (!projectData) return;
    setIsSubmitting(true);

    let privateProject = prjPrivate;
    let visible = prjVisible;
    let active = prjActive;
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

      Alert.alert(t('success'), message);
    } catch (error) {
      console.error('Error updating project status:', error);
      Alert.alert(t('error'), t('failedToUpdateProjectSettings'));
    } finally {
      setIsSubmitting(false);
      setPrjPrivate(privateProject);
      setPrjVisible(visible);
      setPrjActive(active);

      // To reload projects in the main page
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
                  {t('projectSettings')}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <SwitchBox
                title={t('privateProject')}
                description={
                  prjPrivate
                    ? t('privateProjectDescription')
                    : t('publicProjectDescription')
                }
                value={prjPrivate}
                onChange={() => handleToggleStatus('private')}
                disabled={isSubmitting || !isPrjLoaded || !isOwner}
              />

              <SwitchBox
                title={t('visibility')}
                description={
                  prjVisible
                    ? t('visibleProjectDescription')
                    : t('invisibleProjectDescription')
                }
                value={prjVisible}
                onChange={() => handleToggleStatus('visible')}
                disabled={isSubmitting || !isPrjLoaded || !isOwner}
              />

              <SwitchBox
                title={t('active')}
                description={
                  prjActive
                    ? t('activeProjectDescription')
                    : t('inactiveProjectDescription')
                }
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
