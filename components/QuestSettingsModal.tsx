import { useSessionMemberships } from '@/contexts/SessionCacheContext';
import { quest } from '@/db/drizzleSchema';
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

interface QuestSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  questId: string;
  projectId: string;
}

export const QuestSettingsModal: React.FC<QuestSettingsModalProps> = ({
  isVisible,
  onClose,
  questId,
  projectId
}) => {
  const { t } = useLocalization();
  const { db, supabaseConnector } = system;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuestLoaded, setIsQuestLoaded] = useState(false);

  const { isUserOwner } = useSessionMemberships();
  const isOwner = projectId ? isUserOwner(projectId) : false;

  const { data: questDataArray = [], refetch } = useHybridQuery({
    queryKey: ['quest-settings', questId],
    onlineFn: async (): Promise<(typeof quest.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', questId)
        .limit(1);

      if (error) throw error;
      return data as (typeof quest.$inferSelect)[];
    },
    offlineQuery: toCompilableQuery(
      db.query.quest.findMany({
        where: eq(quest.id, questId)
      })
    )
  });

  const questData = questDataArray[0];

  if (questData != undefined && !isQuestLoaded) {
    setIsQuestLoaded(true);
  }

  const handleToggleVisible = async () => {
    if (!questData) return;

    setIsSubmitting(true);
    try {
      let [visible, active] = [questData.visible, questData.active];

      if (visible) {
        visible = false;
        active = false;
      } else {
        visible = true;
      }

      await supabaseConnector.client
        .from('quest')
        .update({
          visible,
          active,
          last_updated: new Date().toISOString()
        })
        .match({ id: questId });

      await refetch();

      Alert.alert(
        'Success',
        questData.visible
          ? 'The quest has been made invisible'
          : 'The quest has been made visible'
      );
    } catch (error) {
      console.error('Error updating quest visibility:', error);
      Alert.alert('Error', 'Failed to update quest settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!questData) return;

    setIsSubmitting(true);
    try {
      let [visible, active] = [questData.visible, questData.active];

      if (!active) {
        visible = true;
        active = true;
      } else {
        active = false;
      }

      await supabaseConnector.client
        .from('quest')
        .update({
          visible,
          active,
          last_updated: new Date().toISOString()
        })
        .match({ id: questId });

      await refetch();

      Alert.alert(
        'Success',
        questData.active
          ? 'The quest has been made inactive'
          : 'The quest has been made active'
      );
    } catch (error) {
      console.error('Error updating quest active status:', error);
      Alert.alert('Error', 'Failed to update quest settings');
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
                <Text style={sharedStyles.modalTitle}>{'Quest Settings'}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>{'Visibility'}</Text>
                    <Text style={styles.settingDescription}>
                      {questData?.visible
                        ? 'This quest is visible to other users.'
                        : 'This quest is hidden and will not be shown to other users. An invisible quest is also inactive.'}
                    </Text>
                  </View>
                  <Switch
                    value={questData?.visible ?? false}
                    onValueChange={handleToggleVisible}
                    disabled={isSubmitting || !isQuestLoaded || !isOwner}
                    trackColor={{
                      false: colors.disabled,
                      true: colors.primary
                    }}
                    thumbColor={
                      questData?.visible ? colors.primary : colors.disabled
                    }
                  />
                </View>
              </View>

              <View style={styles.content}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>{'Active'}</Text>
                    <Text style={styles.settingDescription}>
                      {questData?.active
                        ? 'This quest is currently active. An active quest is also visible.'
                        : 'This quest is inactive. No actions can be performed unless it is reactivated.'}
                    </Text>
                  </View>
                  <Switch
                    value={questData?.active ?? false}
                    onValueChange={handleToggleActive}
                    disabled={isSubmitting || !isQuestLoaded || !isOwner}
                    trackColor={{
                      false: colors.disabled,
                      true: colors.primary
                    }}
                    thumbColor={
                      questData?.active ? colors.primary : colors.disabled
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
