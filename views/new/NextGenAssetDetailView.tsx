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
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { getLocalAttachmentUri } from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@tanstack/react-query';
import { eq, inArray } from 'drizzle-orm';
import {
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
import { Dimensions, Platform, Text, View } from 'react-native';
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
  const { currentAssetId, currentProjectId, currentQuestId } =
    useAppNavigation();

  const [showNewTranslationModal, setShowNewTranslationModal] = useState(false);
  const [targetLanguageId, setTargetLanguageId] = useState<string>('');
  const [translationsRefreshKey, setTranslationsRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('text');

  const [showAssetSettingsModal, setShowAssetSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const {
    data: offlineAsset,
    isLoading: isOfflineLoading,
    refetch: refetchOfflineAsset
  } = useNextGenOfflineAsset(currentAssetId || '');

  // Load asset attachments when asset ID changes
  useEffect(() => {
    if (!currentAssetId) return;

    // Load attachments for audio support
    void system.tempAttachmentQueue?.loadAssetAttachments(currentAssetId);
  }, [currentAssetId]);

  // Get project info for target language and privacy
  const { data: projectData } = useQuery({
    queryKey: ['project', 'offline', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      // Try local first then cloud
      let result = await system.db
        .select()
        .from(project)
        .where(eq(project.id, currentProjectId))
        .limit(1);
      if (!result[0]) {
        result = await system.db
          .select()
          .from(projectCloud)
          .where(eq(projectCloud.id, currentProjectId))
          .limit(1);
      }
      return result[0] || null;
    },
    enabled: !!currentProjectId
  });

  // Check permissions for contributing (translating/voting)
  const { hasAccess: canTranslate, membership: translateMembership } =
    useUserPermissions(
      currentProjectId || '',
      'translate',
      projectData?.private
    );

  useEffect(() => {
    if (projectData?.target_language_id) {
      setTargetLanguageId(projectData.target_language_id);
    }
  }, [projectData]);

  // Determine which asset to display
  const activeAsset = offlineAsset?.[0];

  const isLoading = isOfflineLoading;

  const currentStatus = useStatusContext();

  const { allowEditing, allowSettings, invisible } = React.useMemo(() => {
    if (!activeAsset) {
      return { allowEditing: false, allowSettings: false, invisible: false };
    }
    return currentStatus.getStatusParams(
      LayerType.ASSET,
      activeAsset.id || '',
      activeAsset as LayerStatus,
      currentQuestId
    );
  }, [activeAsset, currentQuestId, currentStatus]);

  // Collect attachment IDs for audio support
  const allAttachmentIds = React.useMemo(() => {
    if (!activeAsset?.content) return [];

    const contentAudioIds = activeAsset.content
      .filter((content) => content.audio)
      .flatMap((content) => content.audio!)
      .filter(Boolean);

    const imageIds = activeAsset.images ?? [];

    return [...contentAudioIds, ...imageIds];
  }, [activeAsset]);

  const { attachmentStates, isLoading: isLoadingAttachments } =
    useAttachmentStates(allAttachmentIds);

  // Collect content-level language IDs for this asset
  const contentLanguageIds = React.useMemo(() => {
    const ids = new Set<string>();
    activeAsset?.content?.forEach((c) => {
      if (c.source_language_id) ids.add(c.source_language_id);
    });
    return Array.from(ids);
  }, [activeAsset?.content]);

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

  const languageById = React.useMemo(() => {
    return new Map(contentLanguages.map((l) => [l.id, l] as const));
  }, [contentLanguages]);

  // Set the first available tab when asset data changes
  useEffect(() => {
    if (!activeAsset) return;

    const hasTextContent =
      activeAsset.content && activeAsset.content.length > 0;
    const hasImages = activeAsset.images && activeAsset.images.length > 0;

    if (hasTextContent) {
      setActiveTab('text');
    } else if (hasImages) {
      setActiveTab('image');
    }
  }, [activeAsset]);

  // Debug logging
  const debugInfo = React.useMemo(
    () => ({
      assetId: currentAssetId,
      activeAsset: activeAsset
        ? {
            id: activeAsset.id,
            name: activeAsset.name,
            contentCount: activeAsset.content?.length ?? 0,
            hasAudio: activeAsset.content?.some((c) => c.audio) ?? false
          }
        : null,
      attachmentStatesCount: attachmentStates.size,
      audioAttachments: Array.from(attachmentStates.entries())
        .filter(([id]) => allAttachmentIds.includes(id))
        .map(([id, state]) => ({
          id,
          state: state.state,
          hasLocalUri: !!state.local_uri
        }))
    }),
    [currentAssetId, activeAsset, attachmentStates, allAttachmentIds]
  );

  const { data: audioSegments, isLoading: isLoadingAudioSegments } = useQuery({
    queryKey: ['audioSegments', currentAssetId],
    queryFn: async () => {
      return await Promise.all(
        activeAsset!.content
          .flatMap((content) => content.audio)
          .filter(Boolean)
          .map(getLocalAttachmentUri)
      );
    },
    enabled: !!activeAsset && !!system.permAttachmentQueue
  });

  useEffect(() => {
    if (!audioSegments) return;

    return () => {
      if (Platform.OS === 'web') {
        audioSegments?.forEach((segment) => {
          console.log('[AUDIO SEGMENT] Revoking object URL', segment);
          URL.revokeObjectURL(segment);
        });
      }
    };
  }, [audioSegments]);

  React.useEffect(() => {
    console.log('[NEXT GEN ASSET DETAIL]', debugInfo);
  }, [debugInfo]);

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

  if (isLoading || isOfflineLoading) {
    return <AssetSkeleton />;
  }

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
    if (canTranslate) {
      setShowNewTranslationModal(true);
    }
    // If no access, PrivateAccessGate will handle showing the modal
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
        {SHOW_DEV_ELEMENTS && offlineAsset && (
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
          className={cn(!allowEditing && 'opacity-50')}
          style={{ height: assetViewerHeight }}
        >
          <TabsContent value="text">
            {activeAsset.content && activeAsset.content.length > 0 ? (
              activeAsset.content.map((content, index) => (
                <View
                  key={index}
                  style={{
                    marginBottom: index < activeAsset.content.length - 1 ? 8 : 0
                  }}
                >
                  <SourceContent
                    content={content}
                    sourceLanguage={
                      content.source_language_id
                        ? (languageById.get(content.source_language_id) ?? null)
                        : null
                    }
                    audioSegments={audioSegments}
                    isLoading={isLoadingAttachments || isLoadingAudioSegments}
                  />

                  {/* Audio status indicator */}
                  {SHOW_DEV_ELEMENTS && content.audio && (
                    <View
                      className="flex-row items-center gap-1"
                      style={{ marginTop: 8 }}
                    >
                      <Icon
                        as={
                          attachmentStates.get(content.audio[0]!)?.local_uri
                            ? Volume2Icon
                            : VolumeXIcon
                        }
                        size={16}
                        className="text-muted-foreground"
                      />
                      <Text className="text-sm text-muted-foreground">
                        {attachmentStates.get(content.audio[0]!)?.local_uri
                          ? t('audioReady')
                          : t('audioNotAvailable')}
                      </Text>
                    </View>
                  )}
                </View>
              ))
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

                      if (!localUri) {
                        console.log(
                          `[IMAGE] No local URI for image ${imageId}, state:`,
                          attachment?.state
                        );
                        return null;
                      }

                      const fullUri =
                        system.permAttachmentQueue?.getLocalUri(localUri);
                      console.log(`[IMAGE] Image ${imageId} -> ${fullUri}`);
                      return fullUri;
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
          disabled={!allowEditing}
          onPress={() => allowEditing && handleNewTranslationPress()}
        >
          <Icon as={PlusIcon} size={24} />
          <Text className="text-base font-bold">{t('newTranslation')}</Text>
        </Button>
      )}

      {/* New Translation Modal */}
      {canTranslate && allowEditing && (
        <NextGenNewTranslationModal
          visible={showNewTranslationModal}
          onClose={() => setShowNewTranslationModal(false)}
          onSuccess={handleTranslationSuccess}
          assetId={currentAssetId}
          assetName={activeAsset.name}
          assetContent={activeAsset.content}
          sourceLanguage={null}
          targetLanguageId={targetLanguageId}
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
        recordTable="assets"
        hasAlreadyReported={hasReported}
        onReportSubmitted={() => refetchOfflineAsset()}
      />
    </View>
  );
}
