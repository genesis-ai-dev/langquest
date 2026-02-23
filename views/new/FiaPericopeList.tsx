/**
 * Displays FIA pericopes for a selected book within a project.
 * Modeled on BibleChapterList: shows download/state indicators, creates
 * pericope quests on-demand, and navigates to the recording view.
 * When multiple versions exist for a pericope, shows a picker drawer.
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
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import type { FiaBook, FiaPericope } from '@/hooks/useFiaBooks';
import { useFiaPericopeCreation } from '@/hooks/useFiaPericopeCreation';
import {
  useFiaPericopes,
  type FiaPericopeGroup,
  type FiaPericopeQuest
} from '@/hooks/useFiaPericopes';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { syncCallbackService } from '@/services/syncCallbackService';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenIcon,
  HardDriveIcon,
  PlusCircleIcon,
  UserIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

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

// --- Version card inside the picker drawer ---

function VersionCard({
  version,
  isCurrentUser,
  onPress,
  onDownloadClick,
  isDownloading
}: {
  version: FiaPericopeQuest;
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
        needsDownload && 'opacity-60'
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
            isLoading={isDownloading}
            onPress={() => onDownloadClick(version.id)}
            size={18}
          />
        )}
      </View>
    </Pressable>
  );
}

// --- Pericope button (mirrors ChapterButton) ---

function PericopeButton({
  pericope,
  index,
  group,
  isCreatingThis,
  onPress,
  disabled,
  onDownloadClick,
  canCreateNew,
  downloadingQuestIds = new Set()
}: {
  pericope: FiaPericope;
  index: number;
  group?: FiaPericopeGroup;
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
          getBackgroundColor()
        )}
        onPress={onPress}
        disabled={disabled || (!existingQuest && !canCreateNew)}
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
              <Text className={cn('text-base font-bold', getTextColor())}>
                {pericope.verseRange}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text
                className={cn(
                  'text-xxs',
                  exists ? 'text-card-foreground/70' : 'text-muted-foreground'
                )}
              >
                p{index + 1}
              </Text>
              {versionCount > 1 && (
                <View className="flex-row items-center gap-0.5">
                  <Icon
                    as={UserIcon}
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

      {/* Download overlay removed — downloads are handled via the version picker drawer */}
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

  const { pericopes: pericopeGroups, isLoadingCloud } = useFiaPericopes(
    projectId,
    book.id
  );

  React.useEffect(() => {
    onCloudLoadingChange?.(isLoadingCloud);
  }, [isLoadingCloud, onCloudLoadingChange]);

  // Version picker state
  const [pickerPericopeId, setPickerPericopeId] = React.useState<string | null>(
    null
  );
  const pickerGroup = pericopeGroups.find(
    (g) => g.pericopeId === pickerPericopeId
  );
  const pickerPericope = book.pericopes.find((p) => p.id === pickerPericopeId);

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

  // Navigate to a specific quest version (with download check)
  const navigateToVersion = async (version: FiaPericopeQuest) => {
    if (!currentUser?.id) return;

    // Local versions can always be opened directly
    if (version.source === 'local') {
      goToQuest({
        id: version.id,
        project_id: projectId,
        name: version.name,
        projectData: project as Record<string, unknown>,
        questData: version as unknown as Record<string, unknown>
      });
      setPickerPericopeId(null);
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
      setPickerPericopeId(null);
      handleDownloadClick(version.id);
      return;
    }

    goToQuest({
      id: version.id,
      project_id: projectId,
      name: version.name,
      projectData: project as Record<string, unknown>,
      questData: version as unknown as Record<string, unknown>
    });
    setPickerPericopeId(null);
  };

  // Create a new version for a pericope (even if others exist)
  const createNewVersion = async (pericope: FiaPericope) => {
    if (!currentUser?.id || isCreating || !canCreateNew) return;

    setPickerPericopeId(null);
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

  const handlePericopePress = async (pericope: FiaPericope) => {
    if (!currentUser?.id || isCreating) return;

    const group = pericopeGroups.find((g) => g.pericopeId === pericope.id);

    if (!group || group.versions.length === 0) {
      if (!canCreateNew) return;
      await createNewVersion(pericope);
      return;
    }

    const hasCloudContent = group.versions.some(
      (v) => v.hasSyncedCopy || v.source === 'cloud'
    );

    if (hasCloudContent) {
      setPickerPericopeId(pericope.id);
      return;
    }

    // Only local versions exist — navigate directly to the user's own
    const ownVersion = group.versions.find(
      (v) => v.creator_id === currentUser.id
    );
    if (ownVersion) {
      await navigateToVersion(ownVersion);
      return;
    }

    setPickerPericopeId(pericope.id);
  };

  const pericopeItems = book.pericopes.map((pericope, index) => {
    const group = pericopeGroups.find((g) => g.pericopeId === pericope.id);
    return {
      id: pericope.id,
      pericope,
      index,
      group,
      isCreatingThis: creatingPericopeId === pericope.id
    };
  });

  // Check if the current user already has any version in the picker group
  const userVersion = pickerGroup?.versions.find(
    (v) => v.creator_id === currentUser?.id
  );

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
          (item.group || canCreateNew) && (
            <PericopeButton
              pericope={item.pericope}
              index={item.index}
              group={item.group}
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

      {/* Version picker drawer */}
      <Drawer
        open={!!pickerPericopeId}
        onOpenChange={(open) => {
          if (!open) setPickerPericopeId(null);
        }}
        snapPoints={['50%']}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {pickerPericope?.verseRange ?? 'Pericope'} versions
            </DrawerTitle>
            <DrawerDescription>
              {pickerGroup?.versions.length ?? 0} version
              {(pickerGroup?.versions.length ?? 0) !== 1 ? 's' : ''} available
            </DrawerDescription>
          </DrawerHeader>

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

          {canCreateNew && !userVersion && pickerPericope && (
            <Pressable
              onPress={() => createNewVersion(pickerPericope)}
              className="flex-row items-center gap-3 rounded-lg border border-dashed border-border p-4 active:opacity-70"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Icon as={PlusCircleIcon} size={20} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-primary">
                  Create your own version
                </Text>
                <Text className="text-sm text-muted-foreground">
                  Start a new recording for this pericope
                </Text>
              </View>
            </Pressable>
          )}
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
