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
import { Textarea } from '@/components/ui/textarea';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import {
  renameAsset,
  updateAssetContentText
} from '@/database_services/assetService';
import type { LayerStatus } from '@/database_services/types';
import {
  asset,
  language as languageTable,
  project as projectCloud
} from '@/db/drizzleSchema';
import { project_local as projectLocal } from '@/db/drizzleSchemaLocal';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useHasUserReported } from '@/hooks/useReports';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toMergeCompilableQuery } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { cn } from '@/utils/styleUtils';
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
  SparklesIcon,
  UserIcon,
  Volume2Icon,
  VolumeXIcon
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import NextGenNewTranslationModal from './NextGenNewTranslationModal';
import NextGenTranslationsList from './NextGenTranslationsList';
import { RenameAssetModal } from './recording/components/RenameAssetModal';
import { useHybridData } from './useHybridData';

type TabType = 'text' | 'image';

function useNextGenOfflineAsset(assetId: string) {
  const mergedAssetQuery = toMergeCompilableQuery(
    system.db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        content: true
      }
    })
  );

  return useHybridData({
    dataType: 'asset',
    queryKeyParams: [assetId],
    offlineQuery: mergedAssetQuery,
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
  const [contentTexts, setContentTexts] = useState<Map<string, string>>(
    new Map()
  );
  const [savingContentIds, setSavingContentIds] = useState<Set<string>>(
    new Set()
  );
  const [showRenameModal, setShowRenameModal] = useState(false);

  const {
    data: offlineAsset,
    isLoading: isOfflineLoading,
    refetch: refetchOfflineAsset
  } = useNextGenOfflineAsset(currentAssetId || '');

  // Check if quest is published (determines if we can edit/translate)
  const { isPublished } = useQuestPublishStatus(currentQuestId);

  // Check if asset is local-only (not synced yet)
  const { data: isLocalOnly } = useQuery({
    queryKey: ['asset', 'isLocalOnly', currentAssetId],
    queryFn: async () => {
      if (!currentAssetId) return false;

      // Check if asset exists in synced table
      const syncedAsset = await system.db
        .select()
        .from(asset)
        .where(eq(asset.id, currentAssetId))
        .limit(1);

      // If not in synced table, it's local-only
      return syncedAsset.length === 0;
    },
    enabled: !!currentAssetId
  });

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
        .from(projectLocal)
        .where(eq(projectLocal.id, currentProjectId))
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

  const { allowEditing, allowSettings } = React.useMemo(() => {
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
      .filter((content) => content.audio_id)
      .map((content) => content.audio_id!)
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
    offlineQuery: toMergeCompilableQuery(
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

  // Initialize content texts when asset loads
  useEffect(() => {
    if (activeAsset?.content) {
      const textMap = new Map<string, string>();
      activeAsset.content.forEach((content) => {
        textMap.set(content.id, content.text || '');
      });
      setContentTexts(textMap);
    }
  }, [activeAsset?.content]);

  // Handle saving text content changes for a specific content record
  const handleSaveText = async (contentId: string, newText: string) => {
    if (!currentAssetId || !isLocalOnly) return;

    setSavingContentIds((prev) => new Set(prev).add(contentId));
    try {
      await updateAssetContentText(currentAssetId, newText, contentId);
      void refetchOfflineAsset();
    } catch (err: unknown) {
      console.error('Failed to save asset content text:', err);
    } finally {
      setSavingContentIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(contentId);
        return newSet;
      });
    }
  };

  // Update content text in state
  const updateContentText = (contentId: string, text: string) => {
    setContentTexts((prev) => {
      const newMap = new Map(prev);
      newMap.set(contentId, text);
      return newMap;
    });
  };

  // Handle asset renaming
  const handleSaveRename = async (newName: string) => {
    if (!currentAssetId || !isLocalOnly) return;

    try {
      await renameAsset(currentAssetId, newName);
      void refetchOfflineAsset();
    } catch (err: unknown) {
      console.error('Failed to rename asset:', err);
    }
  };

  // Debug logging
  const debugInfo = React.useMemo(
    () => ({
      assetId: currentAssetId,
      isLocalOnly,
      activeAsset: activeAsset
        ? {
            id: activeAsset.id,
            name: activeAsset.name,
            contentCount: activeAsset.content?.length ?? 0,
            contentDetails:
              activeAsset.content?.map((c) => ({
                id: c.id.slice(0, 8),
                text: c.text?.slice(0, 50) || '(empty)',
                hasAudio: !!c.audio_id
              })) ?? [],
            hasAudio: activeAsset.content?.some((c) => c.audio_id) ?? false
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
    [
      currentAssetId,
      isLocalOnly,
      activeAsset,
      attachmentStates,
      allAttachmentIds
    ]
  );

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="mb-safe flex-1"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        className="flex-1 px-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between gap-1">
          <View className="flex-1 flex-row items-center gap-4">
            <TouchableOpacity
              onPress={() => {
                if (isLocalOnly) {
                  setShowRenameModal(true);
                }
              }}
              disabled={!isLocalOnly}
              activeOpacity={0.7}
              className="flex-1"
            >
              <Text
                className={`flex-1 text-xl font-bold text-foreground ${isLocalOnly ? 'underline' : ''}`}
              >
                {activeAsset.name}
              </Text>
            </TouchableOpacity>
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
              {isLocalOnly && ' 📱'}
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

        {/* Asset Content Section with Tabs */}
        <View className="gap-3">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabType)}
          >
            <TabsList className="w-full flex-row">
              <TabsTrigger
                value="text"
                className="flex-1 items-center py-2"
                disabled={
                  !activeAsset.content || activeAsset.content.length === 0
                }
              >
                <Icon as={FileTextIcon} size={24} />
              </TabsTrigger>
              <TabsTrigger
                value="image"
                className="flex-1 items-center py-2"
                disabled={
                  !activeAsset.images || activeAsset.images.length === 0
                }
              >
                <Icon as={ImageIcon} size={24} />
              </TabsTrigger>
            </TabsList>

            {/* Asset Content Viewer */}
            <View className={cn(!allowEditing && 'opacity-50')}>
              <TabsContent value="text">
                {activeAsset.content && activeAsset.content.length > 0 ? (
                  activeAsset.content.map((content, index) => (
                    <View
                      key={index}
                      style={{
                        marginBottom:
                          index < activeAsset.content.length - 1 ? 8 : 0
                      }}
                    >
                      <SourceContent
                        content={content}
                        sourceLanguage={
                          content.source_language_id
                            ? (languageById.get(content.source_language_id) ??
                              null)
                            : null
                        }
                        audioUri={
                          content.audio_id
                            ? (() => {
                                const attachment = attachmentStates.get(
                                  content.audio_id
                                );
                                const localUri = attachment?.local_uri;

                                if (!localUri) {
                                  console.log(
                                    `[AUDIO] No local URI for audio ${content.audio_id}, state:`,
                                    attachment?.state
                                  );
                                  return null;
                                }

                                const fullUri =
                                  system.permAttachmentQueue?.getLocalUri(
                                    localUri
                                  );
                                console.log(
                                  `[AUDIO] Audio ${content.audio_id} -> ${fullUri}`
                                );
                                return fullUri;
                              })()
                            : null
                        }
                        isLoading={isLoadingAttachments}
                      />

                      {/* Audio status indicator */}
                      {SHOW_DEV_ELEMENTS && content.audio_id && (
                        <View
                          className="flex-row items-center gap-1"
                          style={{ marginTop: 8 }}
                        >
                          <Icon
                            as={
                              attachmentStates.get(content.audio_id)?.local_uri
                                ? Volume2Icon
                                : VolumeXIcon
                            }
                            size={16}
                            className="text-muted-foreground"
                          />
                          <Text className="text-sm text-muted-foreground">
                            {attachmentStates.get(content.audio_id)?.local_uri
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

          {/* Local-only text editing section - only show for unpublished quests */}
          {isLocalOnly &&
            !isPublished &&
            activeAsset.content &&
            activeAsset.content.length > 0 && (
              <View className="gap-4 border-t border-border pt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-foreground">
                    {t('contentText') || 'Content Text'}
                    {activeAsset.content.length > 1 && (
                      <Text className="text-sm text-muted-foreground">
                        {' '}
                        ({activeAsset.content.length} segments)
                      </Text>
                    )}
                  </Text>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled
                    className="opacity-50"
                  >
                    <Icon
                      as={SparklesIcon}
                      size={20}
                      className="text-muted-foreground"
                    />
                  </Button>
                </View>

                {activeAsset.content.map((content, index) => {
                  const isSaving = savingContentIds.has(content.id);
                  const currentText = contentTexts.get(content.id) || '';

                  return (
                    <View key={content.id} className="gap-2">
                      {activeAsset.content.length > 1 && (
                        <Text className="text-sm font-medium text-muted-foreground">
                          Segment {index + 1}
                          {content.audio_id && ' 🎵'}
                        </Text>
                      )}

                      <Textarea
                        value={currentText}
                        onChangeText={(text) =>
                          updateContentText(content.id, text)
                        }
                        onBlur={() => {
                          if (currentText !== content.text) {
                            void handleSaveText(content.id, currentText);
                          }
                        }}
                        placeholder={
                          t('enterContentText') || 'Enter content text...'
                        }
                        className="min-h-[100px]"
                        editable={!isSaving && allowEditing}
                      />

                      {isSaving && (
                        <Text className="text-xs italic text-muted-foreground">
                          {t('saving') || 'Saving...'}
                        </Text>
                      )}
                    </View>
                  );
                })}

                <Text className="text-xs text-muted-foreground">
                  {t('localAssetEditHint') ||
                    'This asset is local only. Text can be edited until published.'}
                </Text>
              </View>
            )}
        </View>

        {/* Translations List - Only for published quests (synced assets) */}
        {!isLocalOnly && isPublished && (
          <View>
            <NextGenTranslationsList
              assetId={currentAssetId}
              assetName={activeAsset.name}
              refreshKey={translationsRefreshKey}
              projectData={projectData}
              canVote={canTranslate}
              membership={translateMembership}
            />
          </View>
        )}

        {/* Spacer to push action buttons to bottom */}
        {!isLocalOnly && isPublished && <View style={{ flex: 1 }} />}

        {/* Action Buttons Section - Only show for published quests */}
        {!isLocalOnly && isPublished && (
          <View className="pt-4">
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
                className="-mx-2 flex-row items-center justify-center gap-2 px-6 py-4"
                disabled={!allowEditing}
                onPress={() => allowEditing && handleNewTranslationPress()}
              >
                <Icon as={PlusIcon} size={24} />
                <Text className="text-base font-bold">
                  {t('newTranslation')}
                </Text>
              </Button>
            )}
          </View>
        )}

        {/* Modals */}
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

        {/* Rename Modal for local assets */}
        {isLocalOnly && (
          <RenameAssetModal
            isVisible={showRenameModal}
            currentName={activeAsset.name}
            onClose={() => setShowRenameModal(false)}
            onSave={handleSaveRename}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
