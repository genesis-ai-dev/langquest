import { DownloadIndicator } from '@/components/DownloadIndicator';
// import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
// import type { Tag } from '@/database_services/tagCache';
// import { tagService } from '@/database_services/tagService';
import type { asset as asset_type } from '@/db/drizzleSchema';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
// import { useTagStore } from '@/hooks/useTagStore';
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import type { AttachmentRecord } from '@powersync/attachments';
import {
  CheckSquareIcon,
  EyeOffIcon,
  GripVerticalIcon,
  HardDriveIcon,
  PauseIcon,
  PencilLineIcon,
  PlayIcon,
  SquareArrowOutUpRightIcon,
  // Plus,
  SquareIcon
} from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
// import { TagModal } from '../../components/TagModal';
import { Text } from '@/components/ui/text';
import { useItemDownload, useItemDownloadStatus } from './useHybridData';

// Define props locally to avoid require cycle

type Asset = typeof asset_type.$inferSelect;

type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
  tag_ids?: string[] | undefined;
};
export interface AssetCardItemProps {
  asset: AssetQuestLink;
  isPublished: boolean;
  questId: string;
  onUpdate?: () => void;
  onPlay?: (assetId: string) => void | Promise<void>;
  attachmentState?: AttachmentRecord;
  isCurrentlyPlaying?: boolean;
  // Drag & Drop props
  showDragHandle?: boolean; // Whether to show drag handle (not in selection mode, not published)
  isDragFixed?: boolean; // Whether this item has fixed drag order
  isHighlighted?: boolean;
  onDrag?: () => void; // Drag function from reorderable list
  // Selection mode props (batch operations like merge/delete)
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (assetId: string) => void;
  onEnterSelection?: (assetId: string) => void;
  // Recording insertion point selection
  isSelectedForRecording?: boolean;
  onSelectForRecording?: (assetId: string) => void;
  // Rename asset
  onRename?: (assetId: string, currentName: string | null) => void;
}

const AssetCardItemComponent: React.FC<AssetCardItemProps> = ({
  asset,
  questId,
  isCurrentlyPlaying = false,
  isPublished,
  onUpdate: _onUpdate,
  onPlay,
  attachmentState: _attachmentState,
  showDragHandle = false,
  isDragFixed = false,
  onDrag,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onEnterSelection,
  isSelectedForRecording = false,
  onSelectForRecording,
  onRename,
  isHighlighted = false
}) => {
  const { goToAsset, currentProjectData, currentQuestData } =
    useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  // Check if asset is downloaded
  const isDownloaded = useItemDownloadStatus(asset, currentUser?.id);

  // Tags functionality commented out
  // const fetchManyTags = useTagStore((s) => s.fetchManyTags);
  // const [tags, setTags] = React.useState<
  //   { id: string; key: string; value?: string }[]
  // >([]);

  // React.useEffect(() => {
  //   const loadTags = async () => {
  //     if (asset.tag_ids && asset.tag_ids.length > 0) {
  //       const fetchedTags = await fetchManyTags(asset.tag_ids);
  //       setTags(fetchedTags);
  //     }
  //   };
  //   void loadTags();
  // }, [asset.tag_ids, fetchManyTags]);

  // Download mutation
  const { mutate: downloadAsset, isPending: isDownloading } = useItemDownload(
    'asset',
    asset.id
  );

  // Tag modal state - commented out
  // const [isTagModalVisible, setIsTagModalVisible] = React.useState(false);

  // const handleOpenTagModal = () => {
  //   console.log('Opening tag modal for asset:', asset.id);
  //   setIsTagModalVisible(true);
  // };

  // const handleAssignTags = async (tags: Tag[]) => {
  //   try {
  //     // Extract tag IDs from the tags array
  //     const tagIds = tags.map((tag) => tag.id);

  //     // Use the tagService to assign tags to the asset
  //     await tagService.assignTagsToAssetLocal(asset.id, tagIds);

  //     onUpdate?.();

  //     console.log(
  //       `Successfully assigned ${tagIds.length} tags to asset ${asset.id}`
  //     );
  //   } catch (error) {
  //     console.error('Failed to assign tags to asset:', error);
  //     // TODO: Show error toast/alert to user
  //   } finally {
  //     setIsTagModalVisible(false);
  //   }
  // };

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

  const handleOpenAsset = () => {
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

  const handlePress = () => {
    // If in selection mode, toggle selection instead of navigating
    if (isSelectionMode) {
      onToggleSelect?.(asset.id);
      return;
    }

    // If not published, select for recording (toggle)
    if (!isPublished) {
      onSelectForRecording?.(asset.id);
      return;
    }

    // If published, toggle selection for playAll (visual highlight only, no icons)
    onToggleSelect?.(asset.id);

    // handleOpenAsset();

    // layerStatus.setLayerStatus(
    //   LayerType.ASSET,
    //   {
    //     visible: asset.visible,
    //     active: asset.active,
    //     quest_active: asset.quest_active,
    //     quest_visible: asset.quest_visible,
    //     source: asset.source
    //   },
    //   asset.id,
    //   questId
    // );

    // goToAsset({
    //   id: asset.id,
    //   name: asset.name || t('unnamedAsset'),
    //   questId: questId,
    //   projectId: asset.project_id!,
    //   projectData: currentProjectData, // Pass project data forward!
    //   questData: currentQuestData // Pass quest data forward!
    //   // NOTE: Don't pass assetData - the detail view needs full asset with content/audio
    //   // relationships which aren't loaded in the list view
    // });
  };

  const handleLongPress = () => {
    // Enter selection mode on long press
    if (!isSelectionMode && onEnterSelection) {
      onEnterSelection(asset.id);
    }
  };

  const handleDownloadToggle = () => {
    if (!currentUser?.id) return;

    // Toggle download status
    downloadAsset({ userId: currentUser.id, download: !isDownloaded });
  };

  // Tags display - commented out
  // const tag = tags.length > 0 ? tags[0] : null;

  // Create drag handle inside component (memoized for performance)
  const dragHandle = React.useMemo(() => {
    if (!showDragHandle) return null;

    return (
      <Pressable
        onLongPress={isDragFixed ? undefined : onDrag}
        delayLongPress={100}
        hitSlop={8}
      >
        <Icon
          as={GripVerticalIcon}
          size={24}
          className={
            isDragFixed ? 'text-muted-foreground/30' : 'text-muted-foreground'
          }
        />
      </Pressable>
    );
  }, [showDragHandle, isDragFixed, onDrag]);

  // Render selection checkbox or drag handle
  const selectionOrDragElement = isSelectionMode ? (
    <Pressable
      onPress={() => onToggleSelect?.(asset.id)}
      className="mr-1 flex h-7 w-7 items-center justify-center"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon
        as={isSelected ? CheckSquareIcon : SquareIcon}
        size={22}
        className={isSelected ? 'text-primary' : 'text-muted-foreground'}
      />
    </Pressable>
  ) : (
    dragHandle
  );

  return (
    <Pressable onPress={handlePress} onLongPress={handleLongPress}>
      <Card
        className={`${
          !allowEditing ? 'opacity-50' : ''
        } ${invisible ? 'opacity-30' : ''} ${
          isCurrentlyPlaying ? 'border-2 border-primary bg-primary/5' : ''
        } ${isSelected ? 'border-2 border-primary bg-primary/10' : ''} ${
          isSelectedForRecording ? 'border-2 border-primary bg-primary/15' : ''
        } p-3 relative overflow-hidden`}
      >
        {/* Highlight indicator triangle */}
        {/* { isHighlighted && <View className="absolute -ml-[10px] top-0 left-0 border-r-[10px] border-l-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary"/> } */}
        {/* Highlight indicator border right */}
        {/* { isHighlighted && <View className="absolute top-0 right-0 bg-primary/50 w-10 rounded-l-lg -mt-2 h-4"></View> } */}
        {/* Highlight indicator border right asterisk */}
        {/* { isHighlighted && <View className="absolute top-0 left-0 bg-primary w-6 rounded-lg -ml-2 h-5 -mt-2">
          <Icon
                        as={Asterisk}
                        size={12}
                        className="text-primary-foreground top-2 left-2.5"
                      />
        </View> } */}
        {/* Highlight indicator border left dot */}
        {/* { isHighlighted && <View className="absolute top-2 left-2 bg-primary w-1.5 rounded-lg h-1.5"> </View> } */}
        {/* Highlight indicator background */}
        {/* { isHighlighted && <View className="absolute top-0 left-0 bottom-0 right-0 bg-primary/5"> </View> } */}
        {/* Highlight indicator border top line */}
        {/* { isHighlighted && <View className="absolute top-0 left-2 right-2 bg-primary/40 h-0.5"> </View> } */}
        {/* Highlight indicator badge */}
        
        <CardHeader className="flex flex-row items-start justify-between p-0">
          <View className="flex flex-1 gap-1">
            <View className="flex flex-row items-center justify-between gap-1.5">
              <View className="flex flex-1 flex-row items-center gap-1.5">
                {(!allowEditing || invisible) && (
                  <View className="flex flex-row gap-1">
                    {invisible && (
                      <Icon
                        as={EyeOffIcon}
                        size={14}
                        className="text-secondary-foreground"
                      />
                    )}
                    {!allowEditing && (
                      <Icon
                        as={PauseIcon}
                        size={14}
                        className="text-secondary-foreground"
                      />
                    )}
                  </View>
                )}
                {selectionOrDragElement}
                <View className="flex flex-row items-center gap-1.5">
                  {asset.source === 'local' && (
                    <Icon as={HardDriveIcon} size={14} />
                  )}
                  {/* Play button - only show if onPlay is provided */}
                  {onPlay && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        void onPlay(asset.id);
                      }}
                      className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 active:bg-primary/40"
                      hitSlop={8}
                    >
                      <Icon
                        as={isCurrentlyPlaying ? PauseIcon : PlayIcon}
                        size={14}
                        className={
                          isCurrentlyPlaying
                            ? 'text-primary'
                            : 'text-primary/80'
                        }
                      />
                    </Pressable>
                  )}
                  <CardTitle
                    numberOfLines={2}
                    className="text-sm leading-tight"
                  >
                    {asset.name || t('unnamedAsset')}
                  </CardTitle>
                </View>
              </View>
              {/* Tags UI - commented out */}
              {/* <View className="flex flex-row items-center justify-center gap-1.5">
                <Pressable
                  onPress={isPublished ? undefined : handleOpenTagModal}
                >
                  {tags.length === 0 ? (
                    !isPublished && (
                      <View className="flex h-6 w-7 flex-row items-center justify-center rounded-full border border-white/30 bg-primary/30">
                        <Icon as={Plus} size={10} className="text-white" />
                        <Icon as={TagIcon} size={10} className="text-white" />
                      </View>
                    )
                  ) : (
                    <View pointerEvents="none">
                      <Badge
                        variant="default"
                        className="flex flex-row items-center gap-1 px-2 py-0.5"
                      >
                        <Icon as={TagIcon} size={11} className="text-white" />
                        <CardTitle className="text-[11px] leading-tight text-white">
                          {tag && `${tag.key}${tag.value && `: ${tag.value}`}`}
                        </CardTitle>
                      </Badge>
                    </View>
                  )}
                </Pressable>
              </View> */}
              {/* Actions: Edit name + Open details (hidden in selection mode) */}
              <View className="flex flex-row items-center gap-2">
                {/* Highlight indicator badge */}
              { isHighlighted && <View className="bg-primary/50 rounded-lg px-2 ">
                <Text className="text-secondary-foreground font-semibold text-[10px]">NEW</Text></View> }

                {!isSelectionMode &&
                !isPublished &&
                onRename &&
                asset.source === 'local' ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onRename(asset.id, asset.name);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 active:bg-primary/40"
                    hitSlop={8}
                  >
                    <Icon
                      as={PencilLineIcon}
                      size={12}
                      className="text-primary"
                    />
                  </Pressable>
                ) : (
                  <DownloadIndicator
                    isFlaggedForDownload={isDownloaded}
                    isLoading={isDownloading}
                    onPress={handleDownloadToggle}
                    size={16}
                    iconColor="text-primary/50"
                  />
                )}

                {!isSelectionMode && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenAsset();
                    }}
                    className="mr-2"
                    hitSlop={8}
                  >
                    <Icon
                      as={SquareArrowOutUpRightIcon}
                      size={16}
                      className="text-primary"
                    />
                  </Pressable>
                )}
              </View>
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

      {/* TagModal - commented out */}
      {/* <TagModal
        isVisible={isTagModalVisible}
        searchTerm=""
        limit={200}
        initialSelectedTags={tags}
        onClose={() => setIsTagModalVisible(false)}
        onAssignTags={handleAssignTags}
      /> */}
    </Pressable>
  );
};

/**
 * Custom comparison function for React.memo
 * Returns TRUE if props are EQUAL (skip re-render)
 * Returns FALSE if props are DIFFERENT (re-render needed)
 */
const arePropsEqual = (
  prevProps: AssetCardItemProps,
  nextProps: AssetCardItemProps
): boolean => {
  // 1. Compare primitive props that affect visual rendering
  if (
    prevProps.questId !== nextProps.questId ||
    prevProps.isPublished !== nextProps.isPublished ||
    prevProps.isCurrentlyPlaying !== nextProps.isCurrentlyPlaying ||
    prevProps.showDragHandle !== nextProps.showDragHandle ||
    prevProps.isDragFixed !== nextProps.isDragFixed ||
    prevProps.isSelectionMode !== nextProps.isSelectionMode ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isSelectedForRecording !== nextProps.isSelectedForRecording
  ) {
    return false; // Props changed, need to re-render
  }

  // 2. Compare asset object (only fields that affect UI)
  const prevAsset = prevProps.asset;
  const nextAsset = nextProps.asset;

  if (
    prevAsset.id !== nextAsset.id ||
    prevAsset.name !== nextAsset.name ||
    prevAsset.order_index !== nextAsset.order_index ||
    prevAsset.visible !== nextAsset.visible ||
    prevAsset.active !== nextAsset.active ||
    prevAsset.quest_visible !== nextAsset.quest_visible ||
    prevAsset.quest_active !== nextAsset.quest_active ||
    prevAsset.source !== nextAsset.source
  ) {
    return false; // Asset changed, need to re-render
  }

  // 3. Compare metadata (small object, JSON.stringify is fast)
  const prevMetadata = JSON.stringify(prevAsset.metadata);
  const nextMetadata = JSON.stringify(nextAsset.metadata);
  if (prevMetadata !== nextMetadata) {
    return false; // Metadata changed, need to re-render
  }

  // 4. Compare attachmentState (only the state field matters for UI)
  const prevState = prevProps.attachmentState?.state;
  const nextState = nextProps.attachmentState?.state;
  if (prevState !== nextState) {
    return false; // Attachment state changed, need to re-render
  }

  // 5. Ignore function props (they're stable from Part 2 optimization)
  // onUpdate, onPlay, onToggleSelect, onEnterSelection, onSelectForRecording, onRename
  // These are ignored because they're memoized in the parent component

  return true; // Props are equal, skip re-render ✅
};

/**
 * Memoized BibleAssetListItem component
 * Only re-renders when props that affect visual output change
 */
export const AssetCardItem = React.memo(
  AssetCardItemComponent,
  arePropsEqual
);

AssetCardItem.displayName = 'AssetCardItem';
