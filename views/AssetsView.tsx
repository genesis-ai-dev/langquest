/**
 * AssetsView - Migrated from app/_(root)/(drawer)/(stack)/projects/[projectId]/quests/[questId]/assets/index.tsx
 * Now works with state-driven navigation instead of routes
 */

import { AssetFilterModal } from '@/components/AssetFilterModal';
import { AssetSkeleton } from '@/components/AssetSkeleton';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { QuestDetails } from '@/components/QuestDetails';
import { useSessionProjects } from '@/contexts/SessionCacheContext';
import type { Asset } from '@/database_services/assetService';
import type { Tag } from '@/database_services/tagService';
import { useInfiniteAssetsWithTagsAndContentByQuestId } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useQuestById } from '@/hooks/db/useQuests';
import {
  useAppNavigation,
  useCurrentNavigation
} from '@/hooks/useAppNavigation';
import { useDownload } from '@/hooks/useDownloads';
import { useLocalization } from '@/hooks/useLocalization';
import { useProfiler } from '@/hooks/useProfiler';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { sortItems } from '@/utils/sortingUtils';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { AssetListSkeleton } from '@/components/AssetListSkeleton';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

// Helper functions outside component to prevent recreation
// filterAssets function removed - filtering is now handled server-side in the hook

// Memoized AssetCard component to prevent unnecessary re-renders
const AssetCard = React.memo(({ asset }: { asset: Asset }) => {
  // Use current navigation to get project
  const { currentProjectId } = useCurrentNavigation();

  // Use session cache for project data instead of fresh query
  const { getCachedProject } = useSessionProjects();
  const cachedProject = getCachedProject(currentProjectId || '');

  // Fallback to fresh query only if not in cache
  const { project: freshProject } = useProjectById(currentProjectId || '');
  const activeProject = cachedProject || freshProject;

  const {
    isFlaggedForDownload,
    isLoading: isDownloadLoading,
    toggleDownload
  } = useDownload('asset', asset.id);

  const handleDownloadToggle = useCallback(async () => {
    await toggleDownload();
  }, [toggleDownload]);

  return (
    <View style={sharedStyles.card}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.small
        }}
      >
        <Text style={[sharedStyles.cardTitle, { flex: 1 }]}>{asset.name}</Text>
        <PrivateAccessGate
          projectId={activeProject?.id || ''}
          projectName={activeProject?.name || ''}
          isPrivate={activeProject?.private || false}
          action="download"
          allowBypass={true}
          onBypass={handleDownloadToggle}
          renderTrigger={({ onPress, hasAccess }) => (
            <DownloadIndicator
              isFlaggedForDownload={isFlaggedForDownload}
              isLoading={isDownloadLoading}
              onPress={
                hasAccess || isFlaggedForDownload
                  ? handleDownloadToggle
                  : onPress
              }
            />
          )}
        />
      </View>
      <View style={styles.translationCount}>
        {/* Translation gems could be added here later */}
      </View>
    </View>
  );
});

AssetCard.displayName = 'AssetCard';

export default function AssetsView() {
  const { renderCount: _renderCount } = useProfiler({
    componentName: 'AssetsView'
  });

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const { t } = useLocalization();
  const { goToAsset } = useAppNavigation();

  // Get current navigation state
  const { currentQuestId, currentProjectId } = useCurrentNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showQuestStats, setShowQuestStats] = useState(false);

  // Early return if no quest is selected
  if (!currentQuestId || !currentProjectId) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No quest selected</Text>
      </View>
    );
  }

  const { quest } = useQuestById(currentQuestId);

  // Use the new hybrid infinite query hook for better performance and offline support
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useInfiniteAssetsWithTagsAndContentByQuestId(
    currentQuestId,
    10, // pageSize
    activeSorting[0]?.field === 'name' ? activeSorting[0].field : undefined,
    activeSorting[0]?.order,
    searchQuery, // Add search query parameter
    activeFilters // Add active filters for server-side filtering
  );

  // Extract all assets from pages
  const allAssets = useMemo(() => {
    if (!infiniteData?.pages) {
      return [];
    }

    return infiniteData.pages.flatMap((page) => page.data);
  }, [infiniteData]);

  // Apply client-side sorting only - filtering is now handled server-side
  const filteredAssets = useMemo(() => {
    if (!allAssets.length) {
      return [];
    }

    console.log(
      `🔍 [PERFORMANCE] Starting filteredAssets calculation with ${allAssets.length} assets`
    );
    const startTime = performance.now();

    const assetTagsRecord: Record<string, Tag[]> = {};

    // Build the records with proper typing for sorting
    allAssets.forEach((asset) => {
      assetTagsRecord[asset.id] = asset.tags.map((tag) => tag.tag);
    });

    // Apply additional sorting if needed (beyond what's handled by the query)
    // Filtering is now handled server-side in the hook
    const result = sortItems(
      allAssets,
      activeSorting,
      (assetId: string) => assetTagsRecord[assetId] ?? []
    );

    const duration = performance.now() - startTime;
    console.log(
      `🔍 [PERFORMANCE] filteredAssets calculation took ${duration.toFixed(2)}ms, ${result.length} assets (filtering and search handled server-side)`
    );

    return result;
  }, [allAssets, activeSorting]); // Remove activeFilters dependency since it's handled server-side

  // const getActiveOptionsCount = () => {
  //   const filterCount = Object.values(activeFilters).flat().length;
  //   const sortCount = activeSorting.length;
  //   return filterCount + sortCount;
  // };

  const handleAssetPress = useCallback(
    (asset: Asset) => {
      goToAsset({
        id: asset.id,
        name: asset.name,
        projectId: currentProjectId,
        questId: currentQuestId
      });
    },
    [goToAsset, currentProjectId, currentQuestId]
  );

  // Stable renderItem function to prevent re-renders
  const renderAssetItem = useCallback(
    ({ item }: { item: Asset }) => (
      <TouchableOpacity onPress={() => handleAssetPress(item)}>
        <AssetCard asset={item} />
      </TouchableOpacity>
    ),
    [handleAssetPress]
  );

  const handleCloseDetails = () => {
    setSelectedAsset(null);
    setShowQuestStats(false);
  };

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
  };

  const toggleQuestStats = () => {
    setShowQuestStats((prev) => !prev);
  };

  // Load more data when user reaches end of list
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetching) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  // Refresh data
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Render footer with loading indicator
  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={{ paddingVertical: spacing.medium }}>
        <AssetSkeleton />
        <AssetSkeleton />
        <AssetSkeleton />
      </View>
    );
  };

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isFilterModalVisible) {
          setIsFilterModalVisible(false);
          return true;
        }
        if (selectedAsset) {
          setSelectedAsset(null);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isFilterModalVisible, selectedAsset]);

  // Loading state with better UX
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View
          style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
        >
          <AssetListSkeleton />
        </View>
      </View>
    );
  }

  // Error state with retry option
  if (isError) {
    return (
      <View style={styles.container}>
        <View
          style={[
            sharedStyles.container,
            {
              backgroundColor: 'transparent',
              justifyContent: 'center',
              alignItems: 'center'
            }
          ]}
        >
          <Text
            style={{
              color: colors.error,
              fontSize: fontSizes.medium,
              textAlign: 'center'
            }}
          >
            Error loading assets: {error.message}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={[styles.retryButton, { marginTop: spacing.medium }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
      >
        <View style={styles.headerContainer}>
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={colors.text}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchAssets')}
              placeholderTextColor={colors.text}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {/* <TouchableOpacity
              onPress={() => setIsFilterModalVisible(true)}
              style={styles.filterIcon}
            >
              <Ionicons name="filter" size={20} color={colors.text} />
              {getActiveOptionsCount() > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {getActiveOptionsCount()}
                  </Text>
                </View>
              )}
            </TouchableOpacity> */}
          </View>
        </View>

        <FlashList
          data={filteredAssets}
          renderItem={renderAssetItem}
          keyExtractor={(item) => item.id}
          style={sharedStyles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyText}>
              <Text style={styles.emptyText}>{t('noAssetsFound')}</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isFetchingNextPage}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          // Performance optimizations
          removeClippedSubviews={true}
        />
        <TouchableOpacity onPress={toggleQuestStats} style={styles.statsButton}>
          <Ionicons name="stats-chart" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <Modal
        visible={isFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={{ flex: 1 }}>
          <AssetFilterModal
            onClose={() => setIsFilterModalVisible(false)}
            questId={currentQuestId}
            onApplyFilters={handleApplyFilters}
            onApplySorting={handleApplySorting}
            initialFilters={activeFilters}
            initialSorting={activeSorting}
          />
        </View>
      </Modal>
      {showQuestStats && quest && (
        <QuestDetails quest={quest} onClose={handleCloseDetails} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  emptyText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
    color: colors.textSecondary
  },
  headerContainer: {
    flexDirection: 'column',
    marginBottom: spacing.medium,
    width: '100%'
  },
  statsButton: {
    padding: spacing.small,
    alignSelf: 'flex-end'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    marginTop: spacing.medium,
    marginBottom: spacing.medium,
    width: '100%'
  },
  searchIcon: {
    marginRight: spacing.small
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.medium,
    paddingVertical: spacing.medium
  },
  filterIcon: {
    marginLeft: spacing.small,
    padding: spacing.small,
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  translationCount: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginTop: spacing.small,
    gap: spacing.xsmall
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    gap: spacing.small
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium
  },
  retryButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
