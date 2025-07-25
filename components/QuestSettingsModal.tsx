import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
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

interface QuestSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  questId: string;
  projectId: string;
}

type TStatusType = 'active' | 'visible';

export const QuestSettingsModal: React.FC<QuestSettingsModalProps> = ({
  isVisible,
  onClose,
  questId,
  projectId
}) => {
  // const { t } = useLocalization();
  // TODO: add localization
  const { db, supabaseConnector } = system;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuestLoaded, setIsQuestLoaded] = useState(false);

  const { membership } = useUserPermissions(projectId || '', 'manage');
  const isOwner = membership === 'owner';

  const queryClient = useQueryClient();

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

  const handleToggleStatus = async (statusType: TStatusType) => {
    if (!questData) return;

    setIsSubmitting(true);

    let [visible, active] = [questData.visible, questData.active];

    let message = '';

    if (statusType === 'visible') {
      if (visible) {
        visible = false;
        active = false;
      } else {
        visible = true;
      }
      message = visible
        ? 'The quest has been made visible'
        : 'The quest has been made invisible';
    } else {
      if (!active) {
        visible = true;
        active = true;
      } else {
        active = false;
      }
      message = active
        ? 'The quest has been made active'
        : 'The quest has been made inactive';
    }

    try {
      await supabaseConnector.client
        .from('quest')
        .update({
          visible,
          active,
          last_updated: new Date().toISOString()
        })
        .match({ id: questId });
      refetch();

      Alert.alert('Success', message);
    } catch (error) {
      console.error('Error updating quest status:', error);
      Alert.alert('Error', 'Failed to update quest settings');
    } finally {
      setIsSubmitting(false);

      queryClient.removeQueries({
        queryKey: ['project', projectId],
        exact: false
      });

      queryClient.removeQueries({
        queryKey: ['quest', questId],
        exact: false
      });

      queryClient.removeQueries({
        queryKey: ['quests', 'by-project', projectId],
        exact: false
      });

      queryClient.removeQueries({
        queryKey: [
          'assets',
          'infinite',
          'by-quest',
          'with-tags-content',
          questId
        ],
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
                <Text style={sharedStyles.modalTitle}>{'Quest Settings'}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <SwitchBox
                title={'Visibility'}
                description={
                  questData?.visible
                    ? 'This quest is visible to other users.'
                    : 'This quest is hidden and will not be shown to other users. An invisible quest is also inactive.'
                }
                value={questData?.visible ?? false}
                onChange={() => handleToggleStatus('visible')}
                disabled={isSubmitting || !isQuestLoaded || !isOwner}
              />
              <SwitchBox
                title={'Active'}
                description={
                  questData?.active
                    ? 'This quest is currently active. An active quest is also visible.'
                    : 'This quest is inactive. No actions can be performed unless it is reactivated.'
                }
                value={questData?.active ?? false}
                onChange={() => handleToggleStatus('active')}
                disabled={isSubmitting || !isQuestLoaded || !isOwner}
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
