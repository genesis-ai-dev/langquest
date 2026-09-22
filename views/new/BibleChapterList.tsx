/**
 * Displays Bible chapters for a selected book within a project.
 * Shows download/state indicators, creates chapter quests on-demand,
 * and navigates to the recording view. When multiple versions exist
 * for a chapter, shows a picker drawer.
 */

import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { QuestVersionPickerCard } from '@/components/QuestVersionPickerCard';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { LegendList } from '@/components/ui/legend-list';
import { Text } from '@/components/ui/text';
import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectById } from '@/hooks/db/useProjects';
import { useBibleChapterCreation } from '@/hooks/useBibleChapterCreation';
import type {
  BibleChapterGroup,
  BibleChapterQuest
} from '@/hooks/useBibleChapters';
import { useBibleChapters } from '@/hooks/useBibleChapters';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { useSheetHandoff } from '@/hooks/useSheetHandoff';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { cn, useThemeColor } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { invalidateCloud } from '@/hooks/hybridCache';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import {
  BookOpenIcon,
  CircleArrowDownIcon,
  CircleCheckIcon,
  CopyIcon,
  HardDriveIcon,
  PlusCircleIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Version card inside the picker drawer ---

function VersionCard({
  version,
  isCurrentUser,
  onPress,
  onDownloadClick,
  isDownloading,
  downloadedQuestIds
}: {
  version: BibleChapterQuest;
  isCurrentUser: boolean;
  onPress: () => void;
  onDownloadClick: (questId: string) => void;
  isDownloading: boolean;
  downloadedQuestIds: Set<string>;
}) {
  const isLocal = version.source === 'local';
  const isCloud = version.source === 'cloud';
  const liveDownloaded = useQuestDownloadStatusLive(
    isLocal ? null : version.id
  );
  const isDownloaded = downloadedQuestIds.has(version.id) || liveDownloaded;

  return (
    <QuestVersionPickerCard
      versionLabel={version.versionLabel}
      creatorName={version.creatorName}
      isCurrentUser={isCurrentUser}
      createdAt={version.created_at}
      isLocal={isLocal}
      isCloud={isCloud}
      isDownloaded={isDownloaded}
      isDownloading={isDownloading}
      visible={version.visible}
      onPress={onPress}
      onDownloadClick={() => onDownloadClick(version.id)}
    />
  );
}

// --- Chapter button ---

function ChapterButton({
  chapterNum,
  group,
  isCreatingThis,
  onPress,
  disabled,
  canCreateNew,
  downloadingQuestIds = new Set(),
  downloadedQuestIds = new Set()
}: {
  chapterNum: number;
  group?: BibleChapterGroup;
  isCreatingThis: boolean;
  onPress: () => void;
  disabled: boolean;
  canCreateNew: boolean;
  downloadingQuestIds?: Set<string>;
  downloadedQuestIds?: Set<string>;
}) {
  const existingQuest = group?.primary;
  const exists = !!existingQuest;
  const hasLocalCopy = existingQuest?.hasLocalCopy ?? false;
  const hasSyncedCopy = existingQuest?.hasSyncedCopy ?? false;
  const isCloudQuest = existingQuest?.source === 'cloud';
  const versionCount = group?.versions.length ?? 0;
  const primaryColor = useThemeColor('primary');
  const isDisabled = disabled || (!existingQuest && !canCreateNew);

  const liveDownloaded = useQuestDownloadStatusLive(existingQuest?.id || null);
  const isDownloaded =
    liveDownloaded ||
    Boolean(existingQuest?.id && downloadedQuestIds.has(existingQuest.id));
  const isOptimisticallyDownloading = Boolean(
    existingQuest?.id &&
    downloadingQuestIds.has(existingQuest.id) &&
    !isDownloaded
  );

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
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={`bible-chapter-${chapterNum}`}
      accessibilityLabel={`bible-chapter-${chapterNum}`}
      accessibilityRole="button"
      className={cn(
        'w-full flex-col items-center gap-1 rounded-md py-3',
        !exists && 'border border-dashed border-input',
        getBackgroundColor(),
        isDisabled && 'opacity-50'
      )}
    >
      {isCreatingThis ? (
        <ActivityIndicator size="small" color={primaryColor} />
      ) : (
        <View className="flex-col items-center gap-1">
          <View className="flex-row items-center gap-1">
            {hasLocalCopy && (
              <Icon as={HardDriveIcon} size={14} className="text-secondary" />
            )}
            {exists &&
              (hasSyncedCopy || isCloudQuest) &&
              (isOptimisticallyDownloading ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Icon
                  as={isDownloaded ? CircleCheckIcon : CircleArrowDownIcon}
                  size={16}
                  className={
                    hasSyncedCopy || hasLocalCopy
                      ? 'text-secondary'
                      : 'text-foreground'
                  }
                />
              ))}
            <Text className={cn('text-lg font-bold', getTextColor())}>
              {chapterNum}
            </Text>
          </View>
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
      )}
    </Pressable>
  );
}

// --- Main list ---

interface BibleChapterListProps {
  projectId: string;
  bookId: string;
  bookQuestId: string;
  onCloudLoadingChange?: (isLoading: boolean) => void;
}

export function BibleChapterList({
  projectId,
  bookId,
  bookQuestId,
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
  const insets = useSafeAreaInsets();

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
  const { handoff, isHandingOff, endHandoff, completeHandoff } =
    useSheetHandoff();
  const [downloadingQuestIds, setDownloadingQuestIds] = React.useState<
    Set<string>
  >(new Set());
  const [downloadedQuestIds, setDownloadedQuestIds] = React.useState<
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
    onSuccess: async () => {
      const questIds = discoveryState.discoveredIds.questIds;
      setDownloadedQuestIds((prev) => new Set([...prev, ...questIds]));
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        questIds.forEach((id) => next.delete(id));
        return next;
      });
      await invalidateCloud(queryClient, 'bible-chapters', 'assets');
    }
  });

  const handleDownloadClick = (questId: string) => {
    setPickerChapterNum(null);
    setQuestIdToDownload(questId);
    setShowDiscoveryDrawer(true);
  };

  const handleDiscoveryContinue = () => {
    handoff(
      () => setShowDiscoveryDrawer(false),
      () => setShowConfirmationModal(true)
    );
  };

  const handleConfirmDownload = async () => {
    endHandoff();
    setShowConfirmationModal(false);
    const questIdsToTrack = new Set(discoveryState.discoveredIds.questIds);
    const targetQuestId = questIdToDownload;
    const targetName = chapterGroups
      .flatMap((group) => group.versions)
      .find((version) => version.id === targetQuestId)?.name;
    setDownloadingQuestIds((prev) => new Set([...prev, ...questIdsToTrack]));
    setPickerChapterNum(null);

    try {
      await bulkDownloadMutation.mutateAsync();
      if (targetQuestId) {
        goToQuest({
          id: targetQuestId,
          project_id: projectId,
          name: targetName
        });
      }
      setQuestIdToDownload(null);
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
    endHandoff();
    if (questIdToDownload) {
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

  const navigateToVersion = (version: BibleChapterQuest) => {
    const profiles = version.download_profiles;
    const profileDownloaded = Boolean(
      currentUser?.id &&
      Array.isArray(profiles) &&
      profiles.includes(currentUser.id)
    );
    const needsDownload =
      Boolean(currentUser?.id) &&
      version.source === 'cloud' &&
      !downloadedQuestIds.has(version.id) &&
      !profileDownloaded;

    if (needsDownload) {
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
        targetLanguageId: project?.target_language_id || '',
        parentQuestId: bookQuestId
      });

      goToQuest({
        id: result.questId,
        project_id: projectId,
        name: result.questName,
        promptVersionLabel: true
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
    if (isCreating) return;

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

    if (group.versions.length === 1) {
      navigateToVersion(group.versions[0]!);
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

  const visibleChapterItems = chapterItems.filter(
    (item) => item.group || canCreateNew
  );
  const chapterRows: (typeof visibleChapterItems)[] = [];
  for (let i = 0; i < visibleChapterItems.length; i += 4) {
    chapterRows.push(visibleChapterItems.slice(i, i + 4));
  }

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
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 24
            }}
            keyboardShouldPersistTaps="handled"
          >
            {renderBookHeader('mb-6 w-full')}
            <View className="flex-col gap-2">
              {chapterRows.map((row) => (
                <View
                  key={row.map((item) => item.id).join('-')}
                  className="flex-row gap-2"
                >
                  {row.map((item) => (
                    <View key={item.id} className="flex-1">
                      <ChapterButton
                        chapterNum={item.chapterNum}
                        group={item.group}
                        isCreatingThis={item.isCreatingThis}
                        onPress={() => handleChapterPress(item.chapterNum)}
                        disabled={Boolean(isCreating)}
                        canCreateNew={canCreateNew}
                        downloadingQuestIds={downloadingQuestIds}
                        downloadedQuestIds={downloadedQuestIds}
                      />
                    </View>
                  ))}
                  {row.length < 4 &&
                    Array.from({ length: 4 - row.length }).map((_, index) => (
                      <View key={`pad-${index}`} className="flex-1" />
                    ))}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

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
              {book.name} {pickerChapterNum} {t('versions')}
            </DrawerTitle>
            <DrawerDescription>
              {/* {pickerGroup?.versions.length ?? 0} version
              {(pickerGroup?.versions.length ?? 0) !== 1 ? 's' : ''} available */}
              {pickerGroup?.versions.length ?? 0}{' '}
              {pickerGroup?.versions.length === 1
                ? t('version') + ' ' + t('available')
                : t('versions') + ' ' + t('available_plural')}
            </DrawerDescription>
          </DrawerHeader>

          <View className={cn('gap-3 pb-8')}>
            {pickerGroup?.versions.map((version) => (
              <VersionCard
                key={version.id}
                version={version}
                isCurrentUser={version.creator_id === currentUser?.id}
                onPress={() => navigateToVersion(version)}
                onDownloadClick={handleDownloadClick}
                isDownloading={downloadingQuestIds.has(version.id)}
                downloadedQuestIds={downloadedQuestIds}
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
                    {t('createNewVersion')}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {t('startNewRecording')}
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
          if (open) return;
          if (isHandingOff()) completeHandoff();
          else handleCancelDiscovery();
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
