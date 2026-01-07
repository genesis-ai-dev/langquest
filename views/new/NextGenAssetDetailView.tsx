/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AssetSettingsModal } from '@/components/AssetSettingsModal';
import { AssetSkeleton } from '@/components/AssetSkeleton';
import ImageCarousel from '@/components/ImageCarousel';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { SourceContent } from '@/components/SourceContent';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { asset_content_link } from '@/db/drizzleSchema';
import {
  asset,
  languoid as languoidTable,
  project,
  project_language_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { AppConfig } from '@/db/supabase/AppConfig';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useHasUserReported } from '@/hooks/useReports';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { getLocalAttachmentUriWithOPFS, getLocalUri } from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray } from 'drizzle-orm';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CrownIcon,
  FileTextIcon,
  FlagIcon,
  ImageIcon,
  LockIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
  Volume2Icon,
  VolumeXIcon
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { scheduleOnRN } from 'react-native-worklets';
import NextGenNewTranslationModal from './NextGenNewTranslationModal';
import NextGenTranslationsList from './NextGenTranslationsList';
import { useHybridData } from './useHybridData';

const ASSET_VIEWER_PROPORTION = 0.35;

type TabType = 'text' | 'image';

function useNextGenOfflineAsset(assetId: string) {
  const { isAuthenticated } = useAuth();

  // Only create offline query if PowerSync is initialized and user is authenticated
  // This prevents PowerSync access warnings for anonymous users
  // Use a factory function that only creates the query when needed
  const getOfflineQuery = React.useCallback(() => {
    // For anonymous users, return a placeholder SQL string that won't access system.db
    if (!isAuthenticated) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
      return 'SELECT * FROM asset WHERE 1=0' as any;
    }

    // Only create CompilableQuery when user is authenticated
    // Check PowerSync status at query creation time
    try {
      if (!system.isPowerSyncInitialized()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
        return 'SELECT * FROM asset WHERE 1=0' as any;
      }
      return toCompilableQuery(
        system.db.query.asset.findFirst({
          where: eq(asset.id, assetId),
          with: {
            content: true
          }
        })
      );
    } catch (error) {
      // If query creation fails, return placeholder
      console.warn('Failed to create offline query, using placeholder:', error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
      return 'SELECT * FROM asset WHERE 1=0' as any;
    }
  }, [assetId, isAuthenticated]);

  // Create query lazily - only when needed
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const offlineQuery = React.useMemo(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => getOfflineQuery(),
    [getOfflineQuery]
  );

  return useHybridData({
    dataType: 'asset',
    queryKeyParams: [assetId],
    offlineQuery,
    cloudQueryFn: async () => {
      if (!assetId) return [];

      // Fetch asset with content relationships
      const { data, error } = await system.supabaseConnector.client
        .from('asset')
        .select(
          `
          *,
          content:asset_content_link (
            *
          )
        `
        )
        .eq('id', assetId)
        .limit(1)
        .overrideTypes<
          (Omit<typeof asset.$inferSelect, 'images'> & {
            images: string;
            content?: (typeof asset_content_link.$inferSelect)[];
          })[]
        >();

      if (error) throw error;

      // Parse images JSON and map to asset format
      return data.map((item) => {
        const parsedImages = item.images
          ? (JSON.parse(item.images) as string[])
          : [];

        return {
          ...item,
          images: parsedImages,
          content: item.content || []
        };
      });
    },
    enableCloudQuery: !!assetId,
    enableOfflineQuery: !!assetId
  });
}

export default function NextGenAssetDetailView() {
  const { t } = useLocalization();
  const { isAuthenticated } = useAuth();
  const setAuthView = useLocalStore((state) => state.setAuthView);
  const {
    currentAssetId,
    currentProjectId,
    currentQuestId,
    currentProjectData,
    goBack
  } = useAppNavigation();

  // Debug logging moved to useEffect to prevent render loop
  useEffect(() => {
    if (__DEV__) {
      console.log('[ASSET DETAIL VIEW] Navigation context:', {
        currentAssetId,
        currentProjectId,
        currentQuestId
      });
    }
  }, [currentAssetId, currentProjectId, currentQuestId]);

  const [showNewTranslationModal, setShowNewTranslationModal] = useState(false);
  const [translationsRefreshKey, setTranslationsRefreshKey] = useState(0);
  const [showAssetSettingsModal, setShowAssetSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentContentIndex, setCurrentContentIndex] = useState(0);

  // Use state for activeTab since user can change it
  const [activeTab, setActiveTab] = useState<TabType>('text');

  const {
    data: queriedAsset,
    isLoading: isAssetLoading,
    refetch: refetchOfflineAsset
  } = useNextGenOfflineAsset(currentAssetId || '');

  const offlineAsset = queriedAsset;

  // Load asset attachments when asset ID changes
  // useEffect(() => {
  //   if (!currentAssetId) return;

  //   // Load attachments for audio support
  //   // void system.tempAttachmentQueue?.loadAssetAttachments(currentAssetId);
  // }, [currentAssetId]);

  // Use passed project data if available (instant!), otherwise query using hybrid data
  // This supports both authenticated (offline) and anonymous (cloud-only) users
  // Use a factory function that only creates the query when needed
  const getProjectOfflineQuery = React.useCallback(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
      return 'SELECT * FROM project WHERE 1=0' as any;
    }
    try {
      if (!system.isPowerSyncInitialized()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
        return 'SELECT * FROM project WHERE 1=0' as any;
      }
      return toCompilableQuery(
        system.db.query.project.findFirst({
          where: currentProjectId ? eq(project.id, currentProjectId) : undefined
        })
      );
    } catch (error) {
      console.warn(
        'Failed to create project offline query, using placeholder:',
        error
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
      return 'SELECT * FROM project WHERE 1=0' as any;
    }
  }, [currentProjectId, isAuthenticated]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const projectOfflineQuery = React.useMemo(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => getProjectOfflineQuery(),
    [getProjectOfflineQuery]
  );

  const { data: queriedProjectDataArray } = useHybridData<
    typeof project.$inferSelect
  >({
    dataType: 'project-detail',
    queryKeyParams: [currentProjectId || ''],
    offlineQuery: projectOfflineQuery,
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', currentProjectId)
        .limit(1)
        .overrideTypes<(typeof project.$inferSelect)[]>();
      if (error) throw error;
      return data || [];
    },
    enableCloudQuery: !!currentProjectId && !currentProjectData,
    enableOfflineQuery: !!currentProjectId && !currentProjectData
  });

  // Prefer passed data for instant rendering!
  const queriedProjectData = queriedProjectDataArray?.[0];
  const projectData = currentProjectData || queriedProjectData;

  // Get target languoid_id from project_language_link
  const { data: targetLanguoidLink = [] } = useHybridData<{
    languoid_id: string | null;
  }>({
    dataType: 'project-target-languoid-id',
    queryKeyParams: [currentProjectId || ''],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ languoid_id: project_language_link.languoid_id })
        .from(project_language_link)
        .where(
          and(
            eq(project_language_link.project_id, currentProjectId!),
            eq(project_language_link.language_type, 'target')
          )
        )
        .limit(1)
    ),
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid_id')
        .eq('project_id', currentProjectId)
        .eq('language_type', 'target')
        .not('languoid_id', 'is', null)
        .limit(1)
        .overrideTypes<{ languoid_id: string | null }[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!currentProjectId,
    enableOfflineQuery: !!currentProjectId
  });

  const translationLanguageId = targetLanguoidLink[0]?.languoid_id || '';

  const { hasAccess: canTranslate, membership: translateMembership } =
    useUserPermissions(
      currentProjectId || '',
      'translate',
      Boolean(projectData?.private)
    );

  // Determine which asset to display
  const activeAsset = offlineAsset?.[0] as
    | (typeof asset.$inferSelect & {
        content?: (typeof asset_content_link.$inferSelect)[];
        images?: string[];
      })
    | undefined;

  // Track previous asset ID to detect when asset changes
  const prevAssetIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!activeAsset) return;

    if (prevAssetIdRef.current !== activeAsset.id) {
      prevAssetIdRef.current = activeAsset.id;

      const hasTextContent =
        activeAsset.content && activeAsset.content.length > 0;
      const hasImages = activeAsset.images && activeAsset.images.length > 0;
      const newTab = hasTextContent ? 'text' : hasImages ? 'image' : 'text';

      setActiveTab(newTab);
      setCurrentContentIndex(0);
    }
  }, [activeAsset]);

  // Removed check for target_language_id - now using project_language_link

  const currentStatus = useStatusContext();

  const { allowEditing, allowSettings } = !activeAsset
    ? { allowEditing: false, allowSettings: false }
    : currentStatus.getStatusParams(
        LayerType.ASSET,
        activeAsset.id || '',
        activeAsset as LayerStatus,
        currentQuestId
      );

  const allAttachmentIds = React.useMemo(() => {
    if (!activeAsset) return [];
    const audioIds = (activeAsset.content ?? [])
      .flatMap((content) => content.audio ?? [])
      .filter(Boolean);
    return [...audioIds, ...(activeAsset.images ?? [])];
  }, [activeAsset]);

  const { attachmentStates, isLoading: isLoadingAttachments } =
    useAttachmentStates(allAttachmentIds);

  // Collect content-level languoid IDs for this asset
  const contentLanguoidIds = React.useMemo(() => {
    const ids = new Set<string>();
    activeAsset?.content?.forEach((c) => {
      if (c.languoid_id) ids.add(c.languoid_id);
    });
    return Array.from(ids);
  }, [activeAsset?.content]);

  // Fetch all languoids used by content items
  const { data: contentLanguoids = [] } = useHybridData({
    dataType: 'languoids-by-id',
    queryKeyParams: contentLanguoidIds,
    offlineQuery: toCompilableQuery(
      system.db.query.languoid.findMany({
        where: contentLanguoidIds.length
          ? inArray(languoidTable.id, contentLanguoidIds)
          : undefined
      })
    ),
    enableCloudQuery: false
  });

  const languoidById = new Map(contentLanguoids.map((l) => [l.id, l] as const));

  // Active tab is now derived from asset content via useMemo above

  // Reset content index when asset changes
  // Use queueMicrotask to defer state update and avoid cascading renders
  useEffect(() => {
    scheduleOnRN(() => {
      setCurrentContentIndex(0);
    });
  }, [currentAssetId]);
  // Get audio URIs for a specific content item (not all content flattened)
  // Both web and native now use async OPFS resolution
  const [resolvedAudioUris, setResolvedAudioUris] = useState<string[]>([]);

  useEffect(() => {
    const content = activeAsset?.content?.[currentContentIndex];
    if (!content?.audio) {
      // Use queueMicrotask to avoid synchronous setState warning
      scheduleOnRN(() => {
        setResolvedAudioUris([]);
      });
      return;
    }

    // Resolve OPFS URIs asynchronously (works for both web and native)
    const resolveUris = async () => {
      const audioValues = content.audio!.filter(
        (audioValue: unknown): audioValue is string =>
          typeof audioValue === 'string'
      );

      const resolved = await Promise.all(
        audioValues.map(async (audioValue: string): Promise<string | null> => {
          // Handle full file URIs
          if (audioValue.startsWith('file://')) {
            return audioValue;
          }

          // For anonymous users, get cloud URLs from Supabase storage
          const isPowerSyncReady = system.isPowerSyncInitialized();
          if (!isAuthenticated || !isPowerSyncReady) {
            // Get public URL from Supabase storage
            try {
              if (!AppConfig.supabaseBucket) {
                console.warn('Supabase bucket not configured');
                return null;
              }
              const { data } = system.supabaseConnector.client.storage
                .from(AppConfig.supabaseBucket)
                .getPublicUrl(audioValue);
              return data.publicUrl;
            } catch (error) {
              console.error('Failed to get cloud audio URL:', error);
              return null;
            }
          }

          // Handle attachment IDs (look up in attachment queue) for authenticated users
          const attachmentState = attachmentStates.get(audioValue);
          if (attachmentState?.local_uri) {
            return getLocalAttachmentUriWithOPFS(attachmentState.filename);
          }

          // Fallback: try to get cloud URL if local not available
          try {
            if (!AppConfig.supabaseBucket) {
              console.warn('Supabase bucket not configured');
              return null;
            }
            const { data } = system.supabaseConnector.client.storage
              .from(AppConfig.supabaseBucket)
              .getPublicUrl(audioValue);
            return data.publicUrl;
          } catch (error) {
            console.error('Failed to get fallback cloud audio URL:', error);
            return null;
          }
        })
      );

      setResolvedAudioUris(resolved.filter((uri) => uri !== null));
    };

    void resolveUris();
  }, [
    activeAsset?.content,
    currentContentIndex,
    attachmentStates,
    isAuthenticated
  ]);

  console.log('resolvedAudioUris', resolvedAudioUris);

  const { hasReported, isLoading: isReportLoading } = useHasUserReported(
    currentAssetId || '',
    'assets'
  );

  if (!currentAssetId) {
    return (
      <View className="flex-1">
        <View className="flex-1 items-center justify-center">
          <Text className="text-center text-xl font-bold text-foreground">
            {t('noAssetSelected')}
          </Text>
        </View>
      </View>
    );
  }

  const screenHeight = Dimensions.get('window').height;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;

  // Show loading skeleton if we're loading OR if we don't have asset data yet for the current asset
  // This prevents the "not available" flash when navigating between assets
  if (isAssetLoading || (!activeAsset && currentAssetId)) {
    return (
      <View className="flex-1">
        <AssetSkeleton />
      </View>
    );
  }

  // Only show error if loading is complete but we still have no asset
  if (!activeAsset) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-lg text-destructive">
            {t('assetNotAvailableOffline')}
          </Text>
          <View className="h-2" />
          <Text className="text-center text-sm italic text-muted-foreground">
            {t('assetMayNotBeSynchronized')}
          </Text>
        </View>
      </View>
    );
  }

  const handleTranslationSuccess = () => {
    // Refresh the translations list by forcing a re-render
    setShowNewTranslationModal(false);
    setTranslationsRefreshKey((prev) => prev + 1);
  };

  const handleNewTranslationPress = () => {
    if (!canTranslate) {
      // If no access, PrivateAccessGate will handle showing the modal
      return;
    }

    if (!translationLanguageId) {
      console.error(
        '[ASSET DETAIL] Cannot open translation modal: translation language not loaded'
      );
      return;
    }

    setShowNewTranslationModal(true);
  };

  return (
    <View className="mb-safe flex-1 px-4">
      {/* Header */}
      <View className="flex-row items-center justify-between gap-1">
        <View className="flex-1 flex-row items-center gap-4">
          <Text className="flex-1 text-xl font-bold text-foreground">
            {activeAsset.name}
          </Text>
          {Boolean(projectData?.private) && (
            <View className="flex-row items-center gap-1">
              <Icon as={LockIcon} className="text-muted-foreground" />
              {translateMembership === 'owner' && (
                <Icon as={CrownIcon} className="text-primary" />
              )}
              {translateMembership === 'member' && (
                <Icon as={UserIcon} className="text-primary" />
              )}
            </View>
          )}
        </View>
        {__DEV__ && offlineAsset && (
          <Text className="text-sm text-foreground">
            V: {activeAsset.visible ? '🟢' : '🔴'} A:{' '}
            {activeAsset.active ? '🟢' : '🔴'}
          </Text>
        )}

        {allowSettings &&
          isAuthenticated &&
          (translateMembership === 'owner' ? (
            <Button
              onPress={() => setShowAssetSettingsModal(true)}
              variant="ghost"
              size="icon"
              className="p-2"
            >
              <Icon as={SettingsIcon} size={22} className="text-foreground" />
            </Button>
          ) : (
            !hasReported &&
            !isReportLoading && (
              <Button
                onPress={() => setShowReportModal(true)}
                variant="ghost"
                size="icon"
                className="p-2"
              >
                <Icon as={FlagIcon} size={20} className="text-foreground" />
              </Button>
            )
          ))}
      </View>

      {/* Tab Bar */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
      >
        <TabsList className="w-full flex-row">
          <TabsTrigger
            value="text"
            className="flex-1 items-center py-2"
            disabled={!activeAsset.content || activeAsset.content.length === 0}
          >
            <Icon as={FileTextIcon} size={24} />
          </TabsTrigger>
          <TabsTrigger
            value="image"
            className="flex-1 items-center py-2"
            disabled={!activeAsset.images || activeAsset.images.length === 0}
          >
            <Icon as={ImageIcon} size={24} />
          </TabsTrigger>
        </TabsList>

        {/* Asset Content Viewer */}
        <View
          className={cn(!allowEditing && 'opacity-50', 'flex overflow-hidden')}
          style={{ height: assetViewerHeight }}
        >
          <TabsContent value="text" className="flex w-full flex-col px-2 py-4">
            {activeAsset.content && activeAsset.content.length > 0 ? (
              <View>
                {/* Current content item */}
                {activeAsset.content[currentContentIndex] && (
                  <View>
                    <SourceContent
                      content={activeAsset.content[currentContentIndex]}
                      sourceLanguage={(() => {
                        const content =
                          activeAsset.content[currentContentIndex];
                        if (!content) return null;
                        const languoidId = content.languoid_id;
                        const languoid = languoidId
                          ? (languoidById.get(languoidId) ?? null)
                          : null;
                        // TODO: Update SourceContent to accept Languoid type
                        // For now, use type assertion to handle transition
                        return languoid as any;
                      })()}
                      audioSegments={resolvedAudioUris}
                      isLoading={isLoadingAttachments}
                    />
                    <View className="flex w-full flex-row justify-between">
                      {/* Audio status indicator */}
                      {__DEV__ &&
                        activeAsset.content[currentContentIndex]
                          ?.audio?.[0] && (
                          <View className="flex-row items-center gap-1">
                            <Icon
                              as={
                                attachmentStates.get(
                                  activeAsset.content[currentContentIndex]
                                    .audio[0]
                                )?.local_uri
                                  ? Volume2Icon
                                  : VolumeXIcon
                              }
                              size={16}
                              className="text-muted-foreground"
                            />
                            <Text className="text-sm text-muted-foreground">
                              {attachmentStates.get(
                                activeAsset.content[currentContentIndex]
                                  .audio[0]
                              )?.local_uri
                                ? t('audioReady')
                                : t('audioNotAvailable')}
                            </Text>
                          </View>
                        )}

                      {/* Combined navigation controls and audio status */}

                      {activeAsset.content.length > 1 ? (
                        <View
                          className="flex-row items-center justify-between pt-2"
                          style={{ marginTop: 8 }}
                        >
                          {/* Navigation buttons - only show if multiple items */}
                          {activeAsset.content.length > 1 ? (
                            <View className="flex-row items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={currentContentIndex === 0}
                                onPress={() =>
                                  setCurrentContentIndex((prev) =>
                                    Math.max(0, prev - 1)
                                  )
                                }
                              >
                                <Icon
                                  as={ChevronLeftIcon}
                                  size={20}
                                  className={
                                    currentContentIndex === 0
                                      ? 'text-muted-foreground'
                                      : 'text-foreground'
                                  }
                                />
                              </Button>

                              <Text className="text-sm text-muted-foreground">
                                {currentContentIndex + 1} /{' '}
                                {activeAsset.content.length}
                              </Text>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={
                                  currentContentIndex ===
                                  activeAsset.content.length - 1
                                }
                                onPress={() =>
                                  setCurrentContentIndex((prev) =>
                                    Math.min(
                                      (activeAsset.content?.length ?? 1) - 1,
                                      prev + 1
                                    )
                                  )
                                }
                              >
                                <Icon
                                  as={ChevronRightIcon}
                                  size={20}
                                  className={
                                    currentContentIndex ===
                                    activeAsset.content.length - 1
                                      ? 'text-muted-foreground'
                                      : 'text-foreground'
                                  }
                                />
                              </Button>
                            </View>
                          ) : (
                            <View />
                          )}
                        </View>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <Text className="p-8 text-center text-base italic text-muted-foreground">
                {t('noContentAvailable')}
              </Text>
            )}
          </TabsContent>

          <TabsContent value="image">
            {activeAsset.images && activeAsset.images.length > 0 ? (
              <View className="h-48 overflow-hidden rounded-lg">
                <ImageCarousel
                  uris={activeAsset.images
                    .map((imageId) => {
                      const attachment = attachmentStates.get(imageId);
                      const localUri = attachment?.local_uri;
                      return localUri ? getLocalUri(localUri) : null;
                    })
                    .filter((uri): uri is string => uri !== null)}
                />
              </View>
            ) : (
              <Text className="p-8 text-center text-base italic text-muted-foreground">
                {t('noContentAvailable')}
              </Text>
            )}
          </TabsContent>
        </View>
      </Tabs>

      {/* Translations List - Pass project data to avoid re-querying */}
      <View className="flex-1">
        <NextGenTranslationsList
          assetId={currentAssetId}
          assetName={activeAsset.name}
          refreshKey={translationsRefreshKey}
          projectData={
            projectData
              ? {
                  private: Boolean(projectData.private),
                  name: projectData.name as string | undefined,
                  id: projectData.id as string | undefined
                }
              : undefined
          }
          canVote={canTranslate}
          membership={translateMembership}
        />
      </View>

      {/* New Translation Button with PrivateAccessGate */}
      {projectData?.private && !canTranslate ? (
        <PrivateAccessGate
          projectId={currentProjectId || ''}
          projectName={(projectData?.name as string | undefined) ?? ''}
          isPrivate={true}
          action="translate"
          renderTrigger={({ onPress }) => (
            <Button
              className="flex-row items-center justify-center gap-2 px-6 py-4"
              onPress={onPress}
            >
              <Icon
                as={LockIcon}
                size={20}
                className="text-primary-foreground"
              />
              <Icon
                as={PlusIcon}
                size={24}
                className="text-primary-foreground"
              />
              <Text className="text-base font-bold text-primary-foreground">
                {t('membersOnly')}
              </Text>
            </Button>
          )}
          onAccessGranted={() => setShowNewTranslationModal(true)}
        />
      ) : // Show login prompt for anonymous users
      !isAuthenticated ? (
        <Button
          className="-mx-4 flex-row items-center justify-center gap-2 px-6 py-4"
          onPress={() => setAuthView('sign-in')}
        >
          <Icon as={LockIcon} size={24} />
          <Text className="font-bold text-secondary">
            {t('signInToSaveOrContribute')}
          </Text>
        </Button>
      ) : (
        <Button
          className="-mx-4 flex-row items-center justify-center gap-2 px-6 py-4"
          disabled={
            !canTranslate ||
            (activeAsset.source && activeAsset.source === 'local')
          }
          onPress={handleNewTranslationPress}
        >
          <Icon as={PlusIcon} size={24} />
          <Text className="font-bold text-secondary">
            {t('newTranslation')}
          </Text>
        </Button>
      )}

      {/* New Translation Modal */}
      {canTranslate && (
        <NextGenNewTranslationModal
          visible={showNewTranslationModal}
          onClose={() => setShowNewTranslationModal(false)}
          onSuccess={handleTranslationSuccess}
          assetId={currentAssetId}
          assetName={activeAsset.name}
          assetContent={activeAsset.content}
          sourceLanguage={null}
          translationLanguageId={translationLanguageId}
        />
      )}

      <AssetSettingsModal
        isVisible={showAssetSettingsModal}
        onClose={() => setShowAssetSettingsModal(false)}
        assetId={activeAsset.id}
      />
      {isAuthenticated && (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={activeAsset.id}
          creatorId={activeAsset?.creator_id ?? undefined}
          recordTable="asset"
          hasAlreadyReported={hasReported}
          onReportSubmitted={(contentBlocked) => {
            refetchOfflineAsset();
            // Navigate back to assets list if content was blocked
            if (contentBlocked) {
              goBack();
            }
          }}
        />
      )}
    </View>
  );
}
