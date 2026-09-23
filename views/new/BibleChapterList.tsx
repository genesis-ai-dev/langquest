/**
 * Displays Bible chapters for a selected book within a project.
 * Shows download/state indicators, creates chapter quests on-demand,
 * and navigates to the recording view. Members and owners always get the
 * version picker (including Create new version). Guests skip it when only
 * one version exists.
 */

import { DownloadStatusBadge } from '@/components/DownloadStatusBadge';
import {
  QuestCreateNewVersionRow,
  QuestVersionPickerCard
} from '@/components/QuestVersionPickerCard';
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
import { useProjectById } from '@/hooks/db/useProjects';
import { useBibleChapterCreation } from '@/hooks/useBibleChapterCreation';
import type {
  BibleChapterGroup,
  BibleChapterQuest
} from '@/hooks/useBibleChapters';
import { useBibleChapters } from '@/hooks/useBibleChapters';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useQuestDownloadFlow } from '@/hooks/useQuestDownloadFlow';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { shouldOpenQuestVersionPicker } from '@/utils/questVersionPicker';
import { cn, useThemeColor } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { Image } from 'expo-image';
import { BookOpenIcon, CopyIcon, HardDriveIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Version card inside the picker drawer ---

function VersionCard({
  version,
  isCurrentUser,
  onPress,
  isDownloading,
  downloadedQuestIds
}: {
  version: BibleChapterQuest;
  isCurrentUser: boolean;
  onPress: () => void;
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
  const { currentUser } = useAuth();
  const isSignedIn = Boolean(currentUser);
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
            {isSignedIn && hasLocalCopy && (
              <Icon as={HardDriveIcon} size={14} className="text-secondary" />
            )}
            {isSignedIn && exists && (hasSyncedCopy || isCloudQuest) && (
              <DownloadStatusBadge
                status={
                  isOptimisticallyDownloading
                    ? 'downloading'
                    : isDownloaded
                      ? 'downloaded'
                      : 'cloud'
                }
                className={
                  hasSyncedCopy || hasLocalCopy
                    ? 'text-secondary'
                    : 'text-foreground'
                }
              />
            )}
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
  const book = getBibleBook(bookId);
  const bookIconSource = BOOK_ICON_MAP[bookId];
  const primaryColor = useThemeColor('primary');
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  const { membership } = useUserPermissions(projectId, 'open_project');
  const isMember = membership === 'member' || membership === 'owner';
  const canCreateNew = isMember;

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

  const questDownloadFlow = useQuestDownloadFlow(projectId);
  const { downloadingQuestIds, downloadedQuestIds } = questDownloadFlow;

  const navigateToVersion = (version: BibleChapterQuest) => {
    setPickerChapterNum(null);
    void questDownloadFlow.openQuest(version, isMember);
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

    if (shouldOpenQuestVersionPicker(canCreateNew, group.versions.length)) {
      setPickerChapterNum(chapterNum);
      return;
    }

    navigateToVersion(group.versions[0]!);
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
                isDownloading={downloadingQuestIds.has(version.id)}
                downloadedQuestIds={downloadedQuestIds}
              />
            ))}

            {canCreateNew && pickerChapterNum && (
              <QuestCreateNewVersionRow
                onPress={() => createNewVersion(pickerChapterNum)}
              />
            )}
          </View>
        </DrawerContent>
      </Drawer>

      {questDownloadFlow.sheets}
    </View>
  );
}
