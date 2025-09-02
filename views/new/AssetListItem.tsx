import { DownloadIndicator } from '@/components/DownloadIndicator';
import { useAuth } from '@/contexts/AuthContext';
import type { asset as asset_type } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import type { AttachmentRecord } from '@powersync/attachments';
// import { AttachmentState } from '@powersync/attachments';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { useLocalization } from '@/hooks/useLocalization';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useItemDownload, useItemDownloadStatus } from './useHybridData';

// Define props locally to avoid require cycle

type Asset = typeof asset_type.$inferSelect;

type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
};
export interface AssetListItemProps {
  asset: AssetQuestLink;
  questId: string;
  attachmentState?: AttachmentRecord;
  onPress?: (asset: Asset) => void;
}

// function renderSourceTag(source: string | undefined) {
//   if (source === 'cloudSupabase') {
//     return <Text style={{ color: 'red' }}>Cloud</Text>;
//   }
//   return <Text style={{ color: 'blue' }}>Offline</Text>;
// }

// function renderAttachmentState(attachmentState: AttachmentRecord | undefined) {
//   if (!attachmentState) {
//     return (
//       <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
//         📎 No attachment data
//       </Text>
//     );
//   }

//   const stateEmoji = {
//     [AttachmentState.QUEUED_SYNC]: '⏳',
//     [AttachmentState.QUEUED_DOWNLOAD]: '📥',
//     [AttachmentState.SYNCED]: '✅'
//   };

//   const stateName = {
//     [AttachmentState.QUEUED_SYNC]: 'Queued',
//     [AttachmentState.QUEUED_DOWNLOAD]: 'Downloading',
//     [AttachmentState.SYNCED]: 'Synced'
//   };

//   const stateColor = {
//     [AttachmentState.QUEUED_SYNC]: colors.textSecondary,
//     [AttachmentState.QUEUED_DOWNLOAD]: colors.primary,
//     [AttachmentState.SYNCED]: colors.success
//   };

//   return (
//     <Text
//       style={{
//         color:
//           stateColor[attachmentState.state as keyof typeof stateColor] ||
//           colors.textSecondary,
//         fontSize: 12,
//         fontWeight:
//           attachmentState.state === AttachmentState.QUEUED_DOWNLOAD
//             ? 'bold'
//             : 'normal'
//       }}
//     >
//       📎 {stateEmoji[attachmentState.state as keyof typeof stateEmoji] || '❓'}{' '}
//       {stateName[attachmentState.state as keyof typeof stateName] ||
//         `State ${attachmentState.state}`}
//     </Text>
//   );
// }

export const AssetListItem: React.FC<AssetListItemProps> = ({
  asset,
  questId,
  attachmentState
}) => {
  const { goToAsset } = useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  // Check if asset is downloaded
  const isDownloaded = useItemDownloadStatus(asset, currentUser?.id);

  // Download mutation
  const { mutate: downloadAsset, isPending: isDownloading } = useItemDownload(
    'asset',
    asset.id
  );

  const layerStatus = useStatusContext();
  const { allowEditing, invisible } = layerStatus.getStatusParams(
    LayerType.ASSET,
    asset.id || '',
    {
      visible: asset.visible && asset.quest_visible,
      active: asset.active && asset.quest_active
    },
    questId
  );

  const handlePress = () => {
    layerStatus.setLayerStatus(
      LayerType.ASSET,
      {
        visible: asset.visible,
        active: asset.active,
        quest_active: asset.quest_active,
        quest_visible: asset.quest_visible
      },
      asset.id,
      questId
    );

    goToAsset({
      id: asset.id,
      name: asset.name || t('unnamedAsset')
    });
  };

  const handleDownloadToggle = () => {
    if (!currentUser?.id) return;

    // Toggle download status
    downloadAsset({ userId: currentUser.id, download: !isDownloaded });
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <View
        style={[
          styles.listItem,
          !allowEditing && sharedStyles.disabled,
          invisible && sharedStyles.invisible
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Text style={styles.assetName}>
            {asset.name || t('unnamedAsset')}
          </Text>

          <DownloadIndicator
            isFlaggedForDownload={isDownloaded}
            isLoading={isDownloading}
            onPress={handleDownloadToggle}
            size={20}
          />
        </View>

        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {SHOW_DEV_ELEMENTS && (
          <Text style={styles.assetInfo}>
            ID: {asset.id.substring(0, 8)}...
          </Text>
        )}

        {attachmentState && (
          <View
            style={{
              marginTop: 4,
              padding: 6,
              backgroundColor: '#f8f9fa',
              borderRadius: 4
            }}
          >
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>
              Last Updated:{' '}
              {new Date(attachmentState.timestamp || 0).toLocaleTimeString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  listItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    marginBottom: spacing.small,
    gap: spacing.xsmall
  },
  assetName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  assetInfo: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  }
});
