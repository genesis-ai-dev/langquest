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
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { asset_content_link } from '@/db/drizzleSchema';
import {
  asset,
  language as languageTable,
  project,
  project as projectCloud
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useHasUserReported } from '@/hooks/useReports';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { getLocalAttachmentUriWithOPFS, getLocalUri } from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@tanstack/react-query';
import { eq, inArray } from 'drizzle-orm';
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
import NextGenNewTranslationModal from './NextGenNewTranslationModal';
import NextGenTranslationsList from './NextGenTranslationsList';
import { useHybridData } from './useHybridData';

const ASSET_VIEWER_PROPORTION = 0.35;

type TabType = 'text' | 'image';

function useNextGenOfflineAsset(assetId: string) {
  return useHybridData({
    dataType: 'asset',
    queryKeyParams: [assetId],
    offlineQuery: toCompilableQuery(
      system.db.query.asset.findFirst({
        where: eq(asset.id, assetId),
        with: {
          content: true
        }
      })
    ),
    enableCloudQuery: false,
    enableOfflineQuery: !!assetId
  });
}

export default function NextGenAssetDetailView() {
  const { t } = useLocalization();
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
    isLoading: isOfflineLoading,
    refetch: refetchOfflineAsset
  } = useNextGenOfflineAsset(currentAssetId || '');

  // IMPORTANT: Asset detail needs full data with content/audio relationships
  // Passed asset data from list is just metadata - always use queried data which includes content
  // We could use passed data as placeholder, but it's better to wait for full data
  const offlineAsset = queriedAsset;

  // Load asset attachments when asset ID changes
  // useEffect(() => {
  //   if (!currentAssetId) return;

  //   // Load attachments for audio support
  //   // void system.tempAttachmentQueue?.loadAssetAttachments(currentAssetId);
  // }, [currentAssetId]);

  // Use passed project data if available (instant!), otherwise query
  const { data: rawProjectData } = useQuery({
    queryKey: ['project', 'offline', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      console.log(
        '[ASSET DETAIL] Fetching project data for:',
        currentProjectId
      );
      // Try local first then cloud
      let result = await system.db
        .select()
        .from(project)
        .where(eq(project.id, currentProjectId))
        .limit(1);
      console.log('[ASSET DETAIL] Local project query result:', result[0]);
      if (!result[0]) {
        result = await system.db
          .select()
          .from(projectCloud)
          .where(eq(projectCloud.id, currentProjectId))
          .limit(1);
        console.log('[ASSET DETAIL] Cloud project query result:', result[0]);
      }
      return result[0] || null;
    },
    enabled: !!currentProjectId && !currentProjectData, // Skip query if we have passed data!
    staleTime: 30000 // Cache for 30 seconds
  });

  // Prefer passed data for instant rendering!
  const queriedProjectData = (
    Array.isArray(rawProjectData) ? rawProjectData[0] : rawProjectData
  ) as typeof rawProjectData;
  const projectData =
    (currentProjectData as typeof queriedProjectData) || queriedProjectData;

  // Derive translation language ID from project data instead of storing in state
  const translationLanguageId = React.useMemo(
    () => projectData?.target_language_id || '',
    [projectData?.target_language_id]
  );

  // Check permissions for contributing (translating/voting)
  const { hasAccess: canTranslate, membership: translateMembership } =
    useUserPermissions(
      currentProjectId || '',
      'translate',
      projectData?.private
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

  // Update active tab when asset changes - use queueMicrotask to defer state update
  React.useEffect(() => {
    if (!activeAsset) return;

    // Only update if asset ID actually changed
    if (prevAssetIdRef.current !== activeAsset.id) {
      prevAssetIdRef.current = activeAsset.id;

      const hasTextContent =
        activeAsset.content && activeAsset.content.length > 0;
      const hasImages = activeAsset.images && activeAsset.images.length > 0;
      const newTab = hasTextContent ? 'text' : hasImages ? 'image' : 'text';

      // Defer state update to next microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setActiveTab(newTab);
      });
    }
  }, [activeAsset]);

  useEffect(() => {
    console.log('[ASSET DETAIL] Project data loaded:', {
      hasProjectData: !!projectData,
      target_language_id: projectData?.target_language_id,
      project_id: projectData?.id,
      fullProjectData: projectData // Show the full object
    });

    if (projectData && !projectData.target_language_id) {
      console.warn(
        '[ASSET DETAIL] WARNING: Project data loaded but target_language_id is missing!',
        projectData
      );
    }
  }, [projectData]);

  const currentStatus = useStatusContext();

  const {
    allowEditing,
    allowSettings,
    invisible: _invisible
  } = !activeAsset
    ? { allowEditing: false, allowSettings: false, invisible: false }
    : currentStatus.getStatusParams(
        LayerType.ASSET,
        activeAsset.id || '',
        activeAsset as LayerStatus,
        currentQuestId
      );

  // Collect attachment IDs for audio support
  const allAttachmentIds = !activeAsset?.content
    ? []
    : [
        ...activeAsset.content
          .filter((content) => content.audio)
          .flatMap((content) => content.audio!)
          .filter(Boolean),
        ...(activeAsset.images ?? [])
      ];

  const { attachmentStates, isLoading: isLoadingAttachments } =
    useAttachmentStates(allAttachmentIds);

  // Collect content-level language IDs for this asset
  const contentLanguageIds = (() => {
    const ids = new Set<string>();
    activeAsset?.content?.forEach((c) => {
      if (c.source_language_id) ids.add(c.source_language_id);
    });
    return Array.from(ids);
  })();

  // Fetch all languages used by content items
  const { data: contentLanguages = [] } = useHybridData({
    dataType: 'languages-by-id',
    queryKeyParams: contentLanguageIds,
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: contentLanguageIds.length
          ? inArray(languageTable.id, contentLanguageIds)
          : undefined
      })
    ),
    enableCloudQuery: false
  });

  const languageById = new Map(contentLanguages.map((l) => [l.id, l] as const));

  // Active tab is now derived from asset content via useMemo above

  // Reset content index when asset changes
  useEffect(() => {
    setCurrentContentIndex(0);
  }, [currentAssetId]);

  // Get audio URIs for a specific content item (not all content flattened)
  function getContentAudioUris(
    content: typeof asset_content_link.$inferSelect
  ): string[] {
    if (!content.audio) return [];

    return content.audio
      .filter(
        (audioValue: unknown): audioValue is string =>
          typeof audioValue === 'string'
      )
      .map((audioValue: string) => {
        // Handle direct local URIs (from recording view before publish)
        if (audioValue.startsWith('local/')) {
          return getLocalAttachmentUriWithOPFS(audioValue);
        }

        // Handle full file URIs
        if (audioValue.startsWith('file://')) {
          return audioValue;
        }

        // Handle attachment IDs (look up in attachment queue)
        const attachmentState = attachmentStates.get(audioValue);
        if (attachmentState?.local_uri) {
          return getLocalUri(attachmentState.local_uri);
        }

        return null;
      })
      .filter((uri: string | null): uri is string => uri !== null);
  }

  // Debug logging
  useEffect(() => {
    if (__DEV__) {
      console.log('[NEXT GEN ASSET DETAIL]', {
        assetId: currentAssetId,
        activeAsset: activeAsset
          ? {
              id: activeAsset.id,
              name: activeAsset.name,
              contentCount: activeAsset.content?.length ?? 0,
              hasAudio: activeAsset.content?.some((c) => c.audio) ?? false
            }
          : null,
        attachmentStatesCount: attachmentStates.size
      });
    }
  }, [currentAssetId, activeAsset, attachmentStates]);

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
  if (isOfflineLoading || (!activeAsset && currentAssetId)) {
    return <AssetSkeleton />;
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
          {projectData?.private && (
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
                      content={activeAsset.content[currentContentIndex]!}
                      sourceLanguage={
                        activeAsset.content[currentContentIndex]
                          ?.source_language_id
                          ? (languageById.get(
                              activeAsset.content[currentContentIndex]
                                ?.source_language_id
                            ) ?? null)
                          : null
                      }
                      audioSegments={getContentAudioUris(
                        activeAsset.content[currentContentIndex]!
                      )}
                      isLoading={isLoadingAttachments}
                    />
                    <View className="flex w-full flex-row justify-between">
                      {/* Audio status indicator */}
                      {__DEV__ &&
                      activeAsset.content[currentContentIndex]?.audio ? (
                        <View className="flex-row items-center gap-1">
                          <Icon
                            as={
                              attachmentStates.get(
                                activeAsset.content[currentContentIndex]
                                  ?.audio?.[0]!
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
                                ?.audio?.[0]!
                            )?.local_uri
                              ? t('audioReady')
                              : t('audioNotAvailable')}
                          </Text>
                        </View>
                      ) : (
                        <View />
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
                                      activeAsset.content!.length - 1,
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
          projectData={projectData}
          canVote={canTranslate}
          membership={translateMembership}
        />
      </View>

      {/* New Translation Button with PrivateAccessGate */}
      {projectData?.private && !canTranslate ? (
        <PrivateAccessGate
          projectId={currentProjectId || ''}
          projectName={projectData.name || ''}
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
    </View>
  );
}
