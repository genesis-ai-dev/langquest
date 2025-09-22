import { DownloadIndicator } from '@/components/DownloadIndicator';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { asset as asset_type } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import type { AttachmentRecord } from '@powersync/attachments';
import { EyeOffIcon, PauseIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
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
}

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
      visible: (asset.visible ?? true) && (asset.quest_visible ?? true),
      active: (asset.active ?? true) && (asset.quest_active ?? true)
    },
    questId
  );

  const handlePress = () => {
    layerStatus.setLayerStatus(
      LayerType.ASSET,
      {
        visible: asset.visible ?? true,
        active: asset.active ?? true,
        quest_active: asset.quest_active ?? true,
        quest_visible: asset.quest_visible ?? true
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
    <Pressable onPress={handlePress}>
      <Card
        className={`${!allowEditing ? 'opacity-50' : ''} ${invisible ? 'opacity-30' : ''}`}
      >
        <CardHeader className="flex flex-row items-start justify-between">
          <View className="flex flex-1 gap-1">
            <View className="flex flex-row items-center">
              <View className="flex flex-1 flex-row gap-2">
                {(!allowEditing || invisible) && (
                  <View className="flex flex-row gap-1.5">
                    {invisible && (
                      <Icon
                        as={EyeOffIcon}
                        className="text-secondary-foreground"
                      />
                    )}
                    {!allowEditing && (
                      <Icon
                        as={PauseIcon}
                        className="text-secondary-foreground"
                      />
                    )}
                  </View>
                )}
                <CardTitle numberOfLines={2} className="flex flex-1">
                  {asset.name || t('unnamedAsset')}
                </CardTitle>
              </View>
              <DownloadIndicator
                isFlaggedForDownload={isDownloaded}
                isLoading={isDownloading}
                onPress={handleDownloadToggle}
                size={20}
              />
            </View>
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
            {SHOW_DEV_ELEMENTS && (
              <CardDescription>
                ID: {asset.id.substring(0, 8)}...
              </CardDescription>
            )}
          </View>
        </CardHeader>
        {/* <CardContent>
          <Text className="text-xs text-secondary-foreground">
          </Text>
        </CardContent> */}
      </Card>
    </Pressable>
  );
};
