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
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import type { AttachmentRecord } from '@powersync/attachments';
import { EyeOffIcon, HardDriveIcon, PauseIcon } from 'lucide-react-native';
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
  const { goToAsset, currentProjectData, currentQuestData } =
    useAppNavigation();
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
      active: asset.active && asset.quest_active,
      source: asset.source
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
        quest_visible: asset.quest_visible,
        source: asset.source
      },
      asset.id,
      questId
    );

    goToAsset({
      id: asset.id,
      name: asset.name || t('unnamedAsset'),
      questId: questId,
      projectId: asset.project_id!,
      projectData: currentProjectData, // Pass project data forward!
      questData: currentQuestData // Pass quest data forward!
      // NOTE: Don't pass assetData - the detail view needs full asset with content/audio
      // relationships which aren't loaded in the list view
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
                <View className="flex flex-row items-center gap-2">
                  {asset.source === 'local' && <Icon as={HardDriveIcon} />}
                  <CardTitle numberOfLines={2}>
                    {asset.name || t('unnamedAsset')}
                  </CardTitle>
                </View>
              </View>
              <DownloadIndicator
                isFlaggedForDownload={isDownloaded}
                isLoading={isDownloading}
                onPress={handleDownloadToggle}
                size={20}
              />
            </View>
            {SHOW_DEV_ELEMENTS && (
              <CardDescription>
                {`ID: ${asset.id.substring(0, 8)}...`}
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
