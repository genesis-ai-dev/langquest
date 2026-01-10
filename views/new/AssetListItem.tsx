import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { useAudio } from '@/contexts/AudioContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { asset as asset_type } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import type { AttachmentRecord } from '@powersync/attachments';
import {
  CheckCircleIcon,
  ChevronRightIcon,
  CircleIcon,
  EyeOffIcon,
  HardDriveIcon,
  PauseIcon,
  PlayIcon
} from 'lucide-react-native';
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
  isCurrentlyPlaying?: boolean;
  // Selection mode props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onPress?: () => void;
  // Play functionality
  onPlay?: (assetId: string) => void;
  // Detail view navigation
  onDetailPress?: () => void;
}

export const AssetListItem: React.FC<AssetListItemProps> = ({
  asset,
  questId,
  attachmentState,
  isCurrentlyPlaying = false,
  isSelectionMode = false,
  isSelected = false,
  onLongPress,
  onPress,
  onPlay,
  onDetailPress
}) => {
  const { goToAsset, currentProjectData, currentQuestData } =
    useAppNavigation();
  const { currentUser } = useAuth();
  const audioContext = useAudio();
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

  // Check if this asset is playing individually (not in play-all mode)
  const isPlayingIndividually =
    audioContext.isPlaying && audioContext.currentAudioId === asset.id;

  const handleCardPress = () => {
    if (isSelectionMode && onPress) {
      // In selection mode, toggle selection
      onPress();
    } else if (onPlay) {
      // Normal mode with play handler - play/pause
      onPlay(asset.id);
    } else {
      // Fallback: navigate to detail view
      handleDetailPress();
    }
  };

  const handleDetailPress = () => {
    if (onDetailPress) {
      onDetailPress();
      return;
    }

    // Default behavior: navigate to asset detail
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
      projectData: currentProjectData,
      questData: currentQuestData
    });
  };

  const handleDownloadToggle = () => {
    if (!currentUser?.id) return;

    // Toggle download status
    downloadAsset({ userId: currentUser.id, download: !isDownloaded });
  };

  const handlePlayPress = () => {
    if (onPlay) {
      onPlay(asset.id);
    }
  };

  const handleDetailPressButton = () => {
    handleDetailPress();
  };

  return (
    <Pressable
      onPress={handleCardPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Card
        className={`${!allowEditing ? 'opacity-50' : ''} ${invisible ? 'opacity-30' : ''} ${isCurrentlyPlaying || isPlayingIndividually ? 'border-2 border-primary bg-primary/5' : ''} ${isSelected ? 'border-primary bg-primary/10' : ''}`}
      >
        <CardHeader className="flex flex-row items-start justify-between">
          <View className="flex flex-1 gap-1">
            <View className="flex flex-row items-center gap-2">
              {/* Selection checkbox - only show for local assets in selection mode */}
              {isSelectionMode && asset.source === 'local' && (
                <View className="mr-1">
                  <Icon
                    as={isSelected ? CheckCircleIcon : CircleIcon}
                    size={20}
                    className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                  />
                </View>
              )}
              <View className="flex flex-1 flex-row gap-2">
                {(!allowEditing || invisible) && (
                  <View className="flex flex-row items-center gap-1.5">
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
              <View className="flex flex-row items-center gap-2">
                {/* Play button */}
                {onPlay && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onPress={handlePlayPress}
                    className="h-8 w-8"
                  >
                    <Icon
                      as={isPlayingIndividually ? PauseIcon : PlayIcon}
                      size={18}
                      className="text-foreground"
                    />
                  </Button>
                )}
                {/* Detail view button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onPress={handleDetailPressButton}
                  className="h-8 w-8"
                >
                  <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
                </Button>
                <DownloadIndicator
                  isFlaggedForDownload={isDownloaded}
                  isLoading={isDownloading}
                  onPress={handleDownloadToggle}
                  size={20}
                />
              </View>
            </View>
            {SHOW_DEV_ELEMENTS && (
              <CardDescription>
                {`ID: ${asset.id.substring(0, 8)}...`}
              </CardDescription>
            )}
          </View>
        </CardHeader>
      </Card>
    </Pressable>
  );
};
