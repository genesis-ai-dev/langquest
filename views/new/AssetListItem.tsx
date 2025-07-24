import { DownloadIndicator } from '@/components/DownloadIndicator';
import { useAuth } from '@/contexts/AuthContext';
import type { asset as asset_type } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import type { AttachmentRecord } from '@powersync/attachments';
// import { AttachmentState } from '@powersync/attachments';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenAssetsView';
import { useItemDownload, useItemDownloadStatus } from './useHybridData';

// Define props locally to avoid require cycle

type Asset = typeof asset_type.$inferSelect;
export interface AssetListItemProps {
  asset: Asset;
  attachmentState?: AttachmentRecord;
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
  attachmentState
}) => {
  const { goToAsset } = useAppNavigation();
  const { currentUser } = useAuth();

  // Check if asset is downloaded
  const isDownloaded = useItemDownloadStatus(asset, currentUser?.id);

  // Download mutation
  const { mutate: downloadAsset, isPending: isDownloading } = useItemDownload(
    'asset',
    asset.id
  );

  const handlePress = () => {
    goToAsset({
      id: asset.id,
      name: asset.name || 'Unnamed Asset'
    });
  };

  const handleDownloadToggle = () => {
    if (!currentUser?.id) return;

    // Toggle download status
    downloadAsset({ userId: currentUser.id, download: !isDownloaded });
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <View style={styles.listItem}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Text style={styles.assetName}>{asset.name || 'Unnamed Asset'}</Text>

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
