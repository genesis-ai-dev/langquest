/**
 * Displays FIA pericopes for a selected book within a project.
 * Modeled on BibleChapterList: shows download/state indicators, creates
 * pericope quests on-demand, and navigates to the recording view.
 * Members and owners always get the version picker (including Create new
 * version). Guests skip it when only one version exists.
 */

import { DownloadStatusBadge } from '@/components/DownloadStatusBadge';
import {
  QuestCreateNewVersionRow,
  QuestVersionPickerCard
} from '@/components/QuestVersionPickerCard';
import { Button } from '@/components/ui/button';
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
import { useAuth } from '@/contexts/AuthContext';
import { useProjectById } from '@/hooks/db/useProjects';
import type { FiaBook, FiaPericope } from '@/hooks/useFiaBooks';
import { useFiaPericopeCreation } from '@/hooks/useFiaPericopeCreation';
import type {
  FiaPericopeGroup,
  FiaPericopeQuest
} from '@/hooks/useFiaPericopes';
import { useFiaPericopes } from '@/hooks/useFiaPericopes';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useQuestDownloadFlow } from '@/hooks/useQuestDownloadFlow';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { enqueue as enqueueFiaAttachment } from '@/services/FiaAttachmentQueue';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { shouldOpenQuestVersionPicker } from '@/utils/questVersionPicker';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { Image } from 'expo-image';
import {
  BookOpenIcon,
  FileStackIcon,
  HardDriveIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

// --- Version card inside the picker drawer ---

function VersionCard({
  version,
  isCurrentUser,
  onPress,
  isDownloading,
  downloadedQuestIds
}: {
  version: FiaPericopeQuest;
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

// --- Pericope button (mirrors ChapterButton) ---

function PericopeButton({
  pericope,
  index,
  group,
  isCreatingThis,
  onPress,
  disabled,
  canCreateNew,
  downloadingQuestIds = new Set(),
  downloadedQuestIds = new Set()
}: {
  pericope: FiaPericope;
  index: number;
  group?: FiaPericopeGroup;
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

  const primaryColor = useThemeColor('primary');
  const { currentUser } = useAuth();
  const isSignedIn = Boolean(currentUser);

  const isDisabledEmpty = !existingQuest && !canCreateNew;

  return (
    <View
      className={cn(
        'relative w-full flex-col gap-1',
        isDisabledEmpty && 'opacity-40'
      )}
    >
      <Button
        variant={exists ? 'default' : 'outline'}
        className={cn(
          'h-auto w-full flex-col gap-1 py-5',
          !exists && 'border-dashed',
          getBackgroundColor()
        )}
        onPress={onPress}
        disabled={disabled || isDisabledEmpty}
      >
        <View className="w-full flex-col items-center gap-1">
          <View className="min-h-8 w-full items-center justify-center">
            {isCreatingThis ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <>
                <View className="flex-row items-center justify-center gap-1">
                  <View className="h-5 min-w-0 flex-row items-center justify-center gap-0.5">
                    {isSignedIn && hasLocalCopy && (
                      <Icon
                        as={HardDriveIcon}
                        size={14}
                        className="text-secondary"
                      />
                    )}
                    {isSignedIn &&
                      exists &&
                      (hasSyncedCopy || isCloudQuest) && (
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
                  </View>
                </View>
                <Text className={cn('text-base font-bold', getTextColor())}>
                  {pericope.verseRange}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Text
                    className={cn(
                      'text-xxs',
                      exists
                        ? 'text-card-foreground/70'
                        : 'text-muted-foreground'
                    )}
                  >
                    p{index + 1}
                  </Text>
                  {versionCount > 1 && (
                    <View className="flex-row items-center gap-0.5">
                      <Icon
                        as={FileStackIcon}
                        size={12}
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
              </>
            )}
          </View>
        </View>
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
  const { t } = useLocalization();
  const { goToQuest } = useNavigationHelpers();
  const { createPericope, isCreating } = useFiaPericopeCreation();
  const [creatingPericopeId, setCreatingPericopeId] = React.useState<
    string | null
  >(null);
  const { project } = useProjectById(projectId);
  const isPrivate = project?.private ?? false;
  const primaryColor = useThemeColor('primary');

  const { membership } = useUserPermissions(
    projectId,
    'open_project',
    isPrivate
  );
  const isConnected = useNetworkStatus();
  const isMember = membership === 'member' || membership === 'owner';
  const canCreateNew = isMember && isConnected;

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

  const questDownloadFlow = useQuestDownloadFlow(projectId);
  const { downloadingQuestIds, downloadedQuestIds } = questDownloadFlow;

  const navigateToVersion = (version: FiaPericopeQuest) => {
    setPickerPericopeId(null);
    void questDownloadFlow.openQuest(version, isMember);
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

      enqueueFiaAttachment(pericope.id, projectId);

      goToQuest({
        id: result.questId,
        project_id: projectId,
        name: result.questName,
        promptVersionLabel: true
      });
    } catch (error) {
      console.error('Failed to create pericope quest:', error);
    } finally {
      setCreatingPericopeId(null);
    }
  };

  const handlePericopePress = async (pericope: FiaPericope) => {
    if (isCreating) return;

    const group = pericopeGroups.find((g) => g.pericopeId === pericope.id);

    if (!group || group.versions.length === 0) {
      if (!canCreateNew) return;
      await createNewVersion(pericope);
      return;
    }

    if (shouldOpenQuestVersionPicker(isMember, group.versions.length)) {
      setPickerPericopeId(pericope.id);
      return;
    }

    navigateToVersion(group.versions[0]!);
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

  return (
    <View className="flex-1">
      <LegendList
        data={pericopeItems}
        keyExtractor={(item) => item.id}
        numColumns={3}
        estimatedItemSize={90}
        ListHeaderComponent={
          <View className="mb-4 w-full flex-row items-center gap-3">
            {BOOK_ICON_MAP[book.id] ? (
              <Image
                source={BOOK_ICON_MAP[book.id]}
                style={{ width: 48, height: 48, tintColor: primaryColor }}
                contentFit="contain"
              />
            ) : (
              <Icon as={BookOpenIcon} size={32} className="text-primary" />
            )}
            <View className="min-w-0 flex-1 flex-col items-start">
              <Text variant="h4" className="w-full text-left">
                {book.title}
              </Text>
              <Text className="w-full text-left text-sm text-muted-foreground">
                {book.pericopes.length} {t('pericopes')}
              </Text>
            </View>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 16 }}
        columnWrapperStyle={{ gap: 8 }}
        extraData={`${[...downloadingQuestIds].join(',')}|${[...downloadedQuestIds].join(',')}`}
        recycleItems
        renderItem={({ item }) => (
          <PericopeButton
            pericope={item.pericope}
            index={item.index}
            group={item.group}
            isCreatingThis={item.isCreatingThis}
            onPress={() => handlePericopePress(item.pericope)}
            disabled={Boolean(isCreating)}
            canCreateNew={canCreateNew}
            downloadingQuestIds={downloadingQuestIds}
            downloadedQuestIds={downloadedQuestIds}
          />
        )}
      />

      <Drawer
        open={!!pickerPericopeId}
        onOpenChange={(open) => {
          if (!open) setPickerPericopeId(null);
        }}
        snapPoints={['40%']}
        enableDynamicSizing={false}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {pickerPericope?.verseRange ?? t('pericope')} {t('versions')}
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

            {canCreateNew && pickerPericope && (
              <QuestCreateNewVersionRow
                onPress={() => createNewVersion(pickerPericope)}
              />
            )}
          </View>
        </DrawerContent>
      </Drawer>

      {questDownloadFlow.sheets}
    </View>
  );
}
