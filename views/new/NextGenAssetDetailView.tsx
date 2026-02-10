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
import { Text as RNPText } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { useOrthographyExamples } from '@/hooks/useOrthographyExamples';
import { useHasUserReported } from '@/hooks/useReports';
import { useTranscription } from '@/hooks/useTranscription';
import { useTranscriptionLocalization } from '@/hooks/useTranscriptionLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import {
    fileExists,
    getLocalAttachmentUriWithOPFS,
    getLocalUri
} from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray } from 'drizzle-orm';
import React, { useEffect, useRef, useState } from 'react';
import type { FlatList as FlatListType, ViewToken } from 'react-native';
import { Dimensions, FlatList, Text, View } from 'react-native';
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

  // Check if source asset has any audio (needed to determine if transcription is available)
  const sourceHasAudio = React.useMemo(() => {
    return (activeAsset?.content ?? []).some(
      (content) => content.audio && content.audio.length > 0
    );
  }, [activeAsset?.content]);

  const { attachmentStates, isLoading: isLoadingAttachments } =
    useAttachmentStates(allAttachmentIds);

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

  // Get the current content's language ID for transcription localization
  const currentContentLanguageId = React.useMemo(() => {
    const content = activeAsset?.content?.[currentContentIndex];
    return content?.languoid_id || content?.source_language_id || '';
  }, [activeAsset?.content, currentContentIndex]);

  // Fetch orthography examples for transcription localization
  const { data: orthographyExamples = [] } = useOrthographyExamples(
    currentProjectId,
    currentContentLanguageId
  );

  // Active tab is now derived from asset content via useMemo above

  // Reset content index and scroll position when asset changes
  // Use queueMicrotask to defer state update and avoid cascading renders
  useEffect(() => {
    scheduleOnRN(() => {
      setCurrentContentIndex(0);
      // Also scroll the FlatList to the first item
      contentFlatListRef.current?.scrollToIndex({ index: 0, animated: false });
    });
  }, [currentAssetId]);

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
        audioValues.map(async (audioValue: string): Promise<string | null> => {
          // Handle full file URIs
          if (audioValue.startsWith('file://')) {
            if (await fileExists(audioValue)) {
              return audioValue;
            }
            console.warn(`File URI does not exist: ${audioValue}`);
            return null;
          }

          // Handle local URIs (from saveAudioLocally for unpublished content)
          if (audioValue.startsWith('local/')) {
            const constructedUri =
              await getLocalAttachmentUriWithOPFS(audioValue);
            // Check if file exists at constructed path
            if (await fileExists(constructedUri)) {
              return constructedUri;
            }

            // File doesn't exist at expected path - try to find it in attachment queue
            console.log(
              `⚠️ Local URI ${audioValue} not found at ${constructedUri}, searching attachment queue...`
            );

            if (system.permAttachmentQueue) {
              // Extract filename from local path (e.g., "local/uuid.wav" -> "uuid.wav")
              const filename = audioValue.replace(/^local\//, '');
              // Extract UUID part (without extension) for more flexible matching
              const uuidPart = filename.split('.')[0];

              // Search attachment queue by filename or UUID
              const attachment = await system.powersync.getOptional<{
                id: string;
                filename: string | null;
                local_uri: string | null;
              }>(
                `SELECT * FROM ${system.permAttachmentQueue.table} WHERE filename = ? OR filename LIKE ? OR id = ? OR id LIKE ? LIMIT 1`,
                [filename, `%${uuidPart}%`, filename, `%${uuidPart}%`]
              );

              if (attachment?.local_uri) {
                const foundUri = system.permAttachmentQueue.getLocalUri(
                  attachment.local_uri
                );
                // Verify the found file actually exists
                if (await fileExists(foundUri)) {
                  console.log(
                    `✅ Found attachment in queue for local URI ${audioValue.slice(0, 20)}`
                  );
                  return foundUri;
                }
                console.warn(
                  `⚠️ Attachment found in queue but file doesn't exist: ${foundUri}`
                );
              }
            }

            // Local file not found
            console.warn(`Local audio file not found: ${audioValue}`);
            return null;
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
          if (attachmentState?.local_uri && attachmentState.filename) {
            return await getLocalAttachmentUriWithOPFS(
              attachmentState.filename
            );
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

  const { hasReported, isLoading: isReportLoading } = useHasUserReported(
    currentAssetId || '',
    'assets'
  );

  // FlatList ref for programmatic scrolling - must be before any early returns
  const contentFlatListRef =
    useRef<FlatListType<typeof asset_content_link.$inferSelect>>(null);

  // Viewability config for FlatList - must be before any early returns
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  // Handle viewable items change (when user swipes) - must be before any early returns
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstItem = viewableItems[0];
      if (firstItem?.index != null) {
        setCurrentContentIndex(firstItem.index);
      }
    }
  ).current;

  // Screen dimensions for layout calculations
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;
  // Content width for FlatList paging (full width minus padding)
  const contentWidth = screenWidth - 32; // 16px padding on each side

  // Scroll to a specific content index
  const scrollToContentIndex = (index: number) => {
    if (contentFlatListRef.current && activeAsset?.content) {
      const clampedIndex = Math.max(
        0,
        Math.min(index, activeAsset.content.length - 1)
      );
      contentFlatListRef.current.scrollToIndex({
        index: clampedIndex,
        animated: true
      });
    }
  };

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

  // Transcription handler for source audio
  const handleTranscribe = async (uri: string) => {
    if (!isAuthenticated) {
      RNAlert.alert(
        t('error'),
        t('pleaseLogInToTranscribe') || 'Please log in to transcribe audio'
      );
      return;
    }

    // Validate the audio URI exists
    if (!uri) {
      RNAlert.alert(
        t('error'),
        t('audioNotAvailable') ||
          'Audio not available. The file may not have been downloaded yet.'
      );
      return;
    }

    // For local files, check if they exist. Skip check for URLs (fileExists only works for file:// URIs)
    const isLocalFile = uri.startsWith('file://');
    if (isLocalFile) {
      try {
        const exists = await fileExists(uri);
        if (!exists) {
          console.log('[Transcription] Audio file not found at URI:', uri);
          RNAlert.alert(
            t('error'),
            t('audioNotAvailable') ||
              'Audio not available. The file may not have been downloaded yet.'
          );
          return;
        }
      } catch (error) {
        console.warn('[Transcription] Error checking file existence:', error);
        // Continue anyway - let the transcription service handle the error
      }
    }

    console.log('[Transcription] Starting transcription for URI:', uri);

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

      if (orthographyExamples.length > 0 && currentContentLanguageId) {
        // Get language name for the prompt
        const languoid = languoidById.get(currentContentLanguageId);
        const languageName = languoid?.name || 'the target language';

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
        `${t('transcriptionFailed') || 'Failed to transcribe audio.'}\n\n${errorMessage}`
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
              <Icon name="lock" className="text-muted-foreground" />
              {translateMembership === 'owner' && (
                <Icon name="crown" className="text-primary" />
              )}
              {translateMembership === 'member' && (
                <Icon name="user" className="text-primary" />
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
              <Icon name="settings" size={22} className="text-foreground" />
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
                <Icon name="flag" size={20} className="text-foreground" />
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
            <Icon name="file-text" size={24} />
          </TabsTrigger>
          <TabsTrigger
            value="image"
            className="flex-1 items-center py-2"
            disabled={!activeAsset.images || activeAsset.images.length === 0}
          >
            <Icon name="image" size={24} />
          </TabsTrigger>
        </TabsList>

        {/* Asset Content Viewer */}
        <View
          className={cn(!allowEditing && 'opacity-50', 'flex overflow-hidden')}
          style={{ height: assetViewerHeight }}
        >
          <TabsContent value="text" className="flex-1 py-2">
            {activeAsset.content && activeAsset.content.length > 0 ? (
              <View style={{ flex: 1 }}>
                {/* Swipeable content carousel */}
                <FlatList
                  ref={contentFlatListRef}
                  data={activeAsset.content}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  snapToInterval={contentWidth}
                  decelerationRate="fast"
                  getItemLayout={(_, index) => ({
                    length: contentWidth,
                    offset: contentWidth * index,
                    index
                  })}
                  style={{ height: 200 }}
                  renderItem={({ item: content, index }) => {
                    const languoidId =
                      content.languoid_id || content.source_language_id;
                    const languoid = languoidId
                      ? (languoidById.get(languoidId) ?? null)
                      : null;
                    const isCurrentItem = index === currentContentIndex;

                    return (
                      <View
                        style={{ width: contentWidth, paddingHorizontal: 8 }}
                      >
                        <SourceContent
                          content={content}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          sourceLanguage={languoid as any}
                          audioSegments={
                            isCurrentItem ? resolvedAudioUris : undefined
                          }
                          isLoading={isCurrentItem && isLoadingAttachments}
                          onTranscribe={
                            isCurrentItem &&
                            enableTranscription &&
                            isAuthenticated
                              ? handleTranscribe
                              : undefined
                          }
                          isTranscribing={
                            isCurrentItem && (isTranscribing || isLocalizing)
                          }
                        />
                      </View>
                    );
                  }}
                />

                {/* Navigation controls and pagination - only show if multiple items */}
                {activeAsset.content.length > 1 && (
                  <View className="flex-row items-center justify-center gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentContentIndex === 0}
                      onPress={() =>
                        scrollToContentIndex(currentContentIndex - 1)
                      }
                    >
                      <Icon
                        name="chevron-left"
                        size={20}
                        className={
                          currentContentIndex === 0
                            ? 'text-muted-foreground'
                            : 'text-foreground'
                        }
                      />
                    </Button>

                    {/* Pagination dots */}
                    <View className="flex-row items-center gap-1.5">
                      {activeAsset.content.map((_, index) => (
                        <View
                          key={index}
                          className={cn(
                            'h-2 w-2 rounded-full',
                            index === currentContentIndex
                              ? 'bg-primary'
                              : 'bg-muted-foreground/30'
                          )}
                        />
                      ))}
                    </View>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={
                        currentContentIndex === activeAsset.content.length - 1
                      }
                      onPress={() =>
                        scrollToContentIndex(currentContentIndex + 1)
                      }
                    >
                      <Icon
                        name="chevron-right"
                        size={20}
                        className={
                          currentContentIndex === activeAsset.content.length - 1
                            ? 'text-muted-foreground'
                            : 'text-foreground'
                        }
                      />
                    </Button>
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

      {/* Translations/Transcriptions List - Pass project data to avoid re-querying */}
      <View className="flex-1">
        {/* Content Type Toggle - only show transcription option if source has audio */}
        <View className="h-px bg-border" />
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
            {sourceHasAudio && (
              <ToggleGroupItem value="transcription" className="flex-1">
                <RNPText>{t('transcriptions')}</RNPText>
              </ToggleGroupItem>
            )}
          </ToggleGroup>
        </View>

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
          contentTypeFilter={contentTypeFilter}
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
                name="lock"
                size={20}
                className="text-primary-foreground"
              />
              <Icon
                name="plus"
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
          <Icon name="lock" size={24} />
          <Text className="font-bold text-secondary">
            {t('signInToSaveOrContribute')}
          </Text>
        </Button>
      ) : (
        <Button
          className="-mx-4 flex-row items-center justify-center gap-2 px-6 py-4"
          disabled={!canTranslate}
          onPress={handleNewTranslationPress}
        >
          <Icon name="plus" size={24} />
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
          assetId={currentAssetId}
          assetName={activeAsset.name}
          assetContent={activeAsset.content}
          sourceLanguage={null}
          translationLanguageId={translationLanguageId}
          isLocalSource={activeAsset.source === 'local'}
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
              goBack();
            }
          }}
        />
      )}
    </View>
  );
}
