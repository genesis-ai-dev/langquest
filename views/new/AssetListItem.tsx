import type { Asset } from '@/hooks/db/useAssets';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors } from '@/styles/theme';
import type { AttachmentRecord } from '@powersync/attachments';
import { AttachmentState } from '@powersync/attachments';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenAssetsView';

// Define props locally to avoid require cycle
export interface AssetListItemProps {
  asset: Asset & { source?: string };
  attachmentState?: AttachmentRecord;
}

function renderSourceTag(source: string | undefined) {
  if (source === 'cloudSupabase') {
    return <Text style={{ color: 'red' }}>Cloud</Text>;
  }
  return <Text style={{ color: 'blue' }}>Offline</Text>;
}

function renderAttachmentState(attachmentState: AttachmentRecord | undefined) {
  if (!attachmentState) {
    return (
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
        📎 No attachment data
      </Text>
    );
  }

  const stateEmoji = {
    [AttachmentState.QUEUED_SYNC]: '⏳',
    [AttachmentState.QUEUED_DOWNLOAD]: '📥',
    [AttachmentState.SYNCED]: '✅'
  };

  const stateName = {
    [AttachmentState.QUEUED_SYNC]: 'Queued',
    [AttachmentState.QUEUED_DOWNLOAD]: 'Downloading',
    [AttachmentState.SYNCED]: 'Synced'
  };

  const stateColor = {
    [AttachmentState.QUEUED_SYNC]: colors.textSecondary,
    [AttachmentState.QUEUED_DOWNLOAD]: colors.primary,
    [AttachmentState.SYNCED]: colors.success
  };

  return (
    <Text
      style={{
        color:
          stateColor[attachmentState.state as keyof typeof stateColor] ||
          colors.textSecondary,
        fontSize: 12,
        fontWeight:
          attachmentState.state === AttachmentState.QUEUED_DOWNLOAD
            ? 'bold'
            : 'normal'
      }}
    >
      📎 {stateEmoji[attachmentState.state as keyof typeof stateEmoji] || '❓'}{' '}
      {stateName[attachmentState.state as keyof typeof stateName] ||
        `State ${attachmentState.state}`}
    </Text>
  );
}

export const AssetListItem: React.FC<AssetListItemProps> = ({
  asset,
  attachmentState
}) => {
  const { goToAsset } = useAppNavigation();

  const handlePress = () => {
    goToAsset({
      id: asset.id,
      name: asset.name
    });
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
          {renderSourceTag(asset.source)}
          {renderAttachmentState(attachmentState)}
        </View>
        <Text style={styles.assetName}>{asset.name}</Text>
        <Text style={styles.assetInfo}>ID: {asset.id.substring(0, 8)}...</Text>
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
