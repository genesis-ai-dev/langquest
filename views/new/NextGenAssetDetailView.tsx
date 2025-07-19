import { AssetSkeleton } from '@/components/AssetSkeleton';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { SourceContent } from '@/components/SourceContent';
import { asset, asset_content_link, project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { Asset, AssetContent } from '@/hooks/db/useAssets';
import { useLanguageById } from '@/hooks/db/useLanguages';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import NextGenNewTranslationModal from './NextGenNewTranslationModal';
import NextGenTranslationsList from './NextGenTranslationsList';

interface AssetWithContent extends Asset {
  content?: AssetContent[];
  source?: string;
}

const ASSET_VIEWER_PROPORTION = 0.4;

function useNextGenOfflineAsset(assetId: string) {
  return useQuery({
    queryKey: ['asset', 'offline', assetId],
    queryFn: async () => {
      // Get asset with content
      const assetResult = await system.db
        .select()
        .from(asset)
        .where(eq(asset.id, assetId))
        .limit(1);

      if (!assetResult.length) return null;

      const assetData = assetResult[0];

      // Get asset content
      const contentResult = await system.db
        .select()
        .from(asset_content_link)
        .where(eq(asset_content_link.asset_id, assetId));

      return {
        ...assetData,
        content: contentResult,
        source: 'localSqlite'
      } as AssetWithContent;
    },
    enabled: !!assetId
  });
}

async function useNextGenCloudAsset(
  assetId: string
): Promise<AssetWithContent | null> {
  const { data: assetData, error: assetError } =
    await system.supabaseConnector.client
      .from('asset')
      .select('*')
      .eq('id', assetId)
      .limit(1)
      .overrideTypes<Asset[]>();

  if (assetError) throw assetError;
  if (!assetData.length) return null;

  const { data: contentData, error: contentError } =
    await system.supabaseConnector.client
      .from('asset_content_link')
      .select('*')
      .eq('asset_id', assetId)
      .overrideTypes<AssetContent[]>();

  if (contentError) throw contentError;

  return {
    ...assetData[0],
    content: contentData,
    source: 'cloudSupabase'
  } as AssetWithContent;
}

export default function NextGenAssetDetailView() {
  const { currentAssetId, currentProjectId } = useCurrentNavigation();
  const isOnline = useNetworkStatus();

  const [useOfflineData, setUseOfflineData] = useState(false);
  const [cloudAsset, setCloudAsset] = useState<AssetWithContent | null>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState<Error | null>(null);
  const [showNewTranslationModal, setShowNewTranslationModal] = useState(false);
  const [targetLanguageId, setTargetLanguageId] = useState<string>('');
  const [translationsRefreshKey, setTranslationsRefreshKey] = useState(0);

  const { data: offlineAsset, isLoading: isOfflineLoading } =
    useNextGenOfflineAsset(currentAssetId || '');

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
      const result = await system.db
        .select()
        .from(project)
        .where(eq(project.id, currentProjectId))
        .limit(1);
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

  // Fetch cloud asset directly - only when online
  useEffect(() => {
    if (!currentAssetId) return;

    const fetchCloudAsset = async () => {
      try {
        setIsCloudLoading(true);
        setCloudError(null);

        // Check network status before making cloud query
        if (!isOnline) {
          console.log('📱 [ASSET DETAIL] Skipping cloud query - offline');
          setCloudAsset(null);
          setIsCloudLoading(false);
          return;
        }

        console.log('🌐 [ASSET DETAIL] Making cloud query - online');
        const asset = await useNextGenCloudAsset(currentAssetId);
        setCloudAsset(asset);
      } catch (error) {
        console.error('Error fetching cloud asset:', error);
        setCloudError(error as Error);
        setCloudAsset(null);
      } finally {
        setIsCloudLoading(false);
      }
    };

    void fetchCloudAsset();
  }, [currentAssetId, isOnline]);

  // Determine which asset to display
  const activeAsset = useOfflineData ? offlineAsset : cloudAsset;
  const isLoading = useOfflineData ? isOfflineLoading : isCloudLoading;

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

  const {
    language: sourceLanguage,
    isLanguageLoading: isSourceLanguageLoading
  } = useLanguageById(activeAsset?.source_language_id || '');

  // Debug logging
  const debugInfo = React.useMemo(
    () => ({
      assetId: currentAssetId,
      isOnline,
      useOfflineData,
      offlineAsset: offlineAsset
        ? {
            id: offlineAsset.id,
            name: offlineAsset.name,
            source: offlineAsset.source,
            contentCount: offlineAsset.content?.length ?? 0,
            hasAudio: offlineAsset.content?.some((c) => c.audio_id) ?? false
          }
        : null,
      cloudAsset: cloudAsset
        ? {
            id: cloudAsset.id,
            name: cloudAsset.name,
            source: cloudAsset.source,
            contentCount: cloudAsset.content?.length ?? 0,
            hasAudio: cloudAsset.content?.some((c) => c.audio_id) ?? false
          }
        : null,
      activeAsset: activeAsset
        ? {
            id: activeAsset.id,
            name: activeAsset.name,
            source: activeAsset.source,
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
        })),
      cloudError: cloudError?.message ?? null
    }),
    [
      currentAssetId,
      isOnline,
      useOfflineData,
      offlineAsset,
      cloudAsset,
      activeAsset,
      attachmentStates,
      allAttachmentIds,
      cloudError
    ]
  );

  React.useEffect(() => {
    console.log('[NEXT GEN ASSET DETAIL]', debugInfo);
  }, [debugInfo]);

  if (!currentAssetId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>No Asset Selected</Text>
      </View>
    );
  }

  const screenHeight = Dimensions.get('window').height;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;

  if (isLoading || isSourceLanguageLoading) {
    return <AssetSkeleton />;
  }

  if (!activeAsset) {
    return (
      <View style={sharedStyles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {useOfflineData
              ? 'Asset not available offline'
              : cloudError
                ? `Cloud error: ${cloudError.message}`
                : 'Asset not found online'}
          </Text>
          <Text style={styles.errorHint}>
            {useOfflineData && cloudAsset
              ? 'Try switching to Cloud data source above'
              : !useOfflineData && offlineAsset
                ? 'Try switching to Offline data source above'
                : 'This asset may not be synchronized or may not exist'}
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
    <View style={styles.container}>
      {/* Data Source Toggle - Header */}
      <View style={styles.headerBar}>
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
        <View style={styles.headerRight}>
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.toggleText,
                !useOfflineData && styles.inactiveToggleText
              ]}
            >
              💾
            </Text>
            <Switch
              value={!useOfflineData}
              onValueChange={(value) => setUseOfflineData(!value)}
              trackColor={{
                false: colors.inputBackground,
                true: colors.primary
              }}
              thumbColor={colors.buttonText}
              style={styles.switch}
            />
            <Text
              style={[
                styles.toggleText,
                useOfflineData && styles.inactiveToggleText
              ]}
            >
              🌐
            </Text>
          </View>
        </View>
      </View>

      {/* Asset Content Viewer */}
      <View style={[styles.assetViewer, { height: assetViewerHeight }]}>
        <ScrollView
          style={styles.contentScrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentScrollViewContent}
        >
          {activeAsset.content && activeAsset.content.length > 0 ? (
            activeAsset.content.map((content, index) => (
              <View key={index} style={styles.contentItem}>
                <SourceContent
                  content={content}
                  sourceLanguage={sourceLanguage ?? null}
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
                            system.permAttachmentQueue?.getLocalUri(localUri);
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
                {content.audio_id && (
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
                        ? 'Audio ready'
                        : 'Audio not available'}
                    </Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noContentText}>No content available</Text>
          )}

          {/* Images info */}
          {activeAsset.images && activeAsset.images.length > 0 && (
            <View style={styles.imageInfo}>
              <Text style={styles.imageInfoText}>
                📷 {activeAsset.images.length} image(s) available
              </Text>
            </View>
          )}

          {/* Asset Info */}
          <View style={styles.assetInfo}>
            <Text style={styles.assetInfoText}>
              Language:{' '}
              {sourceLanguage?.native_name ??
                sourceLanguage?.english_name ??
                'Unknown'}
            </Text>
            <Text style={styles.assetInfoText}>
              Source:{' '}
              {activeAsset.source === 'cloudSupabase'
                ? '🌐 Cloud'
                : '💾 Offline'}
            </Text>
            {activeAsset.content?.some((c) => c.audio_id) && (
              <Text style={styles.assetInfoText}>
                🔊 Audio: {activeAsset.content.filter((c) => c.audio_id).length}{' '}
                track(s)
              </Text>
            )}
          </View>
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
              <Text style={styles.newTranslationButtonText}>Members Only</Text>
            </TouchableOpacity>
          )}
          onAccessGranted={() => setShowNewTranslationModal(true)}
        />
      ) : (
        <TouchableOpacity
          style={styles.newTranslationButton}
          onPress={handleNewTranslationPress}
        >
          <Ionicons name="add" size={24} color={colors.buttonText} />
          <Text style={styles.newTranslationButtonText}>New Translation</Text>
        </TouchableOpacity>
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
          sourceLanguage={sourceLanguage}
          targetLanguageId={targetLanguageId}
        />
      )}
    </View>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  toggleText: {
    fontSize: fontSizes.medium
  },
  inactiveToggleText: {
    opacity: 0.3
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }]
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
  imageInfo: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    marginTop: spacing.small
  },
  imageInfoText: {
    color: colors.text,
    fontSize: fontSizes.medium
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
  disabledButton: {
    backgroundColor: colors.inputBorder,
    opacity: 0.7
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
  }
});
