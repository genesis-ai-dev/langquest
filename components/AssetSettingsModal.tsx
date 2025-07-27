import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
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

interface AssetSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  assetId: string;
  questId: string;
}

type TStatusType = 'active' | 'visible';

export const AssetSettingsModal: React.FC<AssetSettingsModalProps> = ({
  isVisible,
  onClose,
  assetId,
  questId
}) => {
  // const { t } = useLocalization();
  // TODO: add localization
  const { db, supabaseConnector } = system;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssetLoaded, setIsAssetLoaded] = useState(false);

  const { currentProjectId } = useCurrentNavigation();

  const { membership } = useUserPermissions(currentProjectId || '', 'manage');
  const isOwner = membership === 'owner';

  const queryClient = useQueryClient();

  const { data: assetDataArray = [], refetch: refetchAsset } = useHybridQuery({
    queryKey: ['asset-settings', assetId],
    onlineFn: async (): Promise<(typeof asset.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('asset')
        .select('*')
        .match({ id: assetId })
        .limit(1);
      if (error) throw error;
      return data as (typeof asset.$inferSelect)[];
    },
    offlineQuery: toCompilableQuery(
      db.query.asset.findMany({
        where: eq(asset.id, assetId)
      })
    )
  });

  const { data: assetQuestDataArray = [], refetch: refetchAssetQuest } =
    useHybridQuery({
      queryKey: ['quest-asset-settings', questId + assetId],
      onlineFn: async (): Promise<(typeof quest_asset_link.$inferSelect)[]> => {
        const { data, error } = await supabaseConnector.client
          .from('quest_asset_link')
          .select('*')
          .match({ quest_id: questId, asset_id: assetId })
          .limit(1);
        if (error) throw error;
        return data as (typeof quest_asset_link.$inferSelect)[];
      },
      offlineQuery: toCompilableQuery(
        db.query.quest_asset_link.findMany({
          where:
            (eq(quest_asset_link.quest_id, questId),
            eq(quest_asset_link.asset_id, assetId))
        })
      )
    });

  const assetData = assetDataArray[0];
  const assetQuestData = assetQuestDataArray[0];

  if (assetData != undefined && assetQuestData != undefined && !isAssetLoaded) {
    setIsAssetLoaded(true);
  }

  const handleToggleStatusGeneral = async (statusType: TStatusType) => {
    if (!assetData) return;

    setIsSubmitting(true);
    try {
      let [visible, active] = [assetData.visible, assetData.active];

      if (statusType === 'visible') {
        if (visible) {
          visible = false;
          active = false;
        } else {
          visible = true;
        }
      } else {
        if (!active) {
          visible = true;
          active = true;
        } else {
          active = false;
        }
      }

      await supabaseConnector.client
        .from('asset')
        .update({
          visible,
          active,
          last_updated: new Date().toISOString()
        })
        .match({ id: assetId });

      refetchAsset();

      const message =
        statusType === 'visible'
          ? assetData.visible
            ? 'The asset has been made invisible for all quests'
            : 'The asset has been made visible for all quests'
          : assetData.active
            ? 'The asset has been made inactive for all quests'
            : 'The asset has been made active for all quests';

      Alert.alert('Success', message);
    } catch (error) {
      console.error('Error updating asset visibility / active:', error);
      Alert.alert('Error', 'Failed to update asset settings');
    } finally {
      setIsSubmitting(false);
      removeCachedQueries();
    }
  };

  const handleToggleStatusQuest = async (statusType: TStatusType) => {
    if (!assetQuestData) return;

    setIsSubmitting(true);
    try {
      let [visible, active] = [assetQuestData.visible, assetQuestData.active];

      if (statusType === 'visible') {
        if (visible) {
          visible = false;
          active = false;
        } else {
          visible = true;
        }
      } else {
        if (!active) {
          visible = true;
          active = true;
        } else {
          active = false;
        }
      }

      await supabaseConnector.client
        .from('quest_asset_link')
        .update({
          visible,
          active,
          last_updated: new Date().toISOString()
        })
        .match({ quest_id: questId, asset_id: assetId });

      refetchAssetQuest();

      const message =
        statusType === 'visible'
          ? assetQuestData.visible
            ? 'The asset has been made invisible for this quest'
            : 'The asset has been made visible for this quest'
          : assetQuestData.active
            ? 'The asset has been made inactive for this quest'
            : 'The asset has been made active for this quest';

      Alert.alert('Success', message);
    } catch (error) {
      console.error('Error updating asset visibility / active:', error);
      Alert.alert('Error', 'Failed to update asset settings');
    } finally {
      setIsSubmitting(false);
      removeCachedQueries();
    }
  };

  function removeCachedQueries() {
    const allQueries = queryClient.getQueryCache().findAll();
    const filtered: string[][] = [];
    allQueries.map((query) => {
      if (
        query.queryKey.some(
          (key) =>
            typeof key === 'string' &&
            (key.includes(assetId) || key.includes(questId))
        ) &&
        (query.queryKey[0] == 'asset' ||
          query.queryKey[0] == 'assets' ||
          query.queryKey[0] == 'asset-content' ||
          query.queryKey[0] == 'translation' ||
          query.queryKey[0] == 'quest' ||
          query.queryKey[0] == 'quest-asset-link')
      )
        filtered.push(query.queryKey as string[]);
    });

    filtered.map((qKey) =>
      queryClient.removeQueries({
        queryKey: qKey,
        exact: false
      })
    );
  }

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
                <Text style={sharedStyles.modalTitle}>{'Asset Settings'}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {/* Changing settings to the Asset itself. This will affect all quests */}
              <Text style={styles.settingTitle}>{'General'}</Text>
              <Text style={styles.infoText}>
                {
                  "These settings apply to the asset across all quests it's linked to"
                }
              </Text>
              <SwitchBox
                title={'Visibility'}
                description={
                  assetData?.visible
                    ? 'The asset is visible by default in all quests, unless hidden individually.'
                    : 'The asset is hidden in all quests and cannot be made visible in any of them.'
                }
                value={assetData?.visible ?? false}
                onChange={() => handleToggleStatusGeneral('visible')}
                disabled={isSubmitting || !isAssetLoaded || !isOwner}
              />

              <SwitchBox
                title={'Active'}
                description={
                  assetData?.visible
                    ? 'The asset is active and can be used in all quests, unless deactivated individually.'
                    : 'The asset is disabled across all quests and cannot be used anywhere.'
                }
                value={assetData?.active ?? false}
                onChange={() => handleToggleStatusGeneral('active')}
                disabled={isSubmitting || !isAssetLoaded || !isOwner}
              />

              <View style={{ height: 22 }} />

              {/* Changing settings to the Asset related to this quest only */}
              <Text style={styles.settingTitle}>{'Current Quest'}</Text>
              <Text style={styles.infoText}>
                {assetData?.active
                  ? 'These settings affect how the asset behaves in this specific quest'
                  : "⚠️ This asset is disabled across all quests. You can't change its settings for this quest."}
              </Text>

              <SwitchBox
                title={'Visibility'}
                description={
                  assetQuestData?.visible
                    ? 'The asset is shown in this quest. Unless hidden globally.'
                    : 'The asset is hidden in this quest.'
                }
                value={assetQuestData?.visible ?? false}
                onChange={() => handleToggleStatusQuest('visible')}
                disabled={
                  isSubmitting ||
                  !isAssetLoaded ||
                  !isOwner ||
                  !assetData?.active
                }
              />

              <SwitchBox
                title={'Active'}
                description={
                  assetQuestData?.active
                    ? 'The asset can be used in this quest. Unless deactivated globally.'
                    : 'The asset is not available in this quest.'
                }
                value={assetQuestData?.active ?? false}
                onChange={() => handleToggleStatusQuest('active')}
                disabled={
                  isSubmitting ||
                  !isAssetLoaded ||
                  !isOwner ||
                  !assetData?.active
                }
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
    // flex: 1,
    fontSize: fontSizes.xsmall,
    color: colors.text,
    lineHeight: 20
  }
});
