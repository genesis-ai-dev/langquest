/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AssetSettingsModal } from '@/components/AssetSettingsModal';
import { NewHighlightBadge } from '@/components/NewHighlightBadge';
import { AssetSkeleton } from '@/components/AssetSkeleton';
import { Badge } from '@/components/ui/badge';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { SourceContent } from '@/components/SourceContent';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text as RNPText } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { getEffectiveLastRecordingSessionId } from '@/database_services/questService';
import {
  asset,
  asset_content_link,
  languoid as languoidTable,
  project,
  project_language_link,
  quest as questTable
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useOrthographyExamples } from '@/hooks/useOrthographyExamples';
import { useHasUserReported } from '@/hooks/useReports';
import { useTranscription } from '@/hooks/useTranscription';
import { useTranscriptionLocalization } from '@/hooks/useTranscriptionLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { resolvePlayableAudioUri } from '@/utils/resolvePlayableAudio';
import { fileExists } from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { useFocusEffect } from '@react-navigation/native';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { Stack } from 'expo-router';
import {
  CrownIcon,
  FlagIcon,
  LockIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { scheduleOnRN } from 'react-native-worklets';
import NextGenNewTranslationModal from './NextGenNewTranslationModal';
import NextGenTranslationsList from './NextGenTranslationsList';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { defaultGetItemId, mergeLocalFirst } from '@/hooks/hybridQueryUtils';

const SOURCE_TEXT_MAX_PROPORTION = 0.25;

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
    try {
      if (!system.isPowerSyncInitialized()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
        return 'SELECT * FROM asset WHERE 1=0' as any;
      }
      return toCompilableQuery(
        system.db.query.asset.findFirst({
          where: eq(asset.id, assetId),
          with: {
            content: {
              orderBy: [
                asc(asset_content_link.order_index),
                asc(asset_content_link.created_at)
              ]
            }
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

  return useHybridQuery({
    // Not ['asset', id]: useAssetById (breadcrumbs) uses that key without
    // content, and a shared cache entry would drop the content on refetch.
    queryKey: ['asset-with-content', assetId],
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
        .order('order_index', {
          referencedTable: 'asset_content_link',
          ascending: true
        })
        .order('created_at', {
          referencedTable: 'asset_content_link',
          ascending: true
        })
        .limit(1)
        .overrideTypes<
          (typeof asset.$inferSelect & {
            content?: (typeof asset_content_link.$inferSelect)[];
          })[]
        >();

      if (error) throw error;

      return data.map((item) => ({
        ...item,
        content: item.content || []
      }));
    },
    enableCloudQuery: !!assetId,
    enableOfflineQuery: !!assetId,
    merge: (local, remote) => {
      const merged = mergeLocalFirst(local, remote, defaultGetItemId);
      return merged.map((item) => {
        const localContent = (item as { content?: unknown[] }).content;
        if (localContent && localContent.length > 0) return item;
        const fromCloud = remote.find(
          (row) => defaultGetItemId(row) === defaultGetItemId(item)
        ) as { content?: unknown[] } | undefined;
        if (fromCloud?.content && fromCloud.content.length > 0) {
          return { ...item, content: fromCloud.content };
        }
        return item;
      });
    }
  });
}

export default function NextGenAssetDetailView() {
  const { t } = useLocalization();
  const { isAuthenticated } = useAuth();

  const { assetId, projectId, questId, assetNameParam, router } =
    useNavigationHelpers();

  // Debug logging moved to useEffect to prevent render loop
  useEffect(() => {
    if (__DEV__) {
      console.log('[ASSET DETAIL VIEW] Navigation context:', {
        assetId,
        projectId,
        questId
      });
    }
  }, [assetId, projectId, questId]);

  const [showNewTranslationModal, setShowNewTranslationModal] = useState(false);
  const [translationsRefreshKey, setTranslationsRefreshKey] = useState(0);
  const [showAssetSettingsModal, setShowAssetSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentContentIndex, setCurrentContentIndex] = useState(0);

  // Transcription feature
  const enableTranscription = useLocalStore(
    (state) => state.enableTranscription
  );
  const { mutateAsync: transcribeAudio, isPending: isTranscribing } =
    useTranscription();
  const { mutateAsync: localizeTranscription, isPending: isLocalizing } =
    useTranscriptionLocalization();
  const [transcriptionText, setTranscriptionText] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<
    'translation' | 'transcription'
  >('translation');
  const {
    data: queriedAsset,
    isLoading: isAssetLoading,
    refetch: refetchOfflineAsset
  } = useNextGenOfflineAsset(assetId || '');

  const offlineAsset = queriedAsset;

  // Load asset attachments when asset ID changes
  // useEffect(() => {
  //   if (!assetId) return;

  //   // Load attachments for audio support
  //   // void system.tempAttachmentQueue?.loadAssetAttachments(assetId);
  // }, [assetId]);

  // Use passed project data if available (instant!), otherwise query using hybrid data
  // This supports both authenticated (offline) and anonymous (cloud-only) users
  const { data: queriedProjectDataArray } = useHybridQuery<
    typeof project.$inferSelect
  >({
    queryKey: ['project-detail', projectId || ''],

    offlineQuery: toCompilableQuery(
      system.db.query.project.findFirst({
        where: eq(project.id, projectId!)
      })
    ) as any,
    cloudQueryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', projectId)
        .limit(1)
        .overrideTypes<(typeof project.$inferSelect)[]>();
      if (error) throw error;
      return data || [];
    },
    enableCloudQuery: !!projectId,
    enableOfflineQuery:
      !!projectId && isAuthenticated && system.isPowerSyncInitialized()
  });

  // Prefer passed data for instant rendering!
  const queriedProjectData = queriedProjectDataArray?.[0];
  const projectData = queriedProjectData;

  // Fetch quest data for "New" label highlighting (recording session tracking)
  const { data: questDataArray, refetch: refetchQuest } = useHybridQuery<
    typeof questTable.$inferSelect
  >({
    queryKey: ['quest-detail', questId || ''],

    offlineQuery: toCompilableQuery(
      system.db.query.quest.findFirst({
        where: eq(questTable.id, questId!)
      })
    ) as any,
    cloudQueryFn: async () => {
      if (!questId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', questId)
        .limit(1)
        .overrideTypes<(typeof questTable.$inferSelect)[]>();
      if (error) throw error;
      return data || [];
    },
    enableCloudQuery: !!questId,
    enableOfflineQuery: !!questId && isAuthenticated
  });
  const questData = questDataArray?.[0];

  const activeRecordingSessionId = useLocalStore(
    (state) => state.currentRecordingData?.recordingSession
  );

  const lastRecordingSessionId = React.useMemo(
    () =>
      getEffectiveLastRecordingSessionId(
        questData?.metadata,
        activeRecordingSessionId
      ),
    [questData?.metadata, activeRecordingSessionId]
  );

  const markNewChildAssetInDetailView = useLocalStore(
    (state) => state.markNewChildAssetInDetailView
  );
  const clearNewChildAssetsInDetailView = useLocalStore(
    (state) => state.clearNewChildAssetsInDetailView
  );

  // Refetch quest on focus; keep cleanup separate so refetch identity changes
  // don't clear ephemeral NEW badges after creating translations.
  useFocusEffect(
    React.useCallback(() => {
      void refetchQuest();
    }, [refetchQuest])
  );

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        if (assetId) {
          clearNewChildAssetsInDetailView(assetId);
        }
      };
    }, [assetId, clearNewChildAssetsInDetailView])
  );

  // Get target languoid_id from project_language_link
  const { data: targetLanguoidLink = [] } = useHybridQuery<{
    languoid_id: string | null;
  }>({
    queryKey: ['project-target-languoid-id', projectId || ''],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ languoid_id: project_language_link.languoid_id })
        .from(project_language_link)
        .where(
          and(
            eq(project_language_link.project_id, projectId!),
            eq(project_language_link.language_type, 'target')
          )
        )
        .limit(1)
    ),
    cloudQueryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid_id')
        .eq('project_id', projectId)
        .eq('language_type', 'target')
        .not('languoid_id', 'is', null)
        .limit(1)
        .overrideTypes<{ languoid_id: string | null }[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!projectId,
    enableOfflineQuery: !!projectId
  });

  const translationLanguageId = targetLanguoidLink[0]?.languoid_id || '';

  const {
    hasAccess: canTranslateFromPermissions,
    membership: translateMembership
  } = useUserPermissions(
    projectId || '',
    'translate',
    Boolean(projectData?.private)
  );

  // Determine which asset to display
  const activeAsset = offlineAsset?.[0] as
    | (typeof asset.$inferSelect & {
        content?: (typeof asset_content_link.$inferSelect)[];
      })
    | undefined;

  // Prefer route display name (quest_asset_link coalesce from list).
  // If it differs from the canonical asset table name, show both.
  const assetDisplayName = React.useMemo(() => {
    const tableName = activeAsset?.name?.trim() ?? '';
    const routeName = assetNameParam?.trim() ?? '';
    if (!routeName || !tableName || routeName === tableName) {
      return tableName || routeName;
    }
    return `${routeName} [${tableName}]`;
  }, [activeAsset?.name, assetNameParam]);

  // For local (unpublished) content, the current user is always the creator.
  // useUserPermissions may initially return false for private projects because its
  // internal query for creator_id hasn't resolved yet (race condition on first mount).
  const isLocalContent =
    questData?.published_at == null && questData?.source !== 'cloud';
  const canTranslate = canTranslateFromPermissions || isLocalContent;

  // Highlight assets from the last recording session (only for unpublished content)
  const assetMeta = activeAsset?.metadata as {
    recordingSessionId?: string;
  } | null;
  const isHighlighted =
    isLocalContent &&
    !!assetMeta?.recordingSessionId &&
    assetMeta.recordingSessionId === lastRecordingSessionId;

  useEffect(() => {
    if (__DEV__ && projectData && !projectData.target_language_id) {
      console.warn(
        '[ASSET DETAIL] WARNING: Project data loaded but target_language_id is missing!',
        projectData
      );
    }
  }, [projectData]);

  const currentStatus = useStatusContext();

  const { allowEditing, allowSettings } = !activeAsset
    ? { allowEditing: false, allowSettings: false }
    : currentStatus.getStatusParams(
        LayerType.ASSET,
        activeAsset.id || '',
        {
          visible: activeAsset.visible,
          active: activeAsset.active,
          source: isLocalContent ? 'local' : 'synced'
        },
        questId
      );

  // Check if source asset has any audio (needed to determine if transcription is available)
  const sourceHasAudio = React.useMemo(() => {
    return (activeAsset?.content ?? []).some(
      (content) => content.audio && content.audio.length > 0
    );
  }, [activeAsset?.content]);

  // Collect content-level languoid IDs for this asset (prefer languoid_id, fallback to source_language_id)
  const contentLanguoidIds = React.useMemo(() => {
    const ids = new Set<string>();
    activeAsset?.content?.forEach((c) => {
      const languoidId = c.languoid_id || c.source_language_id;
      if (languoidId) ids.add(languoidId);
    });
    return Array.from(ids);
  }, [activeAsset?.content]);

  // Fetch all languoids used by content items
  const { data: contentLanguoids = [] } = useHybridQuery<
    typeof languoidTable.$inferSelect
  >({
    queryKey: ['languoids-by-id', ...contentLanguoidIds],
    enabled: contentLanguoidIds.length > 0,
    offlineQuery: toCompilableQuery(
      system.db.query.languoid.findMany({
        where: inArray(languoidTable.id, contentLanguoidIds)
      })
    ),
    cloudQueryFn: async () => {
      if (contentLanguoidIds.length === 0) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('languoid')
        .select('*')
        .in('id', contentLanguoidIds)
        .overrideTypes<(typeof languoidTable.$inferSelect)[]>();
      if (error) throw error;
      return data ?? [];
    }
  });

  const languoidById = new Map(contentLanguoids.map((l) => [l.id, l] as const));

  // Get the current content's language ID for transcription localization
  const currentContentLanguageId = React.useMemo(() => {
    const content = activeAsset?.content?.[currentContentIndex];
    return content?.languoid_id || content?.source_language_id || '';
  }, [activeAsset?.content, currentContentIndex]);

  // Fetch orthography examples for transcription localization
  const { data: orthographyExamples = [] } = useOrthographyExamples(
    projectId,
    currentContentLanguageId
  );
  // Reset to the first content version when the asset changes
  // Use queueMicrotask to defer state update and avoid cascading renders
  useEffect(() => {
    scheduleOnRN(() => {
      setCurrentContentIndex(0);
    });
  }, [assetId]);

  // Reset to translations tab if source has no audio (transcription requires audio)
  useEffect(() => {
    if (!sourceHasAudio && contentTypeFilter === 'transcription') {
      setContentTypeFilter('translation');
    }
  }, [sourceHasAudio, contentTypeFilter]);

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
        audioValues.map((audioValue: string) =>
          resolvePlayableAudioUri(audioValue)
        )
      );

      setResolvedAudioUris(resolved.filter((uri) => uri !== null));
    };

    void resolveUris();
  }, [activeAsset?.content, currentContentIndex]);

  const { hasReported, isLoading: isReportLoading } = useHasUserReported(
    assetId || '',
    'assets'
  );

  const sourceTextMaxHeight =
    Dimensions.get('window').height * SOURCE_TEXT_MAX_PROPORTION;

  if (!assetId) {
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

  // Show loading skeleton if we're loading OR if we don't have asset data yet for the current asset
  // This prevents the "not available" flash when navigating between assets
  if (isAssetLoading || (!activeAsset && assetId)) {
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

  const handleTranslationSuccess = (newAssetId: string) => {
    if (assetId) {
      markNewChildAssetInDetailView(assetId, newAssetId);
    }
    setShowNewTranslationModal(false);
    setTranslationsRefreshKey((prev) => prev + 1);
  };

  // Transcription handler for source audio
  const handleTranscribe = async (uri: string) => {
    if (!isAuthenticated) {
      RNAlert.alert(t('error'), t('pleaseLogInToTranscribe'));
      return;
    }

    // Validate the audio URI exists
    if (!uri) {
      RNAlert.alert(t('error'), t('audioNotAvailable'));
      return;
    }

    // For local files, check if they exist. Skip check for URLs (fileExists only works for file:// URIs)
    const isLocalFile = uri.startsWith('file://');
    if (isLocalFile) {
      try {
        const exists = await fileExists(uri);
        if (!exists) {
          console.log('[Transcription] Audio file not found at URI:', uri);
          RNAlert.alert(t('error'), t('audioNotAvailable'));
          return;
        }
      } catch (error) {
        console.warn('[Transcription] Error checking file existence:', error);
        // Continue anyway - let the transcription service handle the error
      }
    }

    console.log('[Transcription] Starting transcription for URI:', uri);

    // Pre-compute values outside the try block for React Compiler optimization
    const shouldLocalize =
      orthographyExamples.length > 0 && currentContentLanguageId;
    const languoid = shouldLocalize
      ? languoidById.get(currentContentLanguageId)
      : undefined;
    const languageName = languoid?.name || 'the target language';

    try {
      // Step 1: Get phonetic transcription from ASR
      const result = await transcribeAudio({ uri, mimeType: 'audio/wav' });
      if (!result.text) {
        RNAlert.alert(t('error'), 'Transcription returned no text');
        return;
      }

      console.log('[Transcription] Phonetic result:', result.text);

      // Step 2: Localize the phonetic transcription if we have examples
      let finalText = result.text;

      if (shouldLocalize) {
        console.log(
          '[Transcription] Localizing with',
          orthographyExamples.length,
          'examples for',
          languageName
        );

        try {
          const localizationResult = await localizeTranscription({
            phoneticText: result.text,
            examples: orthographyExamples,
            languageName
          });

          if (localizationResult.localizedText) {
            console.log(
              '[Transcription] Localized result:',
              localizationResult.localizedText
            );
            finalText = localizationResult.localizedText;
          }
        } catch (localizationError) {
          // Log but don't fail - fall back to phonetic transcription
          console.warn(
            '[Transcription] Localization failed, using phonetic result:',
            localizationError
          );
        }
      } else {
        console.log(
          '[Transcription] No orthography examples available, using phonetic result'
        );
      }

      // Open the new translation drawer in transcription mode with the transcribed text
      setTranscriptionText(finalText);
      setContentTypeFilter('transcription');
      setShowNewTranslationModal(true);
    } catch (error) {
      console.error('Transcription error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      RNAlert.alert(
        t('error'),
        `${t('transcriptionFailed')}\n\n${errorMessage}`
      );
    }
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

  const contentItems = activeAsset.content ?? [];
  const currentContent = contentItems[currentContentIndex] ?? contentItems[0];
  // Recordings store the asset name as their text; don't repeat it.
  const hasDistinctText = (content: typeof asset_content_link.$inferSelect) => {
    const text = content.text?.trim() ?? '';
    return (
      text !== '' &&
      text !== activeAsset.name?.trim() &&
      text !== assetNameParam?.trim()
    );
  };
  const showSourceSection = contentItems.some(
    (content) => hasDistinctText(content) || (content.audio?.length ?? 0) > 0
  );
  const showCurrentText = !!currentContent && hasDistinctText(currentContent);
  const showCurrentContent = showCurrentText || resolvedAudioUris.length > 0;

  return (
    <View className="mb-safe flex-1 px-4">
      {assetDisplayName ? (
        <Stack.Screen options={{ title: assetDisplayName }} />
      ) : null}
      {/* Header */}
      <View className="flex-row items-center justify-between gap-1">
        <View className="flex-1 flex-row items-center gap-4">
          <View className="flex-1 flex-row items-center gap-2">
            <Text className="text-xl font-bold text-foreground">
              {assetDisplayName}
            </Text>
            {/* New badge for recently recorded assets */}
            {isHighlighted && <NewHighlightBadge />}
            {!allowEditing && (
              <Badge variant="outline">
                <RNPText variant="small">{t('inactive')}</RNPText>
              </Badge>
            )}
          </View>
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
              testID="asset-settings-open"
              accessibilityLabel="asset-settings-open"
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
                testID="asset-report"
                accessibilityLabel="asset-report"
              >
                <Icon as={FlagIcon} size={20} className="text-foreground" />
              </Button>
            )
          ))}
      </View>

      {/* Source content */}
      {showSourceSection && (
        <View className={cn(!allowEditing && 'opacity-50', 'gap-2 py-2')}>
          {contentItems.length > 1 && (
            <View className="flex-row flex-wrap items-center gap-2">
              {contentItems.map((content, index) => (
                <Button
                  key={content.id}
                  variant={
                    index === currentContentIndex ? 'default' : 'outline'
                  }
                  size="sm"
                  className="h-8 min-w-8 px-3"
                  onPress={() => setCurrentContentIndex(index)}
                  testID={`asset-content-version-${index + 1}`}
                  accessibilityLabel={`asset-content-version-${index + 1}`}
                >
                  <RNPText>{index + 1}</RNPText>
                </Button>
              ))}
            </View>
          )}

          {currentContent && showCurrentContent && (
            <SourceContent
              content={currentContent}
              audioSegments={resolvedAudioUris}
              onTranscribe={
                enableTranscription && isAuthenticated
                  ? handleTranscribe
                  : undefined
              }
              isTranscribing={isTranscribing || isLocalizing}
              showText={showCurrentText}
              maxTextHeight={sourceTextMaxHeight}
            />
          )}
        </View>
      )}

      {/* Translations/Transcriptions List - Pass project data to avoid re-querying */}
      <View className="flex-1">
        {/* Transcriptions need source audio; with only translations there is nothing to toggle */}
        <View className="h-px bg-border" />
        {sourceHasAudio && (
          <View className="pt-2">
            <ToggleGroup
              type="single"
              value={contentTypeFilter}
              onValueChange={(value) => {
                if (value)
                  setContentTypeFilter(value as typeof contentTypeFilter);
              }}
              className="w-full"
            >
              <ToggleGroupItem value="translation" className="flex-1">
                <RNPText>{t('translations')}</RNPText>
              </ToggleGroupItem>
              <ToggleGroupItem value="transcription" className="flex-1">
                <RNPText>{t('transcriptions')}</RNPText>
              </ToggleGroupItem>
            </ToggleGroup>
          </View>
        )}

        <NextGenTranslationsList
          assetId={assetId}
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
          contentTypeFilter={contentTypeFilter}
        />
      </View>

      {/* New Translation Button with PrivateAccessGate */}
      {projectData?.private && !canTranslate ? (
        <PrivateAccessGate
          projectId={projectId || ''}
          projectName={(projectData?.name as string | undefined) ?? ''}
          isPrivate={true}
          action="translate"
          renderTrigger={({ onPress }) => (
            <Button
              className="flex-row items-center justify-center gap-2 px-6 py-4"
              onPress={onPress}
              testID="asset-translate-button"
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
          onPress={() => router.push('/(auth)/sign-in')}
          testID="asset-translate-button"
        >
          <Icon as={LockIcon} size={24} />
          <Text className="font-bold text-secondary">
            {t('signInToSaveOrContribute')}
          </Text>
        </Button>
      ) : (
        <Button
          className="-mx-4 flex-row items-center justify-center gap-2 px-6 py-4"
          disabled={!canTranslate}
          onPress={handleNewTranslationPress}
          testID="asset-translate-button"
        >
          <Icon as={PlusIcon} size={24} />
          <Text className="font-bold text-secondary">
            {contentTypeFilter === 'transcription'
              ? t('newTranscription')
              : t('newTranslation')}
          </Text>
        </Button>
      )}

      {/* New Translation/Transcription Modal */}
      {canTranslate && (
        <NextGenNewTranslationModal
          visible={showNewTranslationModal}
          onClose={() => {
            setShowNewTranslationModal(false);
            setTranscriptionText(''); // Clear transcription text when modal closes
          }}
          onSuccess={handleTranslationSuccess}
          assetId={assetId}
          assetName={activeAsset.name}
          assetContent={activeAsset.content}
          sourceLanguage={null}
          translationLanguageId={translationLanguageId}
          isLocalSource={isLocalContent}
          initialContentType={contentTypeFilter}
          initialText={transcriptionText}
          resolvedAudioUris={resolvedAudioUris}
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
              router.back();
            }
          }}
        />
      )}
    </View>
  );
}
