import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { sharedStyles, spacing } from '@/styles/theme';
import { eq } from 'drizzle-orm';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSimpleHybridInfiniteData } from './useHybridData';

// Component imports
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { RabbitModeSwitch } from '@/components/RabbitModeSwitch';
import { RabbitModeUI } from '@/components/RabbitModeUI';

// Local component imports
import { AssetListView } from './NextGenAssets/components/AssetListView';
import { AssetSearchBar } from './NextGenAssets/components/AssetSearchBar';
import { UserFlaggingModal } from './NextGenAssets/components/UserFlaggingModal';
import { useRabbitMode } from './NextGenAssets/hooks/useRabbitMode';

type Asset = typeof asset.$inferSelect;

export default function NextGenAssetsView() {
  const { currentQuestId } = useCurrentNavigation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const { t } = useLocalization();

  // Debounce search query
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch assets data
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching
  } = useSimpleHybridInfiniteData<Asset>(
    'assets',
    [currentQuestId || '', debouncedSearchQuery],
    // Offline query function
    async ({ pageParam, pageSize }) => {
      if (!currentQuestId) return [];

      try {
        const offset = pageParam * pageSize;
        const baseQuery = system.db
          .select({
            id: asset.id,
            name: asset.name,
            source_language_id: asset.source_language_id,
            images: asset.images,
            creator_id: asset.creator_id,
            visible: asset.visible,
            active: asset.active,
            created_at: asset.created_at,
            last_updated: asset.last_updated,
            download_profiles: asset.download_profiles
          })
          .from(asset)
          .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
          .where(eq(quest_asset_link.quest_id, currentQuestId));

        if (debouncedSearchQuery.trim()) {
          const allAssets = await baseQuery;
          const searchTerm = debouncedSearchQuery.trim().toLowerCase();
          const filteredAssets = allAssets.filter((a) => {
            const assetName = a.name;
            return (
              assetName &&
              typeof assetName === 'string' &&
              assetName.toLowerCase().includes(searchTerm)
            );
          });
          return filteredAssets.slice(offset, offset + pageSize) as Asset[];
        }

        const assets = await baseQuery.limit(pageSize).offset(offset);
        return assets as Asset[];
      } catch (error) {
        console.error('[ASSETS] Offline query error:', error);
        return [];
      }
    },
    // Cloud query function
    async () => Promise.resolve([] as Asset[]),
    20 // pageSize
  );

  // Process assets
  const assets = React.useMemo(() => {
    const allAssets = data.pages.flatMap((page) => page.data);
    const validAssets = allAssets.filter((asset) => asset.id && asset.name);
    return validAssets.sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }, [data.pages]);

  // Watch attachment states
  const assetIds = React.useMemo(
    () => assets.map((asset) => asset.id),
    [assets]
  );
  const { attachmentStates, isLoading: isAttachmentStatesLoading } =
    useAttachmentStates(assetIds);

  // Use rabbit mode hook
  const {
    isRabbitMode,
    showFlaggingModal,
    currentSessionId,
    vadState,
    setShowFlaggingModal,
    handleEnterRabbitMode,
    handleExitRabbitMode,
    handleDeleteSegment,
    handleReorderSegment,
    handleFlagSubmit,
    handleForceReset,
    vadFunctions
  } = useRabbitMode({ currentQuestId: currentQuestId || null, assets });

  // Handle pagination
  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Show loading skeleton on initial load
  if (isLoading && !searchQuery) {
    return <ProjectListSkeleton />;
  }

  // Show no quest selected message
  if (!currentQuestId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>{t('noQuestSelected')}</Text>
      </View>
    );
  }

  // Render rabbit mode interface
  if (isRabbitMode && currentSessionId) {
    return (
      <>
        <RabbitModeUI
          sessionId={currentSessionId}
          isListening={vadState.isListening}
          isSpeaking={vadState.isSpeaking}
          currentLevel={vadState.currentLevel}
          onStartListening={() => {
            console.log('🎯 UI: Start listening requested');
            if (vadFunctions?.startListening) {
              vadFunctions.startListening().catch((error) => {
                console.error('❌ Error starting VAD:', error);
                handleForceReset(); // Reset if start fails
              });
            } else {
              console.warn('⚠️ VAD functions not available');
            }
          }}
          onStopListening={() => {
            console.log('🎯 UI: Stop listening requested');
            if (vadFunctions?.stopListening) {
              vadFunctions.stopListening().catch((error) => {
                console.error('❌ Error stopping VAD:', error);
                handleForceReset(); // Reset if stop fails
              });
            } else {
              console.warn('⚠️ VAD functions not available');
            }
          }}
          onDeleteSegment={handleDeleteSegment}
          onReorderSegment={handleReorderSegment}
          onExitRabbitMode={() => {
            handleForceReset(); // Reset before exiting
            handleExitRabbitMode();
          }}
          onShowFlagModal={() => setShowFlaggingModal(true)}
        />

        <UserFlaggingModal
          visible={showFlaggingModal}
          onClose={() => setShowFlaggingModal(false)}
          onSubmit={handleFlagSubmit}
        />
      </>
    );
  }

  // Render normal mode interface
  return (
    <View style={sharedStyles.container}>
      <View style={styles.headerContainer}>
        <Text style={sharedStyles.title}>{t('assets')}</Text>

        <RabbitModeSwitch
          value={isRabbitMode}
          onToggle={() => {
            if (isRabbitMode) {
              handleExitRabbitMode();
            } else {
              handleEnterRabbitMode();
            }
          }}
          disabled={assets.length === 0}
        />
      </View>

      <AssetSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearching={isFetching && !!searchQuery}
      />

      <AssetListView
        assets={assets}
        attachmentStates={attachmentStates}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isLoading && !isAttachmentStatesLoading}
        searchQuery={searchQuery}
        isOnline={isOnline}
        onEndReached={onEndReached}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
    paddingHorizontal: spacing.medium
  }
});
