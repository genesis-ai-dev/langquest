import { project as projectTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { useLocalization } from '@/hooks/useLocalization';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

interface ProjectSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  projectId: string;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isVisible,
  onClose,
  projectId
}) => {
  const { t } = useLocalization();
  const { db, supabaseConnector } = system;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrjLoaded, setIsPrjLoaded] = useState(false);

  const { data: projectDataArray = [], refetch } = useHybridQuery({
    queryKey: ['project-settings', projectId],
    onlineFn: async (): Promise<(typeof projectTable.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', projectId)
        .limit(1);
      if (error) throw error;
      return data as (typeof projectTable.$inferSelect)[];
    },
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: eq(projectTable.id, projectId)
      })
    )
  });

  const projectData = projectDataArray[0];
  if (projectData != undefined && !isPrjLoaded) {
    setIsPrjLoaded(true);
  }

  const handleTogglePrivate = async () => {
    if (!projectData) return;

    setIsSubmitting(true);
    try {
      await supabaseConnector.client
        .from('project')
        .update({
          private: !projectData.private,
          last_updated: new Date().toISOString()
        })
        .match({ id: projectId });

      await refetch();
      Alert.alert(
        'Success',
        projectData.private
          ? 'The project has been made public'
          : 'The project has been made private'
      );
    } catch (error) {
      console.error('Error updating project privacy:', error);
      Alert.alert('Error', 'Failed to update project settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVisible = async () => {
    if (!projectData) return;

    setIsSubmitting(true);
    try {
      let [visible, active] = [projectData.visible, projectData.active];

      if (visible) {
        visible = false;
        active = false;
      } else {
        visible = true;
      }

      await supabaseConnector.client
        .from('project')
        .update({
          visible,
          active,
          last_updated: new Date().toISOString()
        })
        .match({ id: projectId });

      await refetch();

      Alert.alert(
        'Success',
        projectData.visible
          ? 'The project has been made invisible'
          : 'The project has been made visible'
      );
    } catch (error) {
      console.error('Error updating project visibility:', error);
      Alert.alert('Error', 'Failed to update project settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!projectData) return;

    setIsSubmitting(true);
    try {
      let [visible, active] = [projectData.visible, projectData.active];

      if (!active) {
        visible = true;
        active = true;
      } else {
        active = false;
      }

      await supabaseConnector.client
        .from('project')
        .update({
          visible,
          active,
          last_updated: new Date().toISOString()
        })
        .match({ id: projectId });

      await refetch();
      Alert.alert(
        'Success',
        projectData.active
          ? 'The project has been made inactive'
          : 'The project has been made active'
      );
    } catch (error) {
      console.error('Error updating project active status:', error);
      Alert.alert('Error', 'Failed to update project settings');
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
                  {'Project Settings'}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>{'Private Project'}</Text>
                    <Text style={styles.settingDescription}>
                      {projectData?.private
                        ? 'This project is private. Anyone can see it, but only members can contribute to it.'
                        : 'This project is public. Anyone can contribute to it.'}
                    </Text>
                  </View>
                  <Switch
                    value={projectData?.private ?? false}
                    onValueChange={handleTogglePrivate}
                    disabled={isSubmitting || !isPrjLoaded}
                    trackColor={{
                      false: colors.disabled,
                      true: colors.primary
                    }}
                    thumbColor={
                      projectData?.private ? colors.primary : colors.disabled
                    }
                  />
                </View>
              </View>

              <View style={styles.content}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>{'Visibility'}</Text>
                    <Text style={styles.settingDescription}>
                      {projectData?.visible
                        ? 'This project is visible to other users.'
                        : 'This project is hidden and will not be shown to other users. An invisible project is also inactive.'}
                    </Text>
                  </View>
                  <Switch
                    value={projectData?.visible ?? false}
                    onValueChange={handleToggleVisible}
                    disabled={isSubmitting || !isPrjLoaded}
                    trackColor={{
                      false: colors.disabled,
                      true: colors.primary
                    }}
                    thumbColor={
                      projectData?.visible ? colors.primary : colors.disabled
                    }
                  />
                </View>
              </View>

              <View style={styles.content}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>{'Active'}</Text>
                    <Text style={styles.settingDescription}>
                      {projectData?.active
                        ? 'This project is currently active. An active project is also visible.'
                        : 'This project is inactive. No actions can be performed unless it is reactivated.'}
                    </Text>
                  </View>
                  <Switch
                    value={projectData?.active ?? false}
                    onValueChange={handleToggleActive}
                    disabled={isSubmitting || !isPrjLoaded}
                    trackColor={{
                      false: colors.disabled,
                      true: colors.primary
                    }}
                    thumbColor={
                      projectData?.active ? colors.primary : colors.disabled
                    }
                  />
                </View>
              </View>
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
