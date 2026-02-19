import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useBibleChapterCreation } from '@/hooks/useBibleChapterCreation';
import { useBibleChapters } from '@/hooks/useBibleChapters';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { syncCallbackService } from '@/services/syncCallbackService';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { cn, useThemeColor } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { LegendList } from '@legendapp/list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { BookOpenIcon, HardDriveIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

interface BibleChapterListProps {
  projectId: string;
  bookId: string;
  onCloudLoadingChange?: (isLoading: boolean) => void;
}

// type QuestClosure = typeof quest_closure.$inferSelect;

// Simple skeleton for chapter buttons during loading
const ChapterSkeleton = () => (
  <View className="w-full flex-col items-center gap-1 rounded-md border border-border bg-muted/50 py-3">
    <Skeleton style={{ width: 32, height: 24 }} />
    <Skeleton style={{ width: 24, height: 14 }} />
  </View>
);

// Helper component to handle individual chapter download state
function ChapterButton({
  chapterNum,
  verseCount: _verseCount,
  existingChapter,
  isCreatingThis,
  onPress,
  disabled,
  onDownloadClick,
  canCreateNew,
  downloadingQuestIds = new Set()
}: {
  chapterNum: number;
  verseCount: number;
  existingChapter?: {
    id: string;
    name: string;
    source: string;
    hasLocalCopy: boolean;
    hasSyncedCopy: boolean;
    download_profiles?: string[] | null;
  };
  isCreatingThis: boolean;
  onPress: () => void;
  disabled: boolean;
  onDownloadClick: (questId: string) => void;
  canCreateNew: boolean;
  downloadingQuestIds?: Set<string>;
}) {
  const { currentUser } = useAuth();
  const { isDarkColorScheme } = useColorScheme();
  const exists = !!existingChapter;
  const hasLocalCopy = existingChapter?.hasLocalCopy ?? false;
  const hasSyncedCopy = existingChapter?.hasSyncedCopy ?? false;
  const isCloudQuest = existingChapter?.source === 'cloud';
  const primaryColor = useThemeColor('primary');

  // Query SQLite directly - single source of truth
  const isDownloaded = useQuestDownloadStatusLive(existingChapter?.id || null);

  // Show loading if actively downloading (for spinner feedback)
  const isOptimisticallyDownloading = Boolean(
    existingChapter?.id && downloadingQuestIds.has(existingChapter.id)
  );
  const needsDownload = isCloudQuest && !isDownloaded;

  const handleDownloadToggle = () => {
    if (!currentUser?.id || !existingChapter?.id) return;
    if (!isDownloaded) {
      onDownloadClick(existingChapter.id);
    }
  };

  // Use semantic Tailwind colors for status, matching conventions:
  // - Published: primary (purple) with primary-foreground text
  // - Local only: info/blue (chart-2)
  // - Not created: muted
  // - Foreground should always be readable (primary-foreground for filled, foreground for outline)
  const getBackgroundColor = () => {
    if (hasSyncedCopy) return 'bg-primary'; // Published (Primary, Purple)
    if (hasLocalCopy) return 'bg-chart-2'; // Local-only (Info, Blue)
    if (exists) return 'bg-card'; // Exists but not local or synced
    return 'bg-muted'; // Not yet created (empty slot)
  };

  const getTextColor = () => {
    // For downloaded chapters with primary button variant, use primary-foreground (white)
    if (hasSyncedCopy && exists) return 'text-primary-foreground';
    if (hasLocalCopy) return 'text-secondary';
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
        onPress={
          needsDownload && !isDarkColorScheme ? handleDownloadToggle : onPress
        }
        disabled={
          disabled ||
          (needsDownload && isDarkColorScheme) ||
          (!existingChapter && !canCreateNew)
        }
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
                <View pointerEvents={isDownloaded ? 'none' : 'auto'}>
                  <DownloadIndicator
                    isFlaggedForDownload={isDownloaded}
                    isLoading={Boolean(isOptimisticallyDownloading)}
                    onPress={handleDownloadToggle}
                    size={16}
                    iconColor={
                      hasSyncedCopy && exists
                        ? 'text-primary-foreground'
                        : hasLocalCopy
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
            {/* <Text
              className={cn(
                "text-xs",
                exists ? "text-card-foreground/70" : "text-muted-foreground"
              )}
            >
              {verseCount} vs
            </Text> */}
          </View>
        )}
      </Button>

      {/* Overlay to make entire button pressable for download when needed (dark theme only) */}
      {needsDownload && !disabled && isDarkColorScheme && (
        <TouchableOpacity
          onPress={handleDownloadToggle}
          className="absolute inset-0"
          activeOpacity={0.7}
        />
      )}
    </View>
  );
}

export function BibleChapterList({
  projectId,
  bookId,
  onCloudLoadingChange
}: BibleChapterListProps) {
  const { goToQuest } = useAppNavigation();
  const { project } = useProjectById(projectId);
  const { createChapter, isCreating } = useBibleChapterCreation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const book = getBibleBook(bookId);
  const bookIconSource = BOOK_ICON_MAP[bookId];
  const primaryColor = useThemeColor('primary');
  const { t } = useLocalization();

  // Check user permissions for creating chapters
  const { membership } = useUserPermissions(projectId, 'open_project');
  const canCreateNew = membership === 'member' || membership === 'owner';

  // Query existing chapters using parent-child relationship
  const {
    existingChapterNumbers: _existingChapterNumbers,
    chapters: existingChapters,
    isLoading: isLoadingChapters,
    isLoadingCloud
  } = useBibleChapters(projectId, bookId);

  // Notify parent of cloud loading state
  React.useEffect(() => {
    onCloudLoadingChange?.(isLoadingCloud);
  }, [isLoadingCloud, onCloudLoadingChange]);

  const [creatingChapter, setCreatingChapter] = React.useState<number | null>(
    null
  );

  // Discovery drawer state
  const [questIdToDownload, setQuestIdToDownload] = React.useState<
    string | null
  >(null);
  const [showDiscoveryDrawer, setShowDiscoveryDrawer] = React.useState(false);
  const [showConfirmationModal, setShowConfirmationModal] =
    React.useState(false);

  // Track quest IDs that are currently downloading (for optimistic UI updates)
  const [downloadingQuestIds, setDownloadingQuestIds] = React.useState<
    Set<string>
  >(new Set());

  // Discovery hook
  const discoveryState = useQuestDownloadDiscovery(questIdToDownload || '');

  // Track if we've started discovery for this quest ID to prevent loops
  const startedDiscoveryRef = React.useRef<string | null>(null);

  // Auto-start discovery when drawer opens with a quest ID
  React.useEffect(() => {
    if (
      showDiscoveryDrawer &&
      questIdToDownload &&
      !discoveryState.isDiscovering &&
      startedDiscoveryRef.current !== questIdToDownload
    ) {
      console.log(
        '📥 [Download] Auto-starting discovery for quest:',
        questIdToDownload
      );
      startedDiscoveryRef.current = questIdToDownload;
      discoveryState.startDiscovery();
    }

    // Reset ref when drawer closes
    if (!showDiscoveryDrawer) {
      startedDiscoveryRef.current = null;
    }
  }, [
    showDiscoveryDrawer,
    questIdToDownload,
    discoveryState.isDiscovering,
    discoveryState
  ]);

  // Bulk download mutation
  const bulkDownloadMutation = useMutation({
    mutationFn: async () => {
      if (
        !currentUser?.id ||
        discoveryState.discoveredIds.questIds.length === 0
      ) {
        throw new Error('Missing user or discovered IDs');
      }

      console.log(
        '📥 [Bulk Download] Starting bulk download with IDs:',
        discoveryState.discoveredIds
      );

      const data = await bulkDownloadQuest(
        discoveryState.discoveredIds,
        currentUser.id
      );

      console.log('📥 [Bulk Download] Success:', data);
      return data;
    },
    onMutate: async () => {
      console.log(
        '📥 [Bulk Download] Optimistically updating cache (BEFORE mutation)'
      );

      // Optimistically update chapter queries immediately
      const questIdsToUpdate = new Set(discoveryState.discoveredIds.questIds);

      const updateChapterCache = (oldData: unknown) => {
        if (!oldData || !currentUser?.id) return oldData;

        // Handle array of chapters
        const chapters = oldData as {
          id: string;
          download_profiles?: string[] | null;
          [key: string]: unknown;
        }[];

        return chapters.map((chapter) => {
          if (questIdsToUpdate.has(chapter.id)) {
            const currentProfiles = chapter.download_profiles || [];
            const updatedProfiles = currentProfiles.includes(currentUser.id)
              ? currentProfiles
              : [...currentProfiles, currentUser.id];

            return {
              ...chapter,
              download_profiles: updatedProfiles
            };
          }
          return chapter;
        });
      };

      // Update chapter queries
      await queryClient.setQueriesData(
        {
          queryKey: ['bible-chapters', 'local', projectId, bookId],
          exact: false
        },
        updateChapterCache
      );

      await queryClient.setQueriesData(
        {
          queryKey: ['bible-chapters', 'cloud', projectId, bookId],
          exact: false
        },
        updateChapterCache
      );

      console.log(
        '📥 [Bulk Download] Cache updated - UI should show downloaded state immediately'
      );
    },
    onSuccess: async () => {
      console.log('📥 [Bulk Download] Success - registering sync callback...');

      // Register callback to invalidate queries after PowerSync sync completes
      if (questIdToDownload) {
        // Get all quest IDs to clear from downloading state
        const questIdsToClear = discoveryState.discoveredIds.questIds;

        syncCallbackService.registerCallback(questIdToDownload, async () => {
          console.log(
            '📥 [Bulk Download] Sync completed - invalidating queries'
          );

          // Clear downloading state - sync is complete, UI should show real data now
          setDownloadingQuestIds((prev) => {
            const next = new Set(prev);
            questIdsToClear.forEach((id) => next.delete(id));
            return next;
          });

          // Invalidate chapter queries to refetch from local SQLite with updated download_profiles
          await queryClient.invalidateQueries({
            queryKey: ['bible-chapters', 'local', projectId, bookId]
          });

          await queryClient.invalidateQueries({
            queryKey: ['bible-chapters', 'cloud', projectId, bookId]
          });

          // Invalidate assets queries to refresh assets list if user is viewing a quest
          await queryClient.invalidateQueries({
            queryKey: ['assets']
          });

          console.log(
            '📥 [Bulk Download] Complete - UI will show updated download status'
          );
        });
      }
    },
    onError: (error) => {
      console.error('📥 [Bulk Download] Failed:', error);
      // Rollback optimistic cache updates if mutation fails
    }
  });

  // Handle download click - start discovery
  const handleDownloadClick = (questId: string) => {
    console.log('📥 [Download] Opening discovery drawer for quest:', questId);
    setQuestIdToDownload(questId);
    setShowDiscoveryDrawer(true);
    // Discovery will auto-start via useEffect
  };

  // Handle discovery completion - show confirmation
  const handleDiscoveryContinue = () => {
    console.log('📥 [Download] Discovery complete, showing confirmation');
    setShowDiscoveryDrawer(false);
    setShowConfirmationModal(true);
  };

  // Handle confirmation - execute bulk download
  const handleConfirmDownload = async () => {
    console.log('📥 [Download] User confirmed, executing bulk download');
    setShowConfirmationModal(false);

    // Track all discovered quest IDs as downloading for optimistic UI
    const questIdsToTrack = new Set(discoveryState.discoveredIds.questIds);
    setDownloadingQuestIds((prev) => new Set([...prev, ...questIdsToTrack]));

    try {
      await bulkDownloadMutation.mutateAsync();
      // Don't clear questIdToDownload yet - wait for sync callback
    } catch (error) {
      // On error, clear downloading state
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        questIdsToTrack.forEach((id) => next.delete(id));
        return next;
      });
      setQuestIdToDownload(null);
      throw error;
    }
  };

  // Handle cancellation
  const handleCancelDiscovery = () => {
    console.log('📥 [Download] User cancelled discovery');
    discoveryState.cancel();

    // Cancel sync callback if registered
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);
      // Clear downloading state
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
    console.log('📥 [Download] User cancelled confirmation');

    // Cancel sync callback if registered
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);

      // Clear downloading state for all discovered quest IDs
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

  if (!book) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>Book not found: {bookId}</Text>
      </View>
    );
  }

  // Don't block on project loading - we can render chapter structure immediately
  // Project metadata will populate targetLanguageId when ready for chapter creation

  const handleChapterPress = (chapterNum: number) => {
    // Prevent any action while creating
    if (isCreating || creatingChapter === chapterNum) {
      return;
    }

    // Check if chapter already exists
    const existingChapter = existingChapters.find(
      (ch) => ch.chapterNumber === chapterNum
    );

    if (existingChapter) {
      // Check directly from SQLite (single source of truth) - async so we need to await
      void (async () => {
        const quest = await system.db.query.quest.findFirst({
          where: (fields, { eq }) => eq(fields.id, existingChapter.id),
          columns: { download_profiles: true, source: true }
        });

        const profiles = quest?.download_profiles;
        let isDownloaded = false;
        if (profiles) {
          const parsed =
            typeof profiles === 'string' ? JSON.parse(profiles) : profiles;
          isDownloaded =
            Array.isArray(parsed) && parsed.includes(currentUser?.id || '');
        }
        const isCloudQuest =
          quest?.source === 'cloud' || existingChapter.source === 'cloud';

        // Anonymous users can navigate directly to cloud records (cloud-only browsing)
        // Authenticated users need to download cloud quests before viewing
        if (currentUser && isCloudQuest && !isDownloaded) {
          // Directly trigger download flow for cloud-only quests
          console.log(
            `📥 Cloud quest not downloaded, triggering download: ${existingChapter.id}`
          );
          handleDownloadClick(existingChapter.id);
          return;
        }

        // Chapter exists and is downloaded (or local), or user is anonymous (cloud-only), navigate to it
        console.log(`📖 Opening existing chapter: ${existingChapter.id}`);
        goToQuest({
          id: existingChapter.id,
          project_id: projectId,
          name: existingChapter.name,
          projectData: project as Record<string, unknown>, // Pass project data!
          questData: existingChapter as unknown as Record<string, unknown> // Pass chapter/quest data!
        });
      })();
      return;
    }

    // Chapter doesn't exist - check permissions
    if (!canCreateNew) {
      RNAlert.alert(t('error'), t('membersOnlyCreate'));
      return;
    }

    // Chapter doesn't exist - show confirmation dialog
    RNAlert.alert(t('createObject'), `${book.name} ${chapterNum}`, [
      {
        text: t('cancel'),
        style: 'cancel'
      },
      {
        text: t('confirm'),
        isPreferred: true,
        onPress: () => {
          void (async () => {
            setCreatingChapter(chapterNum);

            try {
              console.log(
                `📖 Creating new chapter: ${book.name} ${chapterNum}`
              );

              const result = await createChapter({
                projectId,
                bookId,
                chapter: chapterNum,
                targetLanguageId: project?.target_language_id || ''
              });

              console.log(
                `✅ Chapter created! Quest ID: ${result.questId}, ${result.assetCount} assets`
              );

              // Navigate to assets view with passed data
              goToQuest({
                id: result.questId,
                project_id: projectId,
                name: result.questName,
                projectData: project as Record<string, unknown> // Pass project data!
              });
            } catch (error) {
              console.error('Failed to create chapter:', error);
              // TODO: Show error toast or something to user
            } finally {
              setCreatingChapter(null);
            }
          })();
        }
      }
    ]);
  };

  // Generate array of chapter numbers with metadata
  const chapters = Array.from({ length: book.chapters }, (_, i) => {
    const chapterNum = i + 1;
    const verseCount = book.verses[chapterNum - 1] || 0;
    const existingChapter = existingChapters.find(
      (ch) => ch.chapterNumber === chapterNum
    );
    const isCreatingThis = creatingChapter === chapterNum;

    return {
      id: chapterNum,
      chapterNum,
      verseCount,
      existingChapter,
      isCreatingThis
    };
  });

  // Check if we should show empty state (only for non-members with no chapters)
  const hasNoChapters = existingChapters.length === 0;
  const showEmptyState = !isLoadingChapters && hasNoChapters && !canCreateNew;

  return (
    <View className="flex-1">
      <View className="flex-1 flex-col gap-6">
        {/* Header */}
        <View className="flex-row items-center gap-3">
          {bookIconSource ? (
            <Image
              source={bookIconSource}
              style={{ width: 48, height: 48, tintColor: primaryColor }}
              contentFit="contain"
            />
          ) : (
            <Text className="text-4xl">📖</Text>
          )}
          <View className="flex-col">
            <Text variant="h3">{book.name}</Text>
            <Text className="text-sm text-muted-foreground">
              {book.chapters} {t('chapters')}
            </Text>
          </View>
        </View>

        {/* Empty State - only for non-members with no content */}
        {showEmptyState ? (
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
        ) : (
          <LegendList
            data={chapters}
            keyExtractor={(item) => item.id.toString()}
            numColumns={4}
            estimatedItemSize={90}
            contentContainerStyle={{ paddingHorizontal: 8 }}
            columnWrapperStyle={{ gap: 8 }}
            recycleItems
            renderItem={({ item }) =>
              (item.existingChapter || canCreateNew) && (
                <ChapterButton
                  chapterNum={item.chapterNum}
                  verseCount={item.verseCount}
                  existingChapter={item.existingChapter}
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

      {/* Discovery Drawer */}
      <QuestDownloadDiscoveryDrawer
        isOpen={showDiscoveryDrawer}
        onOpenChange={(open) => {
          if (!open) handleCancelDiscovery();
        }}
        onContinue={handleDiscoveryContinue}
        discoveryState={discoveryState}
      />

      {/* Confirmation Modal */}
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
