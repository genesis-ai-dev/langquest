/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { QuestSettingsModal } from '@/components/QuestSettingsModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  SpeedDial,
  SpeedDialItem,
  SpeedDialItems,
  SpeedDialTrigger
} from '@/components/ui/speed-dial';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { asset } from '@/db/drizzleSchema';
import { project, quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import {
  useAppNavigation,
  useCurrentNavigation
} from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import { LegendList } from '@legendapp/list';
import {
  ArrowBigDownDashIcon,
  CheckIcon,
  FlagIcon,
  InfoIcon,
  LockIcon,
  MicIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  Share2Icon,
  ShieldOffIcon,
  UserPlusIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HybridDataSource } from './useHybridData';
import { useHybridData } from './useHybridData';

import { AssetListSkeleton } from '@/components/AssetListSkeleton';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { QuestOffloadVerificationDrawer } from '@/components/QuestOffloadVerificationDrawer';
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useBlockedAssetsCount } from '@/hooks/useBlockedCount';
import { useQuestOffloadVerification } from '@/hooks/useQuestOffloadVerification';
import { useHasUserReported } from '@/hooks/useReports';
import { publishQuest as publishQuestUtils } from '@/utils/publishUtils';
import { offloadQuest } from '@/utils/questOffloadUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { AssetListItem } from './AssetListItem';
import RecordingViewSimplified from './recording/components/RecordingViewSimplified';

type Asset = typeof asset.$inferSelect;
type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
};

export default function NextGenAssetsView() {
  const {
    currentQuestId,
    currentProjectId,
    currentProjectData,
    currentQuestData
  } = useCurrentNavigation();
  const { goBack } = useAppNavigation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [debouncedSearchQuery, searchQuery, setSearchQuery] = useDebouncedState(
    '',
    300
  );
  const { t } = useLocalization();
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showOffloadDrawer, setShowOffloadDrawer] = React.useState(false);
  const [showPrivateAccessModal, setShowPrivateAccessModal] =
    React.useState(false);
  const [isOffloading, setIsOffloading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Animation for refresh button
  const spinValue = useSharedValue(0);

  React.useEffect(() => {
    if (isRefreshing) {
      spinValue.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.linear }),
        -1
      );
    } else {
      cancelAnimation(spinValue);
      spinValue.value = 0;
    }
  }, [isRefreshing, spinValue]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value * 360}deg` }]
  }));

  type Quest = typeof questTable.$inferSelect;

  // Use passed quest data if available (instant!), otherwise query
  const { data: queriedQuestData, refetch: refetchQuest } = useHybridData({
    dataType: 'current-quest',
    queryKeyParams: [currentQuestId],
    offlineQuery: toCompilableQuery(
      system.db.query.quest.findFirst({
        where: eq(questTable.id, currentQuestId!)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', currentQuestId)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!currentQuestId,
    enableOfflineQuery: !!currentQuestId,
    getItemId: (item) => item.id
  });

  // Prefer queried data (fresh) over navigation data (may be stale)
  // This ensures UI updates immediately after publishing without needing to navigate away
  const selectedQuest = React.useMemo(() => {
    // If we have queried data, prefer it (it's fresh from refetch)
    // Otherwise fall back to currentQuestData for instant initial rendering
    const questData =
      queriedQuestData && queriedQuestData.length > 0
        ? queriedQuestData
        : currentQuestData
          ? [currentQuestData as Quest]
          : undefined;
    return questData?.[0];
  }, [currentQuestData, queriedQuestData]);

  // Query project data to get privacy status if not passed
  const { data: queriedProjectData } = useHybridData({
    dataType: 'project-privacy-assets',
    queryKeyParams: [currentProjectId],
    offlineQuery: toCompilableQuery(
      system.db.query.project.findFirst({
        where: eq(project.id, currentProjectId!),
        columns: { id: true, private: true, creator_id: true }
      })
    ),
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('id, private, creator_id')
        .eq('id', currentProjectId);
      if (error) throw error;
      return data as Pick<
        typeof project.$inferSelect,
        'id' | 'private' | 'creator_id'
      >[];
    },
    enableCloudQuery: !!currentProjectId && !currentProjectData,
    enableOfflineQuery: !!currentProjectId && !currentProjectData,
    getItemId: (item) => item.id
  });

  // Prefer passed project data for instant rendering
  const projectPrivacyData = currentProjectData
    ? {
        private: currentProjectData.private,
        creator_id: currentProjectData.creator_id
      }
    : queriedProjectData?.[0];
  const isPrivateProject = projectPrivacyData?.private ?? false;

  const [showRecording, setShowRecording] = React.useState(false);

  const { membership } = useUserPermissions(
    currentProjectId || '',
    'open_project',
    !!isPrivateProject
  );

  const isOwner = membership === 'owner';
  const isMember = membership === 'member' || membership === 'owner';
  // Check if user is creator
  const isCreator = currentUser?.id === projectPrivacyData?.creator_id;
  // User can see published badge if they are creator, member, or owner
  const canSeePublishedBadge = isCreator || isMember;

  // Initialize offload verification hook
  const verificationState = useQuestOffloadVerification(currentQuestId || '');

  // Query SQLite directly - single source of truth, no cache, no race conditions
  const isQuestDownloaded = useQuestDownloadStatusLive(currentQuestId || null);

  // Clean deeper layers
  const currentStatus = useStatusContext();
  currentStatus.layerStatus(LayerType.QUEST, currentQuestId || '');
  const showInvisibleContent = useLocalStore((s) => s.showHiddenContent);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching,
    refetch
  } = useAssetsByQuest(
    currentQuestId || '',
    debouncedSearchQuery,
    showInvisibleContent
  );

  // Flatten all pages into a single array and deduplicate
  // Prefer synced over local when the same asset ID appears in both
  const assets = React.useMemo(() => {
    const allAssets = data.pages.flatMap((page) => page.data);
    const assetMap = new Map<string, AssetQuestLink>();

    // First pass: collect all assets, preferring synced over local
    for (const asset of allAssets) {
      const existing = assetMap.get(asset.id);
      if (!existing) {
        assetMap.set(asset.id, asset);
      } else {
        // Prefer synced over local
        if (asset.source === 'synced' && existing.source !== 'synced') {
          assetMap.set(asset.id, asset);
        }
      }
    }

    return Array.from(assetMap.values());
  }, [data.pages]);

  const assetIds = React.useMemo(() => {
    return assets.map((asset) => asset.id).filter((id): id is string => !!id);
  }, [assets]);

  const { attachmentStates, isLoading: isAttachmentStatesLoading } =
    useAttachmentStates(assetIds);

  const safeAttachmentStates = attachmentStates;

  const blockedCount = useBlockedAssetsCount(currentQuestId || '');

  const attachmentStateSummary = React.useMemo(() => {
    if (safeAttachmentStates.size === 0) {
      return {};
    }

    const states = Array.from(safeAttachmentStates.values());
    const summary = states.reduce(
      (acc, attachment) => {
        acc[attachment.state] = (acc[attachment.state] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );
    return summary;
    // Use memo key instead of Map reference for stable dependencies (always 1 string)
  }, [safeAttachmentStates]);

  const renderItem = React.useCallback(
    ({ item }: { item: AssetQuestLink & { source?: HybridDataSource } }) => (
      <AssetListItem
        key={item.id}
        asset={item}
        attachmentState={safeAttachmentStates.get(item.id)}
        questId={currentQuestId || ''}
      />
    ),
    // Use stable memo key instead of Map reference to prevent hook dependency issues
    // Always has exactly 2 dependencies (string, string) - never changes size
    [currentQuestId, safeAttachmentStates]
  );

  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // footer handled inline in ListFooterComponent

  const statusText = React.useMemo(() => {
    const cloudCount = assets.filter((a) => a.source === 'cloud').length;
    const offlineCount = assets.length - cloudCount;
    return `${isOnline ? '🟢' : '🔴'} Offline: ${offlineCount} | Cloud: ${isOnline ? cloudCount : 'N/A'} | Total: ${assets.length}`;
  }, [isOnline, assets]);

  const attachmentSummaryText = React.useMemo(() => {
    return Object.entries(attachmentStateSummary)
      .map(([state, count]) => {
        const stateNames = {
          '0': `⏳ ${t('queued')}`,
          '1': `🔄 ${t('syncing')}`,
          '2': `✅ ${t('synced')}`,
          '3': `❌ ${t('failed')}`,
          '4': `📥 ${t('downloading')}`
        };
        return `${stateNames[state as keyof typeof stateNames] || `${t('state')} ${state}`}: ${count}`;
      })
      .join(' | ');
  }, [attachmentStateSummary, t]);

  const {
    hasReported,
    // isLoading: isReportLoading,
    refetch: refetchReport
  } = useHasUserReported(currentQuestId || '', 'quests');

  const statusContext = useStatusContext();
  const { allowSettings } = statusContext.getStatusParams(
    LayerType.QUEST,
    currentQuestId
  );

  // Handle publish button press with useMutation
  const { mutate: publishQuest, isPending: isPublishing } = useMutation({
    mutationFn: async () => {
      if (!currentQuestId || !currentProjectId) {
        throw new Error('Missing quest or project ID');
      }
      console.log(`📤 Publishing quest ${currentQuestId}...`);
      const result = await publishQuestUtils(currentQuestId, currentProjectId);
      return result;
    },
    onSuccess: async (result) => {
      if (result.success) {
        // Wait for PowerSync to sync the published quest before invalidating
        await new Promise((resolve) => setTimeout(resolve, 1500));

        console.log('📥 [Publish Quest] Invalidating queries...');

        // Invalidate the quest query used by this component
        await queryClient.invalidateQueries({
          queryKey: ['current-quest', 'offline', currentQuestId]
        });
        await queryClient.invalidateQueries({
          queryKey: ['current-quest', 'cloud', currentQuestId]
        });

        // Invalidate general quest queries
        await queryClient.invalidateQueries({
          queryKey: ['quests', 'for-project', currentProjectId]
        });
        await queryClient.invalidateQueries({
          queryKey: ['quests', 'infinite', 'for-project', currentProjectId]
        });
        await queryClient.invalidateQueries({
          queryKey: ['quests', 'offline', 'for-project', currentProjectId]
        });
        await queryClient.invalidateQueries({
          queryKey: ['quests', 'cloud', 'for-project', currentProjectId]
        });
        await queryClient.invalidateQueries({
          queryKey: ['quests']
        });

        // Invalidate assets queries to refresh the assets list
        await queryClient.invalidateQueries({
          queryKey: ['assets']
        });

        // Refetch quest data to update the selectedQuest immediately
        void refetchQuest();

        // Refetch assets to update download indicators
        void refetch();

        console.log('✅ [Publish Quest] All queries invalidated');

        Alert.alert(t('success'), result.message, [{ text: t('ok') }]);
      } else {
        Alert.alert(t('error'), result.message || t('error'), [
          { text: t('ok') }
        ]);
      }
    },
    onError: (error) => {
      console.error('Publish error:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedCreateTranslation'),
        [{ text: t('ok') }]
      );
    }
  });

  // Handle offload button click - start verification
  const handleOffloadClick = () => {
    console.log('🗑️ [Offload] Opening verification drawer');
    setShowOffloadDrawer(true);
    verificationState.startVerification();
  };

  // Handle offload confirmation - execute offload
  const handleOffloadConfirm = async () => {
    console.log('🗑️ [Offload] User confirmed, executing offload');
    setIsOffloading(true);
    try {
      await offloadQuest({
        questId: currentQuestId || '',
        verifiedIds: verificationState.verifiedIds,
        onProgress: (progress, message) => {
          console.log(`🗑️ [Offload Progress] ${progress}%: ${message}`);
        }
      });

      console.log('🗑️ [Offload] Complete - waiting for PowerSync to sync...');
      // Wait for PowerSync to sync the removal before invalidating
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log('🗑️ [Offload] Invalidating all queries...');

      // Invalidate download status queries
      await queryClient.invalidateQueries({
        queryKey: ['download-status', 'quest', currentQuestId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['download-status', 'project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quest-download-status', currentQuestId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['project-download-status', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['download-status']
      });

      // Invalidate ALL quest queries (comprehensive like create quest)
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'infinite', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'offline', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'cloud', 'for-project', currentProjectId]
      });
      // Also invalidate generic quest queries
      await queryClient.invalidateQueries({
        queryKey: ['quests']
      });

      // Invalidate project queries
      await queryClient.invalidateQueries({
        queryKey: ['projects']
      });

      // Invalidate assets queries to refresh the assets list
      await queryClient.invalidateQueries({
        queryKey: ['assets']
      });

      // Invalidate quest closure data
      await queryClient.invalidateQueries({
        queryKey: ['quest-closure', currentQuestId]
      });

      console.log('✅ [Offload] All queries invalidated');

      Alert.alert(t('success'), t('offloadComplete'));
      setShowOffloadDrawer(false);

      // Navigate back to project directory view (quests view)
      goBack();
    } catch (error) {
      console.error('Failed to offload quest:', error);
      Alert.alert(t('error'), t('offloadError'));
    } finally {
      setIsOffloading(false);
    }
  };

  if (!currentQuestId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>{t('noQuestSelected')}</Text>
      </View>
    );
  }

  // Recording mode UI
  if (showRecording) {
    // Pass existing assets as initial data for instant rendering
    return (
      <RecordingViewSimplified
        onBack={() => {
          setShowRecording(false);
          // Refetch to show newly recorded assets
          void refetch();
        }}
        initialAssets={assets}
      />
    );
  }

  // Check if quest is published (source is 'synced')
  const isPublished = selectedQuest?.source === 'synced';

  // Get project name for PrivateAccessGate
  // Note: queriedProjectData doesn't include name, so we only use currentProjectData
  const projectName = currentProjectData?.name || '';

  return (
    <View className="flex flex-1 flex-col gap-6 p-6">
      <View className="flex flex-row items-center justify-between">
        <View className="flex flex-row items-center gap-2">
          <Text className="text-xl font-semibold">{t('assets')}</Text>
          <Button
            variant="ghost"
            size="icon"
            disabled={isRefreshing}
            onPress={async () => {
              setIsRefreshing(true);
              console.log('🔄 Manually refreshing assets queries...');
              await queryClient.invalidateQueries({
                queryKey: ['assets']
              });
              void refetch();
              console.log('🔄 Assets queries invalidated');
              // Stop animation after a brief delay
              setTimeout(() => {
                setIsRefreshing(false);
              }, 500);
            }}
          >
            <Animated.View style={spinStyle}>
              <Icon as={RefreshCwIcon} size={18} className="text-primary" />
            </Animated.View>
          </Button>
        </View>
        {isPublished ? (
          // Only show published badge if user is creator, member, or owner
          canSeePublishedBadge ? (
            <Badge
              variant="default"
              className="flex flex-row items-center gap-1 bg-chart-5/80"
            >
              <Icon as={CheckIcon} size={14} className="text-white" />
              <Text className="font-medium text-white">{t('published')}</Text>
            </Badge>
          ) : (
            // Show membership request button for non-members viewing published quest
            isPrivateProject && (
              <Button
                variant="default"
                size="sm"
                onPress={() => setShowPrivateAccessModal(true)}
              >
                <Icon as={UserPlusIcon} size={16} />
                <Icon as={LockIcon} size={16} />
              </Button>
            )
          )
        ) : (
          // Only show publish/record buttons for authenticated users
          currentUser && (
            <View className="flex flex-row items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={isPublishing || !isOnline || !isMember}
                onPress={() => {
                  if (!isOnline) {
                    Alert.alert(t('error'), t('cannotPublishWhileOffline'));
                    return;
                  }

                  if (!isMember) {
                    Alert.alert(t('error'), t('membersOnlyPublish'));
                    return;
                  }

                  if (!currentQuestId) {
                    console.error('No current quest id');
                    return;
                  }

                  // Use quest name if available, otherwise generic message
                  const questName = selectedQuest?.name || 'this chapter';

                  Alert.alert(
                    t('publishChapter'),
                    t('publishChapterMessage').replace(
                      '{questName}',
                      questName
                    ),
                    [
                      {
                        text: t('cancel'),
                        style: 'cancel'
                      },
                      {
                        text: t('publish'),
                        style: 'default',
                        onPress: () => {
                          publishQuest();
                        }
                      }
                    ]
                  );
                }}
              >
                {isPublishing ? (
                  <ActivityIndicator
                    size="small"
                    color={getThemeColor('primary')}
                  />
                ) : (
                  <Icon as={Share2Icon} />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-[1.5px] border-primary"
                onPress={() => setShowRecording(true)}
              >
                <Icon as={PencilIcon} className="text-primary" />
              </Button>
            </View>
          )
        )}
      </View>

      <Input
        placeholder={t('searchAssets')}
        value={searchQuery}
        onChangeText={setSearchQuery}
        prefix={SearchIcon}
        prefixStyling={false}
        size="sm"
        returnKeyType="search"
        suffix={
          isFetching && searchQuery ? (
            <ActivityIndicator size="small" color={getThemeColor('primary')} />
          ) : undefined
        }
        suffixStyling={false}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      />

      {SHOW_DEV_ELEMENTS && (
        <Text className="text-sm text-muted-foreground">{statusText}</Text>
      )}

      {SHOW_DEV_ELEMENTS &&
        !isAttachmentStatesLoading &&
        safeAttachmentStates.size > 0 && (
          <View className="rounded-md bg-muted p-3">
            <Text className="mb-1 font-semibold">
              📎 {t('liveAttachmentStates')}:
            </Text>
            <Text className="text-muted-foreground">
              {attachmentSummaryText}
            </Text>
          </View>
        )}

      {isLoading || (isFetching && assets.length === 0) ? (
        searchQuery.trim().length > 0 ? (
          <View className="flex-1 items-center justify-center pt-8">
            <ActivityIndicator size="large" color={getThemeColor('primary')} />
            <Text className="mt-4 text-muted-foreground">{t('searching')}</Text>
          </View>
        ) : (
          <AssetListSkeleton />
        )
      ) : (
        <LegendList
          data={assets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderItem({ item })}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          estimatedItemSize={120}
          recycleItems
          contentContainerStyle={{
            gap: 8,
            paddingBottom: !isPublished ? 100 : 24
          }}
          maintainVisibleContentPosition
          ListFooterComponent={() => (
            <View className="gap-2">
              {isFetchingNextPage && (
                <View className="items-center py-4">
                  <ActivityIndicator
                    size="small"
                    color={getThemeColor('primary')}
                  />
                </View>
              )}
              {blockedCount > 0 && (
                <View className="flex-row items-center justify-center gap-2 py-4">
                  <Icon
                    as={ShieldOffIcon}
                    size={16}
                    className="text-muted-foreground"
                  />
                  <Text className="text-sm text-muted-foreground">
                    {blockedCount}{' '}
                    {blockedCount === 1 ? 'blocked item' : 'blocked items'}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-16">
              <View className="flex-col items-center gap-2">
                <Text className="text-muted-foreground">
                  {isPublished ? t('noAssetsFound') : t('nothingHereYet')}
                </Text>
                {!isPublished && (
                  <Icon
                    as={ArrowBigDownDashIcon}
                    size={48}
                    className="text-muted-foreground"
                  />
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Sticky Record Button Footer - only show for authenticated users */}
      {!isPublished && currentUser && (
        <View
          style={{
            paddingBottom: insets.bottom,
            paddingRight: 75 // Leave space for SpeedDial on the right (24 margin + ~56 width + padding)
          }}
        >
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            onPress={() => setShowRecording(true)}
          >
            <Icon
              as={MicIcon}
              size={24}
              className="text-destructive-foreground"
            />
            <Text className="ml-2 text-lg font-semibold text-destructive-foreground">
              {t('doRecord')}
            </Text>
          </Button>
        </View>
      )}

      <View
        style={{
          bottom: insets.bottom + 24,
          right: 24
        }}
        className="absolute z-50"
      >
        <SpeedDial>
          <SpeedDialItems>
            {/* For anonymous users, only show info button */}
            {currentUser ? (
              <>
                {allowSettings && isOwner ? (
                  <SpeedDialItem
                    icon={SettingsIcon}
                    variant="outline"
                    onPress={() => setShowSettingsModal(true)}
                  />
                ) : !hasReported ? (
                  <SpeedDialItem
                    icon={FlagIcon}
                    variant="outline"
                    onPress={() => setShowReportModal(true)}
                  />
                ) : null}
              </>
            ) : null}
            {/* Info button always visible */}
            <SpeedDialItem
              icon={InfoIcon}
              variant="outline"
              onPress={() => {
                console.log('📋 [Info] Opening details modal', {
                  selectedQuest: selectedQuest?.id,
                  isDownloaded: isQuestDownloaded,
                  storageBytes: verificationState.estimatedStorageBytes
                });
                setShowDetailsModal(true);
                // Start verification to get storage estimate if quest is downloaded
                if (isQuestDownloaded && !verificationState.isVerifying) {
                  verificationState.startVerification();
                }
              }}
            />
          </SpeedDialItems>
          <SpeedDialTrigger />
        </SpeedDial>
      </View>

      {allowSettings && isOwner && (
        <QuestSettingsModal
          isVisible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          questId={currentQuestId}
          projectId={currentProjectId || ''}
        />
      )}
      {selectedQuest && (
        <ModalDetails
          isVisible={showDetailsModal}
          contentType="quest"
          content={selectedQuest}
          onClose={() => setShowDetailsModal(false)}
          isDownloaded={isQuestDownloaded}
          estimatedStorageBytes={verificationState.estimatedStorageBytes}
          onOffloadClick={handleOffloadClick}
        />
      )}
      {showReportModal && (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={currentQuestId}
          recordTable="quest"
          hasAlreadyReported={hasReported}
          creatorId={selectedQuest?.creator_id ?? undefined}
          onReportSubmitted={() => refetchReport()}
        />
      )}

      {/* Offload Verification Drawer */}
      <QuestOffloadVerificationDrawer
        isOpen={showOffloadDrawer}
        onOpenChange={(open) => {
          if (!open && !isOffloading) {
            setShowOffloadDrawer(false);
            verificationState.cancel();
          }
        }}
        onContinue={handleOffloadConfirm}
        verificationState={verificationState}
        isOffloading={isOffloading}
      />

      {/* Private Access Gate Modal for Membership Requests */}
      {isPrivateProject && (
        <PrivateAccessGate
          projectId={currentProjectId || ''}
          projectName={projectName as string}
          isPrivate={isPrivateProject as boolean}
          action="contribute"
          modal={true}
          isVisible={showPrivateAccessModal}
          onClose={() => setShowPrivateAccessModal(false)}
        />
      )}
    </View>
  );
}
