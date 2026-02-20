/**
 * Displays FIA pericopes for a selected book within a project.
 * Modeled on BibleChapterList: shows download/state indicators, creates
 * pericope quests on-demand, and navigates to the recording view.
 */

import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import type { FiaBook, FiaPericope } from '@/hooks/useFiaBooks';
import { useFiaPericopeCreation } from '@/hooks/useFiaPericopeCreation';
import {
  useFiaPericopes,
  type FiaPericopeQuest
} from '@/hooks/useFiaPericopes';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { syncCallbackService } from '@/services/syncCallbackService';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpenIcon, HardDriveIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Image, TouchableOpacity, View } from 'react-native';

const FIA_TO_BIBLE_BOOK_ID: Record<string, string> = {
  mrk: 'mar',
  php: 'phi',
  jol: 'joe',
  nam: 'nah'
};

function getFiaBookIcon(fiaBookId: string) {
  if (BOOK_ICON_MAP[fiaBookId]) return BOOK_ICON_MAP[fiaBookId];
  const mappedId = FIA_TO_BIBLE_BOOK_ID[fiaBookId];
  if (mappedId && BOOK_ICON_MAP[mappedId]) return BOOK_ICON_MAP[mappedId];
  return null;
}

// --- Pericope button (mirrors ChapterButton) ---

function PericopeButton({
  pericope,
  index,
  existingQuest,
  isCreatingThis,
  onPress,
  disabled,
  onDownloadClick,
  canCreateNew,
  downloadingQuestIds = new Set()
}: {
  pericope: FiaPericope;
  index: number;
  existingQuest?: FiaPericopeQuest;
  isCreatingThis: boolean;
  onPress: () => void;
  disabled: boolean;
  onDownloadClick: (questId: string) => void;
  canCreateNew: boolean;
  downloadingQuestIds?: Set<string>;
}) {
  const { currentUser } = useAuth();
  const exists = !!existingQuest;
  const hasLocalCopy = existingQuest?.hasLocalCopy ?? false;
  const hasSyncedCopy = existingQuest?.hasSyncedCopy ?? false;
  const isCloudQuest = existingQuest?.source === 'cloud';

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
          'h-auto w-full flex-col gap-1 py-5',
          !exists && 'border-dashed',
          needsDownload && 'opacity-50',
          getBackgroundColor()
        )}
        onPress={onPress}
        disabled={
          disabled || needsDownload || (!existingQuest && !canCreateNew)
        }
      >
        {isCreatingThis ? (
          <ActivityIndicator size="small" />
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
                      hasSyncedCopy || hasLocalCopy
                        ? 'text-secondary'
                        : 'text-foreground'
                    }
                  />
                </View>
              )}
              <Text className={cn('text-base font-bold', getTextColor())}>
                {pericope.verseRange}
              </Text>
            </View>
            <Text
              className={cn(
                'text-xxs',
                exists ? 'text-card-foreground/70' : 'text-muted-foreground'
              )}
            >
              p{index + 1}
            </Text>
          </View>
        )}
      </Button>

      {needsDownload && !disabled && (
        <TouchableOpacity
          onPress={handleDownloadToggle}
          className="absolute inset-0"
          activeOpacity={0.7}
        />
      )}
    </View>
  );
}

// --- Main list ---

interface FiaPericopeListProps {
  projectId: string;
  book: FiaBook;
  onCloudLoadingChange?: (isLoading: boolean) => void;
}

export function FiaPericopeList({
  projectId,
  book,
  onCloudLoadingChange
}: FiaPericopeListProps) {
  const { currentUser } = useAuth();
  const { goToQuest } = useAppNavigation();
  const { createPericope, isCreating } = useFiaPericopeCreation();
  const queryClient = useQueryClient();
  const [creatingPericopeId, setCreatingPericopeId] = React.useState<
    string | null
  >(null);

  const { project } = useProjectById(projectId);
  const isPrivate = project?.private ?? false;
  const primaryColor = useThemeColor('primary');
  const iconSource = getFiaBookIcon(book.id);

  const { membership } = useUserPermissions(
    projectId,
    'open_project',
    isPrivate
  );
  const isMember = membership === 'member' || membership === 'owner';
  const canCreateNew = isMember;

  // Existing pericope quests (local + cloud, with source tracking)
  const { pericopes: existingPericopes, isLoadingCloud } = useFiaPericopes(
    projectId,
    book.id
  );

  React.useEffect(() => {
    onCloudLoadingChange?.(isLoadingCloud);
  }, [isLoadingCloud, onCloudLoadingChange]);

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
          queryKey: ['fia-pericope-quests', 'local', projectId, book.id],
          exact: false
        },
        updateCache
      );
      await queryClient.setQueriesData(
        {
          queryKey: ['fia-pericope-quests', 'cloud', projectId, book.id],
          exact: false
        },
        updateCache
      );
    },
    onSuccess: async () => {
      if (questIdToDownload) {
        const questIdsToClear = discoveryState.discoveredIds.questIds;

        syncCallbackService.registerCallback(questIdToDownload, async () => {
          setDownloadingQuestIds((prev) => {
            const next = new Set(prev);
            questIdsToClear.forEach((id) => next.delete(id));
            return next;
          });

          await queryClient.invalidateQueries({
            queryKey: ['fia-pericope-quests', 'local', projectId, book.id]
          });
          await queryClient.invalidateQueries({
            queryKey: ['fia-pericope-quests', 'cloud', projectId, book.id]
          });
          await queryClient.invalidateQueries({ queryKey: ['assets'] });
        });
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

  const handlePericopePress = async (pericope: FiaPericope) => {
    if (!currentUser?.id || isCreating) return;

    const existing = existingPericopes.find(
      (p) => p.pericopeId === pericope.id
    );

    if (existing) {
      // Check download status from SQLite
      const questRow = await system.db.query.quest.findFirst({
        where: (fields, { eq }) => eq(fields.id, existing.id),
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
        questRow?.source === 'cloud' || existing.source === 'cloud';

      if (currentUser && isCloudQuest && !isDownloaded) {
        handleDownloadClick(existing.id);
        return;
      }

      goToQuest({
        id: existing.id,
        project_id: projectId,
        name: existing.name,
        projectData: project as Record<string, unknown>,
        questData: existing as unknown as Record<string, unknown>
      });
      return;
    }

    if (!canCreateNew) return;

    setCreatingPericopeId(pericope.id);
    try {
      const result = await createPericope({
        projectId,
        bookId: book.id,
        bookTitle: book.title,
        pericopeId: pericope.id,
        verseRange: pericope.verseRange,
        totalPericopesInBook: book.pericopes.length
      });

      goToQuest({
        id: result.questId,
        project_id: projectId,
        name: result.questName,
        projectData: project as Record<string, unknown>
      });
    } catch (error) {
      console.error('Failed to create pericope quest:', error);
    } finally {
      setCreatingPericopeId(null);
    }
  };

  const pericopeItems = book.pericopes.map((pericope, index) => {
    const existingQuest = existingPericopes.find(
      (p) => p.pericopeId === pericope.id
    );
    return {
      id: pericope.id,
      pericope,
      index,
      existingQuest,
      isCreatingThis: creatingPericopeId === pericope.id
    };
  });

  return (
    <View className="flex-1">
      <View className="mb-4 flex-row items-center gap-3 px-2">
        {iconSource ? (
          <Image
            source={iconSource}
            style={{ width: 48, height: 48, tintColor: primaryColor }}
            resizeMode="contain"
          />
        ) : (
          <Icon as={BookOpenIcon} size={32} className="text-primary" />
        )}
        <View>
          <Text variant="h4">{book.title}</Text>
          <Text className="text-sm text-muted-foreground">
            {book.pericopes.length} pericopes
          </Text>
        </View>
      </View>

      <LegendList
        data={pericopeItems}
        keyExtractor={(item) => item.id}
        numColumns={3}
        estimatedItemSize={90}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        recycleItems
        renderItem={({ item }) =>
          (item.existingQuest || canCreateNew) && (
            <PericopeButton
              pericope={item.pericope}
              index={item.index}
              existingQuest={item.existingQuest}
              isCreatingThis={item.isCreatingThis}
              onPress={() => handlePericopePress(item.pericope)}
              disabled={Boolean(isCreating)}
              onDownloadClick={handleDownloadClick}
              canCreateNew={canCreateNew}
              downloadingQuestIds={downloadingQuestIds}
            />
          )
        }
      />

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
