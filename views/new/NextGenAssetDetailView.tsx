/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AssetSettingsModal } from '@/components/AssetSettingsModal';
import { AssetSkeleton } from '@/components/AssetSkeleton';
import ImageCarousel from '@/components/ImageCarousel';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { SourceContent } from '@/components/SourceContent';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { language } from '@/db/drizzleSchema';
import {
  asset as assetCloud,
  asset_content_link as assetContentCloud,
  language as languageTable,
  project as projectCloud
} from '@/db/drizzleSchema';
import {
  asset_content_link_local as assetContentLocal,
  asset_local as assetLocal,
  project_local as projectLocal
} from '@/db/drizzleSchemaLocal';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useHasUserReported } from '@/hooks/useReports';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { Ionicons } from '@expo/vector-icons';
import { toMergeCompilableQuery } from '@/utils/dbUtils';
import { useQuery } from '@tanstack/react-query';
import { eq, inArray } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NextGenNewTranslationModal from './NextGenNewTranslationModal';
import NextGenTranslationsList from './NextGenTranslationsList';
import { useHybridData } from './useHybridData';

type CloudAsset = typeof assetCloud.$inferSelect;
type LocalAsset = typeof assetLocal.$inferSelect;
type DbAsset = CloudAsset | LocalAsset;
type CloudAssetContent = typeof assetContentCloud.$inferSelect;
type LocalAssetContent = typeof assetContentLocal.$inferSelect;
type DbAssetContent = CloudAssetContent | LocalAssetContent;

type AssetWithContent = DbAsset & { content?: DbAssetContent[] };

const ASSET_VIEWER_PROPORTION = 0.35;

type TabType = 'text' | 'image';

function useNextGenOfflineAsset(assetId: string) {
  return useQuery({
    queryKey: ['asset', 'offline', assetId],
    queryFn: async () => {
      // Get asset with content
      // Try local first
      let assetResult = await system.db
        .select()
        .from(assetLocal)
        .where(eq(assetLocal.id, assetId))
        .limit(1);

      if (!assetResult.length) {
        // Fallback to cloud table
        assetResult = await system.db
          .select()
          .from(assetCloud)
          .where(eq(assetCloud.id, assetId))
          .limit(1);
      }

      if (!assetResult.length) return null;

      const assetData = assetResult[0];

      // Get asset content
      // Prefer local content, fallback to cloud
      let contentResult = await system.db
        .select()
        .from(assetContentLocal)
        .where(eq(assetContentLocal.asset_id, assetId));

      if (!contentResult.length) {
        contentResult = await system.db
          .select()
          .from(assetContentCloud)
          .where(eq(assetContentCloud.asset_id, assetId));
      }

      return {
        ...assetData,
        content: contentResult
      } as AssetWithContent;
    },
    enabled: !!assetId
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
  const activeAsset = offlineAsset;
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
      .filter((content) => content.audio_id)
      .map((content) => content.audio_id!)
      .filter(Boolean);

    const imageIds = activeAsset.images ?? [];

    return [...contentAudioIds, ...imageIds];
  }, [activeAsset]);

  const { attachmentStates, isLoading: isLoadingAttachments } =
    useAttachmentStates(allAttachmentIds);

  type Language = typeof language.$inferSelect;

  // Collect content-level language IDs for this asset
  const contentLanguageIds = React.useMemo(() => {
    const ids = new Set<string>();
    activeAsset?.content?.forEach((c) => {
      if (c.source_language_id) ids.add(c.source_language_id);
    });
    return Array.from(ids);
  }, [activeAsset?.content]);

  // Fetch all languages used by content items
  const { data: contentLanguages = [] } = useHybridData<Language>({
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

  // Debug logging
  const debugInfo = React.useMemo(
    () => ({
      assetId: currentAssetId,
      offlineAsset: offlineAsset
        ? {
            id: offlineAsset.id,
            name: offlineAsset.name,
            contentCount: offlineAsset.content?.length ?? 0,
            hasAudio: offlineAsset.content?.some((c) => c.audio_id) ?? false
          }
        : null,
      activeAsset: activeAsset
        ? {
            id: activeAsset.id,
            name: activeAsset.name,
            contentCount: activeAsset.content?.length ?? 0,
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
      offlineAsset,
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
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>{t('noAssetSelected')}</Text>
      </View>
    );
  }

  const screenHeight = Dimensions.get('window').height;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;

  if (isLoading) {
    return <AssetSkeleton />;
  }

  if (!activeAsset) {
    return (
      <View style={sharedStyles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('assetNotAvailableOffline')}</Text>
          <Text style={styles.errorHint}>{t('assetMayNotBeSynchronized')}</Text>
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View
        style={[
          styles.headerBar
          // !allowSettings && sharedStyles.disabled
        ]}
      >
        <View style={styles.titleContainer}>
          <Text style={styles.assetName}>{activeAsset.name}</Text>
          {projectData?.private && (
            <View style={styles.projectIndicators}>
              <Ionicons
                name="lock-closed"
                size={16}
                color={colors.textSecondary}
              />
              {translateMembership === 'owner' && (
                <Ionicons name="ribbon" size={16} color={colors.primary} />
              )}
              {translateMembership === 'member' && (
                <Ionicons name="person" size={16} color={colors.primary} />
              )}
            </View>
          )}
        </View>
        {SHOW_DEV_ELEMENTS && offlineAsset && (
          <Text style={[{ color: colors.text }]}>
            V: {offlineAsset.visible ? '🟢' : '🔴'} A:{' '}
            {offlineAsset.active ? '🟢' : '🔴'}
          </Text>
        )}

        {allowSettings &&
          (translateMembership === 'owner' ? (
            <TouchableOpacity
              onPress={() => setShowAssetSettingsModal(true)}
              style={styles.statsButton}
            >
              <Ionicons name="settings" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            !hasReported &&
            !isReportLoading && (
              <TouchableOpacity
                onPress={() => setShowReportModal(true)}
                style={styles.statsButton}
              >
                <Ionicons name="flag" size={20} color={colors.text} />
              </TouchableOpacity>
            )
          ))}
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'text' && styles.activeTab,
            (!activeAsset.content || activeAsset.content.length === 0) &&
              styles.disabledTab
          ]}
          onPress={() => setActiveTab('text')}
          disabled={!activeAsset.content || activeAsset.content.length === 0}
        >
          <Ionicons
            name="text"
            size={24}
            color={
              activeAsset.content && activeAsset.content.length > 0
                ? colors.text
                : colors.textSecondary
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'image' && styles.activeTab,
            (!activeAsset.images || activeAsset.images.length === 0) &&
              styles.disabledTab
          ]}
          onPress={() => setActiveTab('image')}
          disabled={!activeAsset.images || activeAsset.images.length === 0}
        >
          <Ionicons
            name="image"
            size={24}
            color={
              activeAsset.images && activeAsset.images.length > 0
                ? colors.text
                : colors.textSecondary
            }
          />
        </TouchableOpacity>
      </View>

      {/* Asset Content Viewer */}
      <View
        style={[
          styles.assetViewer,
          !allowEditing && sharedStyles.disabled,
          invisible && sharedStyles.invisible,
          { height: assetViewerHeight }
        ]}
      >
        <ScrollView
          style={[styles.contentScrollView]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentScrollViewContent}
        >
          {/* Text Content Tab */}
          {activeTab === 'text' && (
            <>
              {activeAsset.content && activeAsset.content.length > 0 ? (
                activeAsset.content.map((content, index) => (
                  <View key={index} style={styles.contentItem}>
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
                    {}
                    {SHOW_DEV_ELEMENTS && content.audio_id && (
                      <View style={styles.audioStatusContainer}>
                        <Ionicons
                          name={
                            attachmentStates.get(content.audio_id)?.local_uri
                              ? 'volume-high'
                              : 'volume-mute'
                          }
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.audioStatusText}>
                          {attachmentStates.get(content.audio_id)?.local_uri
                            ? t('audioReady')
                            : t('audioNotAvailable')}
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noContentText}>
                  {t('noContentAvailable')}
                </Text>
              )}
            </>
          )}

          {/* Image Content Tab */}
          {activeTab === 'image' && (
            <>
              {activeAsset.images && activeAsset.images.length > 0 ? (
                <View style={styles.imageCarouselWrapper}>
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
                <Text style={[styles.noContentText]}>
                  {t('noContentAvailable')}
                </Text>
              )}
            </>
          )}

          {/* Asset Info - Always visible 
          <View style={styles.assetInfo}>
            <Text style={styles.assetInfoText}>
              {t('language')}:{' '}
              {sourceLanguage?.native_name ??
                sourceLanguage?.english_name ??
                t('unknown')}
            </Text>
            {activeAsset.content?.some((c) => c.audio_id) && (
              <Text style={styles.assetInfoText}>
                🔊{' '}
                {t('audioTracks', {
                  count: activeAsset.content.filter((c) => c.audio_id).length
                })}
              </Text>
            )}
          </View>*/}
        </ScrollView>
      </View>

      {/* Translations List - Pass project data to avoid re-querying */}
      <View style={{ flex: 1 }}>
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
            <TouchableOpacity
              style={styles.newTranslationButton}
              onPress={onPress}
            >
              <Ionicons
                name="lock-closed"
                size={20}
                color={colors.buttonText}
              />
              <Ionicons name="add" size={24} color={colors.buttonText} />
              <Text style={styles.newTranslationButtonText}>
                {t('membersOnly')}
              </Text>
            </TouchableOpacity>
          )}
          onAccessGranted={() => setShowNewTranslationModal(true)}
        />
      ) : (
        <TouchableOpacity
          style={[
            styles.newTranslationButton,
            !allowEditing && sharedStyles.disabled
          ]}
          onPress={() => (allowEditing ? handleNewTranslationPress() : null)}
        >
          <Ionicons name="add" size={24} color={colors.buttonText} />
          <Text style={styles.newTranslationButtonText}>
            {t('newTranslation')}
          </Text>
        </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    marginRight: spacing.medium
  },
  assetName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    flex: 1
  },
  projectIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.small
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary
  },
  disabledTab: {
    opacity: 0.5
  },
  assetViewer: {
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  contentScrollView: {
    flex: 1
  },
  contentScrollViewContent: {
    padding: spacing.medium
  },
  contentItem: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.medium,
    marginBottom: spacing.small
  },
  noContentText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: spacing.large
  },
  assetInfo: {
    marginTop: spacing.medium,
    gap: spacing.xsmall
  },
  assetInfoText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  errorContainer: {
    padding: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.large
  },
  errorText: {
    color: colors.error,
    fontSize: fontSizes.medium,
    textAlign: 'center',
    marginTop: spacing.medium
  },
  errorHint: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    textAlign: 'center',
    marginTop: spacing.small,
    fontStyle: 'italic'
  },
  newTranslationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    gap: spacing.small
  },
  newTranslationButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  audioStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    marginTop: spacing.small
  },
  audioStatusText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  imageCarouselWrapper: {
    height: 200, // Fixed height for the carousel
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    overflow: 'hidden'
  },
  statsButton: {
    marginLeft: spacing.medium
  }
});
