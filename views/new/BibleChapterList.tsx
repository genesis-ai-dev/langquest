/**
 * Displays Bible chapters for a selected book within a project.
 * Shows download/state indicators, creates chapter quests on-demand,
 * and navigates to the recording view. When multiple versions exist
 * for a chapter, shows a picker drawer.
 */

import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useBibleChapterCreation } from '@/hooks/useBibleChapterCreation';
import {
  useBibleChapters,
  type BibleChapterGroup,
  type BibleChapterQuest
} from '@/hooks/useBibleChapters';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { syncCallbackService } from '@/services/syncCallbackService';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn, useThemeColor } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { LegendList } from '@legendapp/list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import {
  BookOpenIcon,
  CopyIcon,
  HardDriveIcon,
  PlusCircleIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

// --- Version card inside the picker drawer ---

function VersionCard({
  version,
  isCurrentUser,
  onPress,
  onDownloadClick,
  isDownloading
}: {
  version: BibleChapterQuest;
  isCurrentUser: boolean;
  onPress: () => void;
  onDownloadClick: (questId: string) => void;
  isDownloading: boolean;
}) {
  const displayName = version.creatorName || 'Unknown';
  const initial = displayName.charAt(0).toUpperCase();
  const isLocal = version.source === 'local';
  const isCloud = version.source === 'cloud';
  const isDownloaded = useQuestDownloadStatusLive(isLocal ? null : version.id);
  const needsDownload = isCloud && !isDownloaded;

  return (
    <Pressable
      onPress={needsDownload ? () => onDownloadClick(version.id) : onPress}
      className={cn(
        'flex-row items-center gap-3 rounded-lg border border-border bg-card p-4 active:opacity-70',
        needsDownload && 'opacity-60',
        !version.visible && 'opacity-50'
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-full',
          isLocal ? 'bg-chart-2' : needsDownload ? 'bg-muted' : 'bg-primary'
        )}
      >
        <Text
          className={cn(
            'font-semibold',
            isLocal || needsDownload
              ? 'text-secondary-foreground'
              : 'text-primary-foreground'
          )}
        >
          {initial}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-semibold">
            {displayName}
            {isCurrentUser ? ' (you)' : ''}
          </Text>
        </View>
        <Text className="text-sm text-muted-foreground">
          {isCurrentUser && isLocal
            ? `Draft - ${formatRelativeDate(version.created_at)}`
            : formatRelativeDate(version.created_at)}
        </Text>
      </View>
      <View className="items-center justify-center">
        {isLocal && (
          <Icon as={HardDriveIcon} size={18} className="text-chart-2" />
        )}
        {!isLocal && (
          <DownloadIndicator
            isFlaggedForDownload={isDownloaded}
            isLoading={isDownloading && !isDownloaded}
            onPress={() => onDownloadClick(version.id)}
            size={18}
          />
        )}
      </View>
    </Pressable>
  );
}

// --- Chapter button ---

function ChapterButton({
  chapterNum,
  group,
  isCreatingThis,
  onPress,
  disabled,
  onDownloadClick,
  canCreateNew,
  downloadingQuestIds = new Set()
}: {
  chapterNum: number;
  group?: BibleChapterGroup;
  isCreatingThis: boolean;
  onPress: () => void;
  disabled: boolean;
  onDownloadClick: (questId: string) => void;
  canCreateNew: boolean;
  downloadingQuestIds?: Set<string>;
}) {
  const { currentUser } = useAuth();
  const existingQuest = group?.primary;
  const exists = !!existingQuest;
  const hasLocalCopy = existingQuest?.hasLocalCopy ?? false;
  const hasSyncedCopy = existingQuest?.hasSyncedCopy ?? false;
  const isCloudQuest = existingQuest?.source === 'cloud';
  const versionCount = group?.versions.length ?? 0;
  const primaryColor = useThemeColor('primary');

  const isDownloaded = useQuestDownloadStatusLive(existingQuest?.id || null);
  const isOptimisticallyDownloading = Boolean(
    existingQuest?.id && downloadingQuestIds.has(existingQuest.id)
  );
  const needsDownload = isCloudQuest && !isDownloaded;

  const handleDownloadToggle = () => {
    if (!currentUser?.id || !existingQuest?.id) return;
    if (!isDownloaded) {
      onDownloadClick(existingQuest.id);
    }
  };

  const getBackgroundColor = () => {
    if (hasSyncedCopy) return 'bg-chart-3';
    if (hasLocalCopy) return 'bg-chart-2';
    if (exists) return 'bg-card';
    return 'bg-muted';
  };

  const getTextColor = () => {
    if (hasSyncedCopy || hasLocalCopy) return 'text-secondary';
    if (exists) return 'text-foreground';
    return 'text-muted-foreground';
  };

  return (
    <View className="relative w-full flex-col gap-1">
      <Button
        variant={exists ? 'default' : 'outline'}
        className={cn(
          'w-full flex-col gap-1 py-3',
          !exists && 'border-dashed',
          getBackgroundColor()
        )}
        onPress={onPress}
        disabled={disabled || (!existingQuest && !canCreateNew)}
      >
        {isCreatingThis ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <View className="flex-col items-center gap-1">
            <View className="flex-row items-center gap-1">
              {hasLocalCopy && (
                <Icon as={HardDriveIcon} size={14} className="text-secondary" />
              )}
              {exists && (hasSyncedCopy || isCloudQuest) && (
                <View pointerEvents="none">
                  <DownloadIndicator
                    isFlaggedForDownload={isDownloaded}
                    isLoading={Boolean(isOptimisticallyDownloading)}
                    onPress={handleDownloadToggle}
                    size={16}
                    iconColor={
                      hasSyncedCopy || hasLocalCopy
                        ? 'text-secondary'
                        : 'text-foreground'
                    }
                  />
                </View>
              )}
              <Text className={cn('text-lg font-bold', getTextColor())}>
                {chapterNum}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              {versionCount > 1 && (
                <View className="flex-row items-center gap-0.5">
                  <Icon
                    as={CopyIcon}
                    size={10}
                    className={
                      hasSyncedCopy || hasLocalCopy
                        ? 'text-secondary/70'
                        : 'text-muted-foreground'
                    }
                  />
                  <Text
                    className={cn(
                      'text-xxs',
                      hasSyncedCopy || hasLocalCopy
                        ? 'text-secondary/70'
                        : 'text-muted-foreground'
                    )}
                  >
                    {versionCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </Button>
    </View>
  );
}

// --- Main list ---

interface BibleChapterListProps {
  projectId: string;
  bookId: string;
  onCloudLoadingChange?: (isLoading: boolean) => void;
}

export function BibleChapterList({
  projectId,
  bookId,
  onCloudLoadingChange
}: BibleChapterListProps) {
  const { goToQuest } = useNavigationHelpers();
  const { project } = useProjectById(projectId);
  const { createChapter, isCreating } = useBibleChapterCreation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const book = getBibleBook(bookId);
  const bookIconSource = BOOK_ICON_MAP[bookId];
  const primaryColor = useThemeColor('primary');
  const { t } = useLocalization();

  const { membership } = useUserPermissions(projectId, 'open_project');
  const canCreateNew = membership === 'member' || membership === 'owner';

  const {
    chapters: chapterGroups,
    isLoading: isLoadingChapters,
    isLoadingCloud
  } = useBibleChapters(projectId, bookId);

  React.useEffect(() => {
    onCloudLoadingChange?.(isLoadingCloud);
  }, [isLoadingCloud, onCloudLoadingChange]);

  const [creatingChapter, setCreatingChapter] = React.useState<number | null>(
    null
  );

  // Version picker state
  const [pickerChapterNum, setPickerChapterNum] = React.useState<number | null>(
    null
  );
  const pickerGroup = chapterGroups.find(
    (g) => g.chapterNumber === pickerChapterNum
  );

  // Download state
  const [questIdToDownload, setQuestIdToDownload] = React.useState<
    string | null
  >(null);
  const [showDiscoveryDrawer, setShowDiscoveryDrawer] = React.useState(false);
  const [showConfirmationModal, setShowConfirmationModal] =
    React.useState(false);
  const [downloadingQuestIds, setDownloadingQuestIds] = React.useState<
    Set<string>
  >(new Set());

  const discoveryState = useQuestDownloadDiscovery(questIdToDownload || '');
  const startedDiscoveryRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      showDiscoveryDrawer &&
      questIdToDownload &&
      !discoveryState.isDiscovering &&
      startedDiscoveryRef.current !== questIdToDownload
    ) {
      startedDiscoveryRef.current = questIdToDownload;
      discoveryState.startDiscovery();
    }
    if (!showDiscoveryDrawer) {
      startedDiscoveryRef.current = null;
    }
  }, [
    showDiscoveryDrawer,
    questIdToDownload,
    discoveryState.isDiscovering,
    discoveryState
  ]);

  const bulkDownloadMutation = useMutation({
    mutationFn: async () => {
      if (
        !currentUser?.id ||
        discoveryState.discoveredIds.questIds.length === 0
      ) {
        throw new Error('Missing user or discovered IDs');
      }
      return bulkDownloadQuest(discoveryState.discoveredIds, currentUser.id);
    },
    onMutate: async () => {
      const questIdsToUpdate = new Set(discoveryState.discoveredIds.questIds);

      const updateCache = (oldData: unknown) => {
        if (!oldData || !currentUser?.id) return oldData;
        const items = oldData as {
          id: string;
          download_profiles?: string[] | null;
          [key: string]: unknown;
        }[];
        return items.map((item) => {
          if (questIdsToUpdate.has(item.id)) {
            const profiles = item.download_profiles || [];
            return {
              ...item,
              download_profiles: profiles.includes(currentUser.id)
                ? profiles
                : [...profiles, currentUser.id]
            };
          }
          return item;
        });
      };

      await queryClient.setQueriesData(
        {
          queryKey: ['bible-chapters', 'local', projectId, bookId],
          exact: false
        },
        updateCache
      );
      await queryClient.setQueriesData(
        {
          queryKey: ['bible-chapters', 'cloud', projectId, bookId],
          exact: false
        },
        updateCache
      );
    },
    onSuccess: async () => {
      if (questIdToDownload) {
        const questIdsToClear = discoveryState.discoveredIds.questIds;

        const clearAndInvalidate = async () => {
          setDownloadingQuestIds((prev) => {
            const next = new Set(prev);
            questIdsToClear.forEach((id) => next.delete(id));
            return next;
          });

          await queryClient.invalidateQueries({
            queryKey: ['bible-chapters', 'local', projectId, bookId]
          });
          await queryClient.invalidateQueries({
            queryKey: ['bible-chapters', 'cloud', projectId, bookId]
          });
          await queryClient.invalidateQueries({ queryKey: ['assets'] });
        };

        syncCallbackService.registerCallback(
          questIdToDownload,
          clearAndInvalidate
        );
      }
    }
  });

  const handleDownloadClick = (questId: string) => {
    setQuestIdToDownload(questId);
    setShowDiscoveryDrawer(true);
  };

  const handleDiscoveryContinue = () => {
    setShowDiscoveryDrawer(false);
    setShowConfirmationModal(true);
  };

  const handleConfirmDownload = async () => {
    setShowConfirmationModal(false);
    const questIdsToTrack = new Set(discoveryState.discoveredIds.questIds);
    setDownloadingQuestIds((prev) => new Set([...prev, ...questIdsToTrack]));

    try {
      await bulkDownloadMutation.mutateAsync();
    } catch {
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        questIdsToTrack.forEach((id) => next.delete(id));
        return next;
      });
      setQuestIdToDownload(null);
    }
  };

  const handleCancelDiscovery = () => {
    discoveryState.cancel();
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        next.delete(questIdToDownload);
        return next;
      });
    }
    setShowDiscoveryDrawer(false);
    setQuestIdToDownload(null);
  };

  const handleCancelConfirmation = () => {
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);
      const questIdsToClear = discoveryState.discoveredIds.questIds;
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        questIdsToClear.forEach((id) => next.delete(id));
        return next;
      });
    }
    setShowConfirmationModal(false);
    setQuestIdToDownload(null);
  };

  const navigateToVersion = async (version: BibleChapterQuest) => {
    if (!currentUser?.id) return;

    if (version.source === 'local') {
      goToQuest({
        id: version.id,
        project_id: projectId,
        name: version.name
      });
      setPickerChapterNum(null);
      return;
    }

    const questRow = await system.db.query.quest.findFirst({
      where: (fields, { eq }) => eq(fields.id, version.id),
      columns: { download_profiles: true, source: true }
    });

    const profiles = questRow?.download_profiles;
    let isDownloaded = false;
    if (profiles) {
      const parsed =
        typeof profiles === 'string' ? JSON.parse(profiles) : profiles;
      isDownloaded = Array.isArray(parsed) && parsed.includes(currentUser.id);
    }
    const isCloudQuest =
      questRow?.source === 'cloud' || version.source === 'cloud';

    if (isCloudQuest && !isDownloaded) {
      setPickerChapterNum(null);
      handleDownloadClick(version.id);
      return;
    }

    goToQuest({
      id: version.id,
      project_id: projectId,
      name: version.name
    });
    setPickerChapterNum(null);
  };

  const createNewVersion = async (chapterNum: number) => {
    if (!currentUser?.id || isCreating || !canCreateNew || !book) return;

    setPickerChapterNum(null);
    setCreatingChapter(chapterNum);
    try {
      const result = await createChapter({
        projectId,
        bookId,
        chapter: chapterNum,
        targetLanguageId: project?.target_language_id || ''
      });

      goToQuest({
        id: result.questId,
        project_id: projectId,
        name: result.questName
      });
    } catch (error) {
      console.error('Failed to create chapter:', error);
    } finally {
      setCreatingChapter(null);
    }
  };

  if (!book) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>Book not found: {bookId}</Text>
      </View>
    );
  }

  const handleChapterPress = (chapterNum: number) => {
    if (!currentUser?.id || isCreating) return;

    const group = chapterGroups.find((g) => g.chapterNumber === chapterNum);

    if (!group || group.versions.length === 0) {
      if (!canCreateNew) {
        RNAlert.alert(t('error'), t('membersOnlyCreate'));
        return;
      }
      RNAlert.alert(t('createObject'), `${book.name} ${chapterNum}`, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          isPreferred: true,
          onPress: () => void createNewVersion(chapterNum)
        }
      ]);
      return;
    }

    setPickerChapterNum(chapterNum);
  };

  const chapterItems = Array.from({ length: book.chapters }, (_, i) => {
    const chapterNum = i + 1;
    const group = chapterGroups.find((g) => g.chapterNumber === chapterNum);
    return {
      id: chapterNum,
      chapterNum,
      group,
      isCreatingThis: creatingChapter === chapterNum
    };
  });

  const hasNoChapters = chapterGroups.length === 0;
  const showEmptyState = !isLoadingChapters && hasNoChapters && !canCreateNew;

  const renderBookHeader = (rowClassName?: string) => (
    <View className={cn('flex-row items-center gap-3', rowClassName)}>
      {bookIconSource ? (
        <Image
          source={bookIconSource}
          style={{ width: 48, height: 48, tintColor: primaryColor }}
          contentFit="contain"
        />
      ) : (
        <Text className="text-4xl">
          <Icon as={BookOpenIcon} size={32} className="text-primary" />
        </Text>
      )}
      <View className="min-w-0 flex-1 flex-col items-start">
        <Text variant="h3" className="w-full text-left">
          {book.name}
        </Text>
        <Text className="w-full text-left text-sm text-muted-foreground">
          {book.chapters} {t('chapters')}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <View className="flex-1 flex-col gap-6">
        {showEmptyState ? (
          <>
            {renderBookHeader('px-4')}
            <View className="flex-1 items-center justify-center gap-4 px-6">
              <Icon
                as={BookOpenIcon}
                size={48}
                className="text-muted-foreground"
              />
              <View className="flex-col items-center gap-2">
                <Text variant="h4" className="text-center">
                  {t('noQuestsAvailable')}
                </Text>
                <Text className="text-center text-muted-foreground">
                  {t('noContentAvailable')}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <LegendList
            data={chapterItems}
            keyExtractor={(item) => item.id.toString()}
            numColumns={4}
            estimatedItemSize={90}
            ListHeaderComponent={renderBookHeader('mb-6 w-full')}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            columnWrapperStyle={{ gap: 8 }}
            recycleItems
            renderItem={({ item }) =>
              (item.group || canCreateNew) && (
                <ChapterButton
                  chapterNum={item.chapterNum}
                  group={item.group}
                  isCreatingThis={item.isCreatingThis}
                  onPress={() => handleChapterPress(item.chapterNum)}
                  disabled={Boolean(isCreating)}
                  onDownloadClick={handleDownloadClick}
                  canCreateNew={canCreateNew}
                  downloadingQuestIds={downloadingQuestIds}
                />
              )
            }
          />
        )}
      </View>

      {/* Version picker drawer */}
      <Drawer
        open={!!pickerChapterNum}
        onOpenChange={(open) => {
          if (!open) setPickerChapterNum(null);
        }}
        snapPoints={['40%']}
        enableDynamicSizing={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {book.name} {pickerChapterNum} versions
            </DrawerTitle>
            <DrawerDescription>
              {pickerGroup?.versions.length ?? 0} version
              {(pickerGroup?.versions.length ?? 0) !== 1 ? 's' : ''} available
            </DrawerDescription>
          </DrawerHeader>

          <View className={cn('gap-3')}>
            {pickerGroup?.versions.map((version) => (
              <VersionCard
                key={version.id}
                version={version}
                isCurrentUser={version.creator_id === currentUser?.id}
                onPress={() => navigateToVersion(version)}
                onDownloadClick={handleDownloadClick}
                isDownloading={downloadingQuestIds.has(version.id)}
              />
            ))}

            {canCreateNew && pickerChapterNum && (
              <Pressable
                onPress={() => createNewVersion(pickerChapterNum)}
                className="flex-row items-center gap-3 rounded-lg border border-dashed border-border p-4 active:opacity-70"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Icon
                    as={PlusCircleIcon}
                    size={20}
                    className="text-primary"
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-primary">
                    Create new version
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Start a new recording for this chapter
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </DrawerContent>
      </Drawer>

      <QuestDownloadDiscoveryDrawer
        isOpen={showDiscoveryDrawer}
        onOpenChange={(open) => {
          if (!open) handleCancelDiscovery();
        }}
        onContinue={handleDiscoveryContinue}
        discoveryState={discoveryState}
      />

      <DownloadConfirmationModal
        visible={showConfirmationModal}
        onConfirm={handleConfirmDownload}
        onCancel={handleCancelConfirmation}
        downloadType="quest"
        discoveredCounts={{
          Quests: discoveryState.progressSharedValues.quest.value.count,
          Projects: discoveryState.progressSharedValues.project.value.count,
          'Quest-Asset Links':
            discoveryState.progressSharedValues.questAssetLinks.value.count,
          Assets: discoveryState.progressSharedValues.assets.value.count,
          'Asset Content Links':
            discoveryState.progressSharedValues.assetContentLinks.value.count,
          Votes: discoveryState.progressSharedValues.votes.value.count,
          'Quest Tags':
            discoveryState.progressSharedValues.questTagLinks.value.count,
          'Asset Tags':
            discoveryState.progressSharedValues.assetTagLinks.value.count,
          Tags: discoveryState.progressSharedValues.tags.value.count,
          Languages: discoveryState.progressSharedValues.languages.value.count
        }}
      />
    </View>
  );
}
