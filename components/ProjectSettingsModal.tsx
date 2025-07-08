import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridSupabaseQuery } from '@/hooks/useHybridSupabaseQuery';
import { useLocalization } from '@/hooks/useLocalization';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
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
  const { db } = system;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query for project details
  const { data: projectDataArray = [], refetch } = useHybridSupabaseQuery({
    queryKey: ['project-settings', projectId],
    query: db.query.project.findMany({
      where: eq(project.id, projectId),
      limit: 1
    })
  });

  const projectData = projectDataArray[0];

  const handleTogglePrivate = async () => {
    if (!projectData) return;

    setIsSubmitting(true);
    try {
      await db
        .update(project)
        .set({
          private: !projectData.private,
          last_updated: new Date().toISOString()
        })
        .where(eq(project.id, projectId));

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
                    disabled={isSubmitting}
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
